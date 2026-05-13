import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireSession } from '@/lib/serverAuth';

const POS_CHECKOUT_LOCK_KEY = 9042002;
const SUPPORTED_PAYMENT_METHODS = new Set(['cash', 'xendit', 'cashless_other']);
const SUPPORTED_ORDER_TYPES = new Set(['dine_in', 'takeaway', 'platform']);

type CheckoutItemInput = {
  productId?: string | null;
  name?: string;
  price?: number;
  quantity?: number;
};

type CheckoutBody = {
  items?: CheckoutItemInput[];
  discountAmount?: number;
  paymentMethod?: string;
  amountPaid?: number;
  shiftSessionId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  orderType?: string;
  tableId?: string | null;
  orderSource?: string | null;
};

function normalizeString(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeStoreCode(storeCode: string | null | undefined): string {
  const safeStoreCode = (storeCode ?? 'STORE').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return safeStoreCode || 'STORE';
}

function getSequenceFromCode(value: string): number {
  const raw = value.split('-').at(-1);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : 0;
}

async function getNextInvoiceNumber(tx: Prisma.TransactionClient, date: Date): Promise<string> {
  const prefix = `INV-${formatDateKey(date)}`;
  const lastTransaction = await tx.transaction.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
    select: {
      invoiceNumber: true,
    },
  });

  const sequence = getSequenceFromCode(lastTransaction?.invoiceNumber ?? '') + 1;
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

