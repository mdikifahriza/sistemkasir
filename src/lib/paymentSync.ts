import { prisma } from '@/lib/prisma';
import {
  buildPaymentMethodFromRaw,
  extractTransactionIdFromExternalId,
  isPaymentSuccess,
  normalizePaymentStatus,
  parsePaymentDate,
  toPrismaJson,
} from '@/lib/paymentStatus';

export type PaymentGatewayEventPayload = {
  eventId?: string | null;
  eventType?: string | null;
  transactionId?: string | null;
  orderId?: string | null;
  externalId?: string | null;
  xenditInvoiceId?: string | null;
  xenditSessionId?: string | null;
  xenditPaymentRequestId?: string | null;
  status?: string | null;
  amount?: number | null;
  paidAt?: string | Date | null;
  paymentMethod?: string | null;
  paymentChannel?: string | null;
  providerProduct?: string | null;
  feeAmount?: number | null;
  raw?: unknown;
};

export type PaymentSyncResult = {
  success: true;
  ignored: boolean;
  idempotentSkip: boolean;
  externalId: string | null;
  invoiceId: string | null;
  transactionId: string | null;
  orderId: string | null;
  paymentId: string | null;
  normalizedStatus: ReturnType<typeof normalizePaymentStatus>;
  paymentStatusChanged: boolean;
  orderStatusChanged: boolean;
  transactionStatusChanged: boolean;
};

function normalizeString(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value?: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isSameDate(left?: Date | null, right?: Date | null): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
}

function assertGatewayAmountMatchesTransaction(params: {
  invoiceNumber?: string | null;
  expectedAmount: number;
  callbackAmount: number | null;
}) {
  if (params.callbackAmount === null) {
    return;
  }

  if (Math.abs(params.expectedAmount - params.callbackAmount) > 1) {
    throw new Error(
      `Gateway paid amount mismatch for ${params.invoiceNumber ?? 'transaction'}: expected ${params.expectedAmount}, received ${params.callbackAmount}`
    );
  }
}

