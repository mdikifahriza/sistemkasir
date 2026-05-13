export type Role = 'owner' | 'manager' | 'cashier' | 'kitchen';

export interface StoreInfo {
  id: string;
  storeCode: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  taxPercentage: number;
  serviceChargePercentage: number;
  currency: string;
  timezone: string;
  logoUrl?: string;
  isActive: boolean;
  printerType?: string;
  printerWidth?: number;
  orderingAppUrl?: string | null;
}

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  pinCode?: string;
  avatarUrl?: string;
  isActive: boolean;
  lastLogin?: string;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  categoryId?: string | null;
  name: string;
  description?: string;
  sellingPrice: number;
  status: 'available' | 'sold_out' | 'discontinued';
  imageUrl?: string;
  createdBy?: string;
}

export interface DiningTable {
  id: string;
  name: string;
  status: 'available' | 'occupied' | 'reserved' | 'inactive' | 'maintenance' | string;
  qrCodeUrl?: string | null;
  activeOrderCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: 'dine_in' | 'takeaway' | 'platform';
  queueNumber?: string | null;
  orderSource?: string | null;
  customerName?: string | null;
  tableId?: string | null;
  transactionId?: string | null;
  gatewayPaymentId?: string | null;
  status: 'pending_payment' | 'paid' | 'confirmed' | 'processing' | 'ready' | 'completed' | 'cancelled' | 'void' | 'refunded' | string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;
  paidAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

export type PaymentMethod = 'cash' | 'xendit' | 'cashless_other';

export interface Transaction {
  id: string;
  shiftSessionId?: string | null;
  invoiceNumber: string;
  customerName?: string;
  transactionDate: string;
  subtotal: number;
  discountAmount: number;
  serviceCharge: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeAmount: number;
  notes?: string;
  status: 'pending' | 'completed' | 'void' | 'refunded' | 'failed' | 'expired' | string;
  voidReason?: string | null;
  refundReason?: string | null;
  paidAt?: string | null;
  gatewayPaymentId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionDetail {
  id: string;
  transactionId: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

export interface Shift {
  id: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  colorCode: string;
  isActive: boolean;
}

export interface ShiftSession {
  id: string;
  shiftId: string;
  userId?: string | null;
  sessionDate: string;
  
  xenditBalanceOpen: number;
  xenditBalanceClose?: number;
  xenditTransactionCount: number;
  xenditTotalIn: number;
  xenditDiscrepancy?: number;
  
  cashDrawerOpen: number;
  cashDrawerExpected?: number;
  cashDrawerClose?: number;
  cashDiscrepancy?: number;
  
  totalCashSales: number;
  totalDigitalSales: number;
  totalCashlessOther: number;
  totalExpenses: number;
  totalTransactions: number;
  
  openedAt?: string;
  closedAt?: string;
  notes?: string;
  status: 'open' | 'closed';
}

export interface ShiftEmployee {
  id: string;
  shiftSessionId: string;
  userId: string;
  checkIn?: string;
  checkOut?: string;
  isPresent: boolean;
  notes?: string;
}

export interface ShiftCashTransfer {
  id: string;
  shiftSessionId: string;
  type: 'xendit_to_drawer' | 'drawer_to_xendit' | 'transfer_out' | 'transfer_in' | string;
  amount: number;
  referenceId?: string;
  gatewayPayoutId?: string;
  xenditPayoutId?: string;
  status?: string;
  channelCode?: string;
  accountNumberMasked?: string;
  accountHolderName?: string;
  failureCode?: string;
  failureMessage?: string;
  reason?: string;
  approvedBy: string;
  requestedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon?: string;
  isForHpp: boolean;
  isActive: boolean;
}

export interface Expense {
  id: string;
  shiftSessionId?: string | null;
  expenseCategoryId?: string | null;
  amount: number;
  description?: string;
  vendorName?: string;
  receiptImageUrl?: string;
  expenseDate: string;
  recordedBy?: string | null;
  isForHpp: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId?: string | null;
  action: string;
  tableName?: string;
  recordId?: string;
  description: string;
  createdAt: string;
}

export interface DataSnapshot {
  store: StoreInfo;
  users: User[];
  categories: Category[];
  products: Product[];
  shifts: Shift[];
  shiftSessions: ShiftSession[];
  shiftEmployees: ShiftEmployee[];
  shiftCashTransfers: ShiftCashTransfer[];
  transactions: Transaction[];
  transactionDetails: TransactionDetail[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  activityLogs: ActivityLog[];
  tables: DiningTable[];
  orders: Order[];
}
