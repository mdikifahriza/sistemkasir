import { create } from 'zustand';
import {
  ActivityLog,
  Category,
  DataSnapshot,
  Expense,
  ExpenseCategory,
  Product,
  ShiftSession,
  ShiftEmployee,
  ShiftCashTransfer,
  StoreInfo,
  Transaction,
  TransactionDetail,
  User,
} from '@/lib/data/types';
import { createInvoiceNumber } from '@/lib/utils/id';
import { dbRequest } from '@/lib/api/db';
import { mapToCamel, mapToSnake } from '@/lib/utils/case';
import { useAuthStore } from '@/store/authStore';
import { OFFLINE_BOOTSTRAP_MESSAGE, isLikelyNetworkError } from '@/lib/network';

interface AddTransactionPayload {
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  discountAmount: number;
  paymentMethod: Transaction['paymentMethod'];
  amountPaid: number;
  shiftSessionId?: string | null;
  cashierId?: string | null;
  customerName?: string;
  notes?: string;
}

interface EditTransactionPayload {
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  discountAmount: number;
  paymentMethod: Transaction['paymentMethod'];
  amountPaid: number;
  notes?: string;
  reason: string;
}

interface DataState extends DataSnapshot {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  currentShiftId: string | null;
  isShiftSessionMutating: boolean;
  bootstrap: () => Promise<void>;
  reset: () => void;
  updateStore: (updates: Partial<DataSnapshot['store']>) => Promise<StoreInfo | null>;
  addActivity: (log: Omit<ActivityLog, 'id' | 'createdAt'>) => Promise<ActivityLog | null>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product | null>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<Product | null>;
  removeProduct: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category | null>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<Category | null>;
  removeCategory: (id: string) => Promise<void>;
  addUser: (user: Omit<User, 'id'>) => Promise<User | null>;
  updateUser: (id: string, updates: Partial<User>) => Promise<User | null>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Expense | null>;
  openShift: (shiftId: string, userId: string, openingBalance: number, digitalOpeningBalance?: number) => Promise<ShiftSession | null>;
  closeShift: (sessionId: string, actualClosingBalance: number, digitalActualClosingBalance?: number, notes?: string) => Promise<ShiftSession | null>;
  addTransaction: (payload: AddTransactionPayload) => Promise<Transaction | null>;
  editTransaction: (transactionId: string, payload: EditTransactionPayload) => Promise<Transaction | null>;
  refundTransaction: (transactionId: string, reason: string) => Promise<Transaction | null>;
  addShift: (shift: Omit<DataSnapshot['shifts'][0], 'id'>) => Promise<DataSnapshot['shifts'][0] | null>;
  updateShift: (id: string, updates: Partial<DataSnapshot['shifts'][0]>) => Promise<DataSnapshot['shifts'][0] | null>;
  removeShift: (id: string) => Promise<void>;
}

const emptyStore: StoreInfo = {
  id: '',
  storeCode: '',
  name: '',
  address: '',
  phone: '',
  email: '',
  taxPercentage: 0,
  serviceChargePercentage: 0,
  currency: 'IDR',
  timezone: 'Asia/Jakarta',
  logoUrl: '',
  isActive: true,
};

const emptySnapshot: DataSnapshot = {
  store: emptyStore,
  users: [],
  categories: [],
  products: [],
  shifts: [],
  shiftSessions: [],
  shiftEmployees: [],
  shiftCashTransfers: [],
  transactions: [],
  transactionDetails: [],
  expenses: [],
  expenseCategories: [],
  activityLogs: [],
  tables: [],
  orders: [],
};

const numberFields = new Set([
  'taxPercentage',
  'serviceChargePercentage',
  'sortOrder',
  'sellingPrice',
  'xenditBalanceOpen',
  'xenditBalanceClose',
  'xenditTransactionCount',
  'xenditTotalIn',
  'xenditDiscrepancy',
  'cashDrawerOpen',
  'cashDrawerExpected',
  'cashDrawerClose',
  'cashDiscrepancy',
  'totalCashSales',
  'totalDigitalSales',
  'totalCashlessOther',
  'totalExpenses',
  'totalTransactions',
  'subtotal',
  'discountAmount',
  'serviceCharge',
  'taxAmount',
  'totalAmount',
  'amountPaid',
  'changeAmount',
  'quantity',
  'unitPrice',
  'amount',
]);