export async function syncPaymentStateFromGateway(
  payload: PaymentGatewayEventPayload
): Promise<PaymentSyncResult> {
  const externalId = normalizeString(payload.externalId);
  const invoiceId = normalizeString(payload.xenditInvoiceId);
  const directTransactionId = normalizeString(payload.transactionId);
  const directOrderId = normalizeString(payload.orderId);
  const rawStatus = normalizeString(payload.status);
  const normalizedStatus = normalizePaymentStatus(rawStatus);
  const resolvedTransactionId = directTransactionId ?? extractTransactionIdFromExternalId(externalId);
  const callbackPaidAt = parsePaymentDate(payload.paidAt);
  const callbackAmount = normalizeNumber(payload.amount);

  if (!resolvedTransactionId && !directOrderId) {
    return {
      success: true,
      ignored: true,
      idempotentSkip: false,
      externalId,
      invoiceId,
      transactionId: resolvedTransactionId,
      orderId: directOrderId,
      paymentId: null,
      normalizedStatus,
      paymentStatusChanged: false,
      orderStatusChanged: false,
      transactionStatusChanged: false,
    };
  }

  return prisma.$transaction(async (tx) => {
    // Row-level lock untuk mencegah race condition concurrent webhook
    if (resolvedTransactionId) {
      await tx.$executeRaw`SELECT 1 FROM "Transaction" WHERE id = ${resolvedTransactionId} FOR UPDATE`;
    }

    const order = directOrderId
      ? await tx.order.findUnique({
          where: { id: directOrderId },
          select: { id: true, orderNumber: true, transactionId: true, status: true, paidAt: true },
        })
      : resolvedTransactionId
        ? await tx.order.findFirst({
            where: { transactionId: resolvedTransactionId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, orderNumber: true, transactionId: true, status: true, paidAt: true },
          })
        : null;

    const finalTransactionId = resolvedTransactionId ?? order?.transactionId ?? null;
    const transaction = finalTransactionId
      ? await tx.transaction.findUnique({
          where: { id: finalTransactionId },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            amountPaid: true,
            changeAmount: true,
            paidAt: true,
            paymentMethod: true,
            shiftSessionId: true,
          },
        })
      : null;

    const amount = callbackAmount ?? Number(transaction?.totalAmount ?? 0);
    const isPaid = isPaymentSuccess(rawStatus);
    const settledAt = callbackPaidAt ?? (isPaid ? new Date() : null);
    const paymentMethod =
      normalizeString(payload.paymentMethod) ??
      buildPaymentMethodFromRaw(payload.raw) ??
      normalizeString(payload.paymentChannel) ??
      'xendit';

    if (isPaid && transaction) {
      assertGatewayAmountMatchesTransaction({
        invoiceNumber: transaction.invoiceNumber,
        expectedAmount: Number(transaction.totalAmount),
        callbackAmount,
      });
    }

    let orderStatusChanged = false;
    let transactionStatusChanged = false;

    if (order) {
      const orderUpdate: any = {};
      if (isPaid) {
        if (order.status !== 'paid' && order.status !== 'completed') {
          orderUpdate.status = 'paid';
        }
        if (settledAt && !isSameDate(order.paidAt, settledAt)) {
          orderUpdate.paidAt = settledAt;
        }
      } else if (normalizedStatus === 'voided') {
        const nextOrderPaymentStatus = rawStatus?.toUpperCase() === 'REFUNDED' ? 'refunded' : 'cancelled';
        if (order.status !== nextOrderPaymentStatus) {
          orderUpdate.status = nextOrderPaymentStatus;
        }
      }

      if (Object.keys(orderUpdate).length > 0) {
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: orderUpdate,
          select: { id: true, tableId: true, status: true },
        });
        orderStatusChanged = true;

        // FIX C1: Release Table jika order dibatalkan (misal: payment expired)
        if (updatedOrder.status === 'cancelled' && updatedOrder.tableId) {
          const otherActiveOrdersCount = await tx.order.count({
            where: {
              tableId: updatedOrder.tableId,
              id: { not: updatedOrder.id },
              status: { in: ['pending_payment', 'paid', 'processing', 'ready'] },
            },
          });

          if (otherActiveOrdersCount === 0) {
            await tx.table.update({
              where: { id: updatedOrder.tableId },
              data: { status: 'available' },
            });
          }
        }
      }
    }

    if (transaction) {
      const transactionUpdate: any = {};
      if (isPaid) {
        if (transaction.status !== 'completed') {
          transactionUpdate.status = 'completed';
          
          // Update Shift Session if this is the first time it becomes completed
          if (transaction.shiftSessionId) {
            // FIX C3: Hanya update total jika shift masih open
            const session = await tx.shiftSession.findUnique({
              where: { id: transaction.shiftSessionId },
              select: { status: true },
            });

            if (session?.status === 'open') {
              await tx.shiftSession.update({
                where: { id: transaction.shiftSessionId },
                data: {
                  totalDigitalSales: { increment: amount },
                  totalTransactions: { increment: 1 },
                  xenditTotalIn: { increment: amount },
                  xenditTransactionCount: { increment: 1 },
                },
              });
            } else {
              console.warn(
                `[paymentSync] Skipped shift totals update for ${session?.status || 'unknown'} session: ${transaction.shiftSessionId}`
              );
            }
          }
        }
        if (Number(transaction.amountPaid) !== amount) transactionUpdate.amountPaid = amount;
        if (Number(transaction.changeAmount) !== 0) transactionUpdate.changeAmount = 0;
        if (settledAt && !isSameDate(transaction.paidAt, settledAt)) transactionUpdate.paidAt = settledAt;
        if (transaction.paymentMethod !== paymentMethod) transactionUpdate.paymentMethod = paymentMethod;
      } else if (normalizedStatus === 'voided') {
        const nextTrxStatus = rawStatus?.toUpperCase() === 'REFUNDED' ? 'refunded' : 'void';
        if (transaction.status !== nextTrxStatus) transactionUpdate.status = nextTrxStatus;
      }

      if (Object.keys(transactionUpdate).length > 0) {
        await tx.transaction.update({ where: { id: transaction.id }, data: transactionUpdate });
        transactionStatusChanged = true;
      }
    }

    if (finalTransactionId && (orderStatusChanged || transactionStatusChanged)) {
      await tx.activityLog.create({
        data: {
          action: `payment_gateway_event_${normalizedStatus}`,
          tableName: 'transactions',
          recordId: finalTransactionId,
          description: `Sinkronisasi pembayaran ${normalizedStatus} untuk transaksi ${transaction?.invoiceNumber ?? finalTransactionId}`,
          newValue: toPrismaJson({
            externalId,
            status: rawStatus,
            orderStatusChanged,
            transactionStatusChanged,
          }),
        },
      });
    }

    return {
      success: true,
      ignored: false,
      idempotentSkip: !orderStatusChanged && !transactionStatusChanged,
      externalId,
      invoiceId,
      transactionId: finalTransactionId,
      orderId: order?.id ?? directOrderId,
      paymentId: null,
      normalizedStatus,
      paymentStatusChanged: false,
      orderStatusChanged,
      transactionStatusChanged,
    };
  });
}