async function getNextOrderNumber(
  tx: Prisma.TransactionClient,
  storeCode: string | null | undefined,
  date: Date,
): Promise<string> {
  const prefix = `ORD-${normalizeStoreCode(storeCode)}-${formatDateKey(date)}`;
  const lastOrder = await tx.order.findFirst({
    where: {
      orderNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderNumber: 'desc',
    },
    select: {
      orderNumber: true,
    },
  });

  const sequence = getSequenceFromCode(lastOrder?.orderNumber ?? '') + 1;
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

async function getNextQueueNumber(tx: Prisma.TransactionClient, date: Date): Promise<string> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const count = await tx.order.count({
    where: {
      orderType: {
        in: ['takeaway', 'platform'],
      },
      createdAt: {
        gte: startOfDay,
      },
    },
  });

  return `T-${String(count + 1).padStart(3, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const roleError = requireRole(session, ['owner', 'manager', 'cashier']);
    if (roleError) {
      return roleError;
    }

    const body = (await req.json()) as CheckoutBody;
    const items = Array.isArray(body.items) ? body.items : [];
    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : 'cash';
    const orderType = typeof body.orderType === 'string' ? body.orderType : 'dine_in';
    const shiftSessionId = normalizeString(body.shiftSessionId);
    const tableId = normalizeString(body.tableId);
    const customerName = normalizeString(body.customerName);
    const orderSource = normalizeString(body.orderSource);
    const notes = normalizeString(body.notes);
    const discountAmount = Math.max(toSafeNumber(body.discountAmount), 0);

    if (!items.length) {
      return NextResponse.json({ error: 'Item transaksi wajib diisi' }, { status: 400 });
    }

    if (!SUPPORTED_PAYMENT_METHODS.has(paymentMethod)) {
      return NextResponse.json({ error: 'Metode pembayaran tidak valid' }, { status: 400 });
    }

    if (!SUPPORTED_ORDER_TYPES.has(orderType)) {
      return NextResponse.json({ error: 'Tipe order tidak valid' }, { status: 400 });
    }

    if (orderType === 'dine_in' && !tableId) {
      return NextResponse.json({ error: 'Meja wajib dipilih untuk dine-in kasir' }, { status: 400 });
    }

    const normalizedItems = items
      .map((item) => {
        const name = normalizeString(item.name);
        const price = Math.max(toSafeNumber(item.price), 0);
        const quantity = Math.max(Math.floor(toSafeNumber(item.quantity, 1)), 0);

        if (!name || quantity <= 0) {
          return null;
        }

        return {
          productId: normalizeString(item.productId) ?? undefined,
          name,
          price,
          quantity,
          subtotal: price * quantity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (!normalizedItems.length) {
      return NextResponse.json({ error: 'Seluruh item transaksi tidak valid' }, { status: 400 });
    }

    const now = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${POS_CHECKOUT_LOCK_KEY})`;

        const store = await tx.store.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            storeCode: true,
            taxPercentage: true,
            serviceChargePercentage: true,
            currency: true,
          },
        });

        if (!store) {
          throw new Error('Store aktif tidak ditemukan');
        }

        if (tableId) {
          const table = await tx.table.findUnique({
            where: { id: tableId },
            select: { id: true, status: true },
          });

          if (!table) {
            throw new Error('Meja yang dipilih tidak ditemukan');
          }

          if (table.status === 'inactive' || table.status === 'maintenance') {
            throw new Error('Meja ini sedang tidak bisa dipakai');
          }
        }

        let activeShiftSession: {
          id: string;
          status: string | null;
        } | null = null;

        if (shiftSessionId) {
          activeShiftSession = await tx.shiftSession.findUnique({
            where: { id: shiftSessionId },
            select: {
              id: true,
              status: true,
            },
          });

          if (!activeShiftSession) {
            throw new Error('Sesi shift tidak ditemukan');
          }

          if (activeShiftSession.status !== 'open') {
            throw new Error('Shift yang dipilih sudah ditutup');
          }
        }

        const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
        const taxable = Math.max(subtotal - discountAmount, 0);
        const serviceChargeRate = Number(store.serviceChargePercentage ?? 0);
        const taxRate = Number(store.taxPercentage ?? 0);
        const serviceCharge = taxable * (serviceChargeRate / 100);
        const taxAmount = (taxable + serviceCharge) * (taxRate / 100);
        const totalAmount = Math.round(taxable + serviceCharge + taxAmount);
        const paidAmount = paymentMethod === 'cash' ? Math.max(toSafeNumber(body.amountPaid), 0) : totalAmount;

        // Cross-check: jika client mengirim total, pastikan tidak beda jauh
        const clientTotal = toSafeNumber((body as any).clientTotalAmount);
        if (clientTotal > 0 && Math.abs(clientTotal - totalAmount) > 2) {
          throw new Error(
            `Total tidak sinkron: client=${clientTotal}, server=${totalAmount}. Refresh halaman dan coba lagi.`
          );
        }

        if (paymentMethod === 'cash' && paidAmount < totalAmount) {
          throw new Error('Jumlah pembayaran tunai kurang dari total transaksi');
        }

        const invoiceNumber = await getNextInvoiceNumber(tx, now);
        const orderNumber = await getNextOrderNumber(tx, store.storeCode, now);
        const queueNumber =
          orderType === 'takeaway' || orderType === 'platform'
            ? await getNextQueueNumber(tx, now)
            : null;

        const isXendit = paymentMethod === 'xendit';
        const isCash = paymentMethod === 'cash';

        const transaction = await tx.transaction.create({
          data: {
            shiftSessionId: shiftSessionId ?? null,
            invoiceNumber,
            customerName,
            transactionDate: now,
            subtotal,
            discountAmount,
            serviceCharge,
            taxAmount,
            totalAmount,
            paymentMethod,
            amountPaid: isXendit ? 0 : paidAmount,
            changeAmount: isXendit ? 0 : (isCash ? Math.max(paidAmount - totalAmount, 0) : 0),
            notes,
            status: isXendit ? 'pending' : 'completed',
            paidAt: isXendit ? null : now,
            createdBy: session.userId,
          },
        });

        const transactionDetails = await Promise.all(
          normalizedItems.map((item) =>
            tx.transactionDetail.create({
              data: {
                transactionId: transaction.id,
                productId: item.productId ?? null,
                productName: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                subtotal: item.subtotal,
              },
            }),
          ),
        );

        const order = await tx.order.create({
          data: {
            orderNumber,
            orderType,
            queueNumber,
            orderSource: orderType === 'platform' ? orderSource : null,
            customerName,
            tableId: orderType === 'dine_in' ? tableId : null,
            transactionId: transaction.id,
            status: isXendit ? 'pending_payment' : 'paid',
            subtotal,
            taxAmount,
            serviceCharge,
            discountAmount,
            totalAmount,
            paidAt: isXendit ? null : now,
            notes,
          },
        });

        await Promise.all(
          normalizedItems.map((item) =>
            tx.orderItem.create({
              data: {
                orderId: order.id,
                productId: item.productId ?? null,
                productName: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                subtotal: item.subtotal,
              },
            }),
          ),
        );

        if (orderType === 'dine_in' && tableId) {
          await tx.table.update({
            where: { id: tableId },
            data: { status: 'occupied' },
          });
        }

        let updatedShiftSession = null;
        if (activeShiftSession && !isXendit) {
          updatedShiftSession = await tx.shiftSession.update({
            where: { id: activeShiftSession.id },
            data: {
              totalTransactions: {
                increment: 1,
              },
              totalCashSales: {
                increment: isCash ? totalAmount : 0,
              },
              totalCashlessOther: {
                increment: !isCash ? totalAmount : 0,
              },
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: session.userId,
            action: 'pos_checkout',
            tableName: 'transactions',
            recordId: transaction.id,
            description: `Checkout POS ${invoiceNumber} dibuat untuk ${orderType}${queueNumber ? ` (${queueNumber})` : ''}`,
            newValue: {
              invoiceNumber,
              orderNumber,
              orderType,
              queueNumber,
              paymentMethod,
              totalAmount,
            },
          },
        });

        return {
          transaction,
          transactionDetails,
          order,
          shiftSession: updatedShiftSession,
          queueNumber,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyelesaikan checkout POS';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