function normalizeNumbers<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => normalizeNumbers(item)) as T;
  }
  if (input && typeof input === 'object') {
    const output: Record<string, any> = {};
    Object.entries(input as Record<string, any>).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        output[key] = value;
        return;
      }
      if (numberFields.has(key) && (typeof value === 'string' || typeof value === 'number')) {
        output[key] = Number(value);
      } else {
        output[key] = normalizeNumbers(value);
      }
    });
    return output as T;
  }
  return input;
}

const getActorId = () => useAuthStore.getState().userId ?? undefined;

async function insertRows<T>(table: string, data: any): Promise<T[]> {
  const rows = await dbRequest<any[]>({
    action: 'insert',
    table,
    data: mapToSnake(data),
  });
  return normalizeNumbers(mapToCamel(rows)) as T[];
}

async function updateRows<T>(table: string, match: Record<string, any>, data: any): Promise<T[]> {
  const rows = await dbRequest<any[]>({
    action: 'update',
    table,
    match,
    data: mapToSnake(data),
  });
  return normalizeNumbers(mapToCamel(rows)) as T[];
}

async function deleteRows<T>(table: string, match: Record<string, any>): Promise<T[]> {
  const rows = await dbRequest<any[]>({
    action: 'delete',
    table,
    match,
  });
  return normalizeNumbers(mapToCamel(rows)) as T[];
}

