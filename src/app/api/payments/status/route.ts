import { NextRequest, NextResponse } from 'next/server';

import { fetchGatewayPaymentStatus } from '@/lib/paymentGateway';
import { prisma } from '@/lib/prisma';
import { syncPaymentStateFromGateway } from '@/lib/paymentSync';

const transactionSelect = {
  id: true,
  shiftSessionId: true,
  invoiceNumber: true,
  customerName: true,
  transactionDate: true,
  subtotal: true,
  discountAmount: true,
  serviceCharge: true,
  taxAmount: true,
  totalAmount: true,
  paymentMethod: true,
  amountPaid: true,
  changeAmount: true,
  notes: true,
  status: true,
  voidReason: true,
  refundReason: true,
  paidAt: true,
  gatewayPaymentId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

const orderSelect = {
  id: true,
  orderNumber: true,
  orderType: true,
  queueNumber: true,
  status: true,
  paidAt: true,
  updatedAt: true,
} as const;

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Gagal mengambil status pembayaran';
  }
}

export async function GET(req: NextRequest) {
  try {
    const transactionId = req.nextUrl.searchParams.get('id')?.trim();

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: transactionSelect,
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    let gatewayPayment = null;
    try {
      gatewayPayment = await fetchGatewayPaymentStatus({ transactionId });

      await syncPaymentStateFromGateway({
        eventType: 'payment.status_lookup',
        transactionId: gatewayPayment.transactionId,
        orderId: gatewayPayment.orderId,
        externalId: gatewayPayment.externalId,
        xenditInvoiceId: gatewayPayment.xenditInvoiceId,
        xenditSessionId: gatewayPayment.xenditSessionId,
        xenditPaymentRequestId: gatewayPayment.xenditPaymentRequestId,
        status: gatewayPayment.status,
        amount: gatewayPayment.amount,
        paidAt: gatewayPayment.paidAt,
        paymentMethod: gatewayPayment.paymentMethod,
        paymentChannel: gatewayPayment.paymentChannel,
        providerProduct: gatewayPayment.providerProduct,
        raw: gatewayPayment,
      });
    } catch (error) {
      console.warn('[payments/status] Payment gateway lookup failed', {
        transactionId,
        message: extractErrorMessage(error),
      });
    }

    const [latestTransaction, order] = await Promise.all([
      prisma.transaction.findUnique({
        where: { id: transactionId },
        select: transactionSelect,
      }),
      prisma.order.findFirst({
        where: { transactionId },
        orderBy: { createdAt: 'desc' },
        select: orderSelect,
      }),
    ]);

    return NextResponse.json({
      data: {
        transaction: latestTransaction ?? transaction,
        order,
        payment: gatewayPayment ?? null,
      },
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