export const useDataStore = create<DataState>((set, get) => ({
  ...emptySnapshot,
  isReady: false,
  isLoading: false,
  error: null,
  currentShiftId: null,
  isShiftSessionMutating: false,
  bootstrap: async () => {
    set({ isLoading: true, error: null });
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ error: OFFLINE_BOOTSTRAP_MESSAGE, isLoading: false });
      return;
    }

    try {
      const res = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        // Session expired or invalid — force logout to break retry loop
        if (res.status === 401) {
          set({ error: 'Sesi login telah berakhir. Silakan login kembali.', isLoading: false });
          void useAuthStore.getState().logout({ redirectToLogin: true });
          return;
        }
        const message = await res.text();
        throw new Error(message || 'Gagal memuat data');
      }

      const payload = (await res.json()) as { data: DataSnapshot };
      const normalized = normalizeNumbers(payload.data);
      const currentShift = normalized.shiftSessions.find((session) => session.status === 'open') || null;

      set({
        ...normalized,
        currentShiftId: currentShift?.id ?? null,
        isReady: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error && isLikelyNetworkError(error)
          ? OFFLINE_BOOTSTRAP_MESSAGE
          : error instanceof Error
            ? error.message
            : 'Gagal memuat data';
      set({ error: message, isLoading: false });
    }
  },
  reset: () => {
    set({ ...emptySnapshot, isReady: false, isLoading: false, error: null, currentShiftId: null, isShiftSessionMutating: false });
  },
  updateStore: async (updates) => {
    const rows = await updateRows<StoreInfo>('stores', {}, updates);
    const updated = rows[0] || null;
    if (updated) {
      set((state) => ({ store: { ...state.store, ...updated } }));
      const fields = Object.keys(updates || {});
      await get().addActivity({
        action: 'update_store',
        tableName: 'stores',
        recordId: updated.id,
        description: `Pengaturan toko diperbarui${fields.length ? `: ${fields.join(', ')}` : ''}`,
      });
    }
    return updated;
  },
  addActivity: async (log) => {
    const rows = await insertRows<ActivityLog>('activity_logs', {
      ...log,
      userId: log.userId ?? getActorId() ?? null,
    });
    const created = rows[0] || null;
    if (created) {
      set((state) => ({ activityLogs: [created, ...state.activityLogs].slice(0, 500) }));
    }
    return created;
  },
  addProduct: async (product) => {
    const rows = await insertRows<Product>('products', product);
    const created = rows[0] || null;
    if (created) {
      set((state) => ({ products: [created, ...state.products] }));
      await get().addActivity({
        action: 'create_product',
        tableName: 'products',
        recordId: created.id,
        description: `Produk dibuat: ${created.name}`,
      });
    }
    return created;
  },
  updateProduct: async (id, updates) => {
    const rows = await updateRows<Product>('products', { id }, updates);
    const updated = rows[0] || null;
    if (updated) {
      set((state) => ({
        products: state.products.map((product) => (product.id === id ? updated : product)),
      }));
      await get().addActivity({
        action: 'update_product',
        tableName: 'products',
        recordId: id,
        description: `Produk diperbarui: ${updated.name}`,
      });
    }
    return updated;
  },
  removeProduct: async (id) => {
    const product = get().products.find((item) => item.id === id);
    await deleteRows<Product>('products', { id });
    set((state) => ({ products: state.products.filter((product) => product.id !== id) }));
    await get().addActivity({
      action: 'delete_product',
      tableName: 'products',
      recordId: id,
      description: `Produk dihapus${product ? `: ${product.name}` : ''}`,
    });
  },
  addCategory: async (category) => {
    const rows = await insertRows<Category>('categories', category);
    const created = rows[0] || null;
    if (created) {
      set((state) => ({ categories: [...state.categories, created] }));
      await get().addActivity({
        action: 'create_category',
        tableName: 'categories',
        recordId: created.id,
        description: `Kategori dibuat: ${created.name}`,
      });
    }
    return created;
  },
  updateCategory: async (id, updates) => {
    const rows = await updateRows<Category>('categories', { id }, updates);
    const updated = rows[0] || null;
    if (updated) {
      set((state) => ({
        categories: state.categories.map((category) => (category.id === id ? updated : category)),
      }));
      await get().addActivity({
        action: 'update_category',
        tableName: 'categories',
        recordId: id,
        description: `Kategori diperbarui: ${updated.name}`,
      });
    }
    return updated;
  },
  removeCategory: async (id) => {
    const category = get().categories.find((item) => item.id === id);
    await deleteRows<Category>('categories', { id });
    set((state) => ({
      categories: state.categories.filter((item) => item.id !== id),
    }));
    await get().addActivity({
      action: 'delete_category',
      tableName: 'categories',
      recordId: id,
      description: `Kategori dihapus${category ? `: ${category.name}` : ''}`,
    });
  },
  addUser: async (user) => {
    const rows = await insertRows<User>('users', user);
    const created = rows[0] || null;
    if (created) {
      set((state) => ({ users: [created, ...state.users] }));
      await get().addActivity({
        action: 'create_user',
        tableName: 'users',
        recordId: created.id,
        description: `Pengguna dibuat: ${created.fullName}`,
      });
    }
    return created;
  },
  updateUser: async (id, updates) => {
    const rows = await updateRows<User>('users', { id }, updates);
    const updated = rows[0] || null;
    if (updated) {
      set((state) => ({ users: state.users.map((user) => (user.id === id ? updated : user)) }));
      await get().addActivity({
        action: 'update_user',
        tableName: 'users',
        recordId: id,
        description: `Pengguna diperbarui: ${updated.fullName}`,
      });
    }
    return updated;
  },

  addExpense: async (expense) => {
    const rows = await insertRows<Expense>('expenses', expense);
    const created = rows[0] || null;
    if (!created) return null;

    const shiftSessionId = expense.shiftSessionId;
    let shiftSessions = get().shiftSessions;
    if (shiftSessionId) {
      const session = shiftSessions.find((item) => item.id === shiftSessionId);
      if (session) {
        const updatedSession = {
          ...session,
          totalExpenses: Number(session.totalExpenses) + Number(expense.amount),
        };
        await updateRows<ShiftSession>('shift_sessions', { id: shiftSessionId }, {
          totalExpenses: updatedSession.totalExpenses,
        });
        shiftSessions = shiftSessions.map((item) => (item.id === shiftSessionId ? updatedSession : item));
      }
    }

    set((state) => ({ expenses: [created, ...state.expenses], shiftSessions }));
    await get().addActivity({
      action: 'create_expense',
      tableName: 'expenses',
      recordId: created.id,
      description: `Pengeluaran dicatat: ${created.amount}`,
    });
    return created;
  },
  openShift: async (shiftId, userId, openingBalance, digitalOpeningBalance = 0) => {
    if (get().isShiftSessionMutating) {
      throw new Error('Sesi shift sedang diproses. Tunggu sebentar.');
    }

    const existing = get().shiftSessions.find((session) => session.status === 'open');
    if (existing) return null;

    set({ isShiftSessionMutating: true });

    try {
      const response = await fetch('/api/shifts/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId,
          userId,
          openingBalance,
          digitalOpeningBalance,
        }),
      });

      const result = await response.json();

      if (response.status === 409 && result?.data) {
        const syncedSession = normalizeNumbers(mapToCamel(result.data)) as ShiftSession;
        set((state) => ({
          shiftSessions: [syncedSession, ...state.shiftSessions.filter((session) => session.id !== syncedSession.id)],
          currentShiftId: syncedSession.id,
        }));
        return null;
      }

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Gagal membuka shift');
      }

      const created = normalizeNumbers(mapToCamel(result.data)) as ShiftSession;
      set((state) => ({
        shiftSessions: [created, ...state.shiftSessions.filter((session) => session.id !== created.id)],
        currentShiftId: created.id,
      }));

      return created;
    } finally {
      set({ isShiftSessionMutating: false });
    }
  },
  closeShift: async (sessionId, actualClosingBalance, digitalActualClosingBalance = 0, notes) => {
    if (get().isShiftSessionMutating) {
      throw new Error('Sesi shift sedang diproses. Tunggu sebentar.');
    }

    const session = get().shiftSessions.find((item) => item.id === sessionId);
    if (!session) return null;

    set({ isShiftSessionMutating: true });

    try {
      const response = await fetch('/api/shifts/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          actualClosingBalance,
          digitalActualClosingBalance,
          notes,
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Gagal menutup shift');
      }

      const updated = normalizeNumbers(mapToCamel(result.data)) as ShiftSession;
      set((state) => ({
        shiftSessions: state.shiftSessions.map((item) => (item.id === sessionId ? updated : item)),
        currentShiftId: null,
      }));

      return updated;
    } finally {
      set({ isShiftSessionMutating: false });
    }
  },
  addShift: async (shift) => {
    const response = await fetch('/api/shifts/master', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shift),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || 'Gagal membuat shift');
    }

    const newShift = result.data;
    set((state) => ({ shifts: [...state.shifts, newShift] }));
    return newShift;
  },
  updateShift: async (id, updates) => {
    const response = await fetch('/api/shifts/master', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || 'Gagal memperbarui shift');
    }

    const updated = result.data;
    set((state) => ({
      shifts: state.shifts.map((s) => (s.id === id ? updated : s)),
    }));
    return updated;
  },
  removeShift: async (id) => {
    try {
      const response = await fetch(`/api/shifts/master?id=${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      
      set((state) => ({
        shifts: state.shifts.filter((s) => s.id !== id),
      }));
    } catch (error) {
      console.error('removeShift error:', error);
      throw error;
    }
  },
  addTransaction: async (payload) => {
    const state = get();
    const store = state.store;
    if (payload.items.length === 0) return null;

    const subtotal = payload.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = Math.max(payload.discountAmount, 0);
    const taxable = Math.max(subtotal - discountAmount, 0);
    
    const serviceCharge = taxable * (Number(store.serviceChargePercentage) / 100);
    const taxAmount = (taxable + serviceCharge) * (Number(store.taxPercentage) / 100);
    const totalAmount = taxable + serviceCharge + taxAmount;
    
    const amountPaid = payload.amountPaid || totalAmount;
    const changeAmount = Math.max(amountPaid - totalAmount, 0);

    const today = new Date();
    const invoiceNumber = createInvoiceNumber(today, state.transactions.length + 1);

    const trxPayload = {
      shiftSessionId: payload.shiftSessionId ?? null,
      invoiceNumber,
      customerName: payload.customerName,
      transactionDate: new Date().toISOString(),
      subtotal,
      discountAmount,
      serviceCharge,
      taxAmount,
      totalAmount,
      paymentMethod: payload.paymentMethod,
      amountPaid,
      changeAmount,
      notes: payload.notes,
      status: 'completed',
      createdBy: payload.cashierId ?? null,
    };

    const [transaction] = await insertRows<Transaction>('transactions', trxPayload);
    if (!transaction) return null;

    const detailPayload = payload.items.map((item) => ({
      transactionId: transaction.id,
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
    }));

    const details = await (detailPayload.length ? insertRows<TransactionDetail>('transaction_details', detailPayload) : Promise.resolve([]));

    let updatedSessions = state.shiftSessions;
    if (payload.shiftSessionId) {
      const session = state.shiftSessions.find((item) => item.id === payload.shiftSessionId);
      if (session) {
        const isCash = payload.paymentMethod === 'cash';
        const isXendit = payload.paymentMethod === 'xendit';
        
        const updatedSession = {
          ...session,
          totalTransactions: Number(session.totalTransactions) + 1,
          totalCashSales: Number(session.totalCashSales) + (isCash ? totalAmount : 0),
          totalDigitalSales: Number(session.totalDigitalSales) + (isXendit ? totalAmount : 0),
          totalCashlessOther: Number(session.totalCashlessOther) + (!isCash && !isXendit ? totalAmount : 0),
          xenditTransactionCount: Number(session.xenditTransactionCount) + (isXendit ? 1 : 0),
          xenditTotalIn: Number(session.xenditTotalIn) + (isXendit ? totalAmount : 0),
        };
        
        await updateRows<ShiftSession>('shift_sessions', { id: session.id }, {
          totalTransactions: updatedSession.totalTransactions,
          totalCashSales: updatedSession.totalCashSales,
          totalDigitalSales: updatedSession.totalDigitalSales,
          totalCashlessOther: updatedSession.totalCashlessOther,
          xenditTransactionCount: updatedSession.xenditTransactionCount,
          xenditTotalIn: updatedSession.xenditTotalIn,
        });
        updatedSessions = state.shiftSessions.map((item) => (item.id === session.id ? updatedSession : item));
      }
    }

    set((state) => ({
      transactions: [transaction, ...state.transactions],
      transactionDetails: [...details, ...state.transactionDetails],
      shiftSessions: updatedSessions,
    }));

    await get().addActivity({
      userId: payload.cashierId ?? undefined,
      action: 'create_transaction',
      tableName: 'transactions',
      recordId: transaction.id,
      description: `Transaksi ${invoiceNumber} dibuat`,
    });

    return transaction;
  },
  editTransaction: async (transactionId, payload) => {
    const state = get();
    const transaction = state.transactions.find((trx) => trx.id === transactionId);
    if (!transaction) return null;

    const linkedOrder = state.orders.find((order) => order.transactionId === transactionId);
    if (linkedOrder) {
      throw new Error(
        `Transaksi ${transaction.invoiceNumber} terhubung ke order ${linkedOrder.orderNumber}. Edit harus lewat flow order restoran, bukan edit transaksi manual.`
      );
    }

    const subtotal = payload.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = Math.max(payload.discountAmount, 0);
    const taxable = Math.max(subtotal - discountAmount, 0);
    const taxAmount = taxable * (Number(state.store.taxPercentage) / 100);
    const totalAmount = taxable + taxAmount;

    const [updatedTransaction] = await updateRows<Transaction>('transactions', { id: transactionId }, {
      subtotal,
      discountAmount,
      discountPercentage: subtotal > 0 ? (discountAmount / subtotal) * 100 : 0,
      taxAmount,
      totalAmount,
      paymentMethod: payload.paymentMethod,
      amountPaid: payload.amountPaid || totalAmount,
      changeAmount: Math.max((payload.amountPaid || totalAmount) - totalAmount, 0),
      notes: payload.notes,
      updatedAt: new Date().toISOString(),
    });

    await deleteRows<TransactionDetail>('transaction_details', { transaction_id: transactionId });
    const newDetails = await insertRows<TransactionDetail>(
      'transaction_details',
      payload.items.map((item) => ({
        transactionId,
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.price * item.quantity,
      }))
    );

    const oldMethod = transaction.paymentMethod;
    const newMethod = payload.paymentMethod;
    const oldAmount = Number(transaction.totalAmount);
    const newAmount = totalAmount;

    let updatedSessions = state.shiftSessions;
    if (transaction.shiftSessionId) {
      const session = state.shiftSessions.find((item) => item.id === transaction.shiftSessionId);
      if (session) {
        const isXendit = newMethod === 'xendit';
        
        const updatedSession = {
          ...session,
          totalCashSales: Math.max(Number(session.totalCashSales) - (oldMethod === 'cash' ? oldAmount : 0) + (newMethod === 'cash' ? newAmount : 0), 0),
          totalDigitalSales: Math.max(Number(session.totalDigitalSales) - (oldMethod === 'xendit' ? oldAmount : 0) + (newMethod === 'xendit' ? newAmount : 0), 0),
          totalCashlessOther: Math.max(Number(session.totalCashlessOther) - (oldMethod !== 'cash' && oldMethod !== 'xendit' ? oldAmount : 0) + (newMethod !== 'cash' && newMethod !== 'xendit' ? newAmount : 0), 0),
        };
        await updateRows<ShiftSession>('shift_sessions', { id: session.id }, {
          totalCashSales: updatedSession.totalCashSales,
          totalDigitalSales: updatedSession.totalDigitalSales,
          totalCashlessOther: updatedSession.totalCashlessOther,
        });
        updatedSessions = state.shiftSessions.map((item) => (item.id === session.id ? updatedSession : item));
      }
    }

    set((state) => ({
      transactions: state.transactions.map((trx) => (trx.id === transactionId ? updatedTransaction : trx)),
      transactionDetails: [
        ...newDetails,
        ...state.transactionDetails.filter((detail) => detail.transactionId !== transactionId),
      ],

      shiftSessions: updatedSessions,
    }));

    await get().addActivity({
      userId: updatedTransaction?.createdBy ?? undefined,
      action: 'edit_transaction',
      tableName: 'transactions',
      recordId: transactionId,
      description: `Transaksi diubah. Alasan: ${payload.reason}`,
    });

    return updatedTransaction || null;
  },
  refundTransaction: async (transactionId, reason) => {
    const state = get();
    const transaction = state.transactions.find((trx) => trx.id === transactionId);
    if (!transaction || transaction.status === 'refunded') return null;

    const linkedOrder = state.orders.find((order) => order.transactionId === transactionId);
    if (linkedOrder) {
      throw new Error(
        `Transaksi ${transaction.invoiceNumber} terhubung ke order ${linkedOrder.orderNumber}. Refund harus diproses lewat flow order/payment restoran agar status tetap sinkron.`
      );
    }

    let updatedSessions = state.shiftSessions;
    if (transaction.shiftSessionId) {
      const session = state.shiftSessions.find((item) => item.id === transaction.shiftSessionId);
      if (session) {
        const isCash = transaction.paymentMethod === 'cash';
        const isXendit = transaction.paymentMethod === 'xendit';
        const amount = Number(transaction.totalAmount);
        
        const updatedSession = {
          ...session,
          totalTransactions: Math.max(Number(session.totalTransactions) - 1, 0),
          totalCashSales: Math.max(Number(session.totalCashSales) - (isCash ? amount : 0), 0),
          totalDigitalSales: Math.max(Number(session.totalDigitalSales) - (isXendit ? amount : 0), 0),
          totalCashlessOther: Math.max(Number(session.totalCashlessOther) - (!isCash && !isXendit ? amount : 0), 0),
        };
        await updateRows<ShiftSession>('shift_sessions', { id: session.id }, {
          totalTransactions: updatedSession.totalTransactions,
          totalCashSales: updatedSession.totalCashSales,
          totalDigitalSales: updatedSession.totalDigitalSales,
          totalCashlessOther: updatedSession.totalCashlessOther,
        });
        updatedSessions = state.shiftSessions.map((item) => (item.id === session.id ? updatedSession : item));
      }
    }

    const [updatedTransaction] = await updateRows<Transaction>('transactions', { id: transactionId }, {
      status: 'refunded',
      notes: reason,
      updatedAt: new Date().toISOString(),
    });

    set((state) => ({
      transactions: state.transactions.map((trx) => (trx.id === transactionId ? updatedTransaction : trx)),

      shiftSessions: updatedSessions,
    }));

    await get().addActivity({
      userId: transaction.createdBy ?? undefined,
      action: 'refund_transaction',
      tableName: 'transactions',
      recordId: transactionId,
      description: `Transaksi direfund. Alasan: ${reason}`,
    });

    return updatedTransaction || null;
  },


}));
