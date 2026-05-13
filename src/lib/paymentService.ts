import { createGatewayPayment, type PaymentGatewayCreateResponse } from '@/lib/paymentGateway';
import { toPrismaJson } from '@/lib/paymentStatus';
import { prisma } from '@/lib/prisma';
import { getOrderingAppBaseUrl } from '@/lib/runtimeConfig';

export type CreatePaymentSessionParams = {
  transactionId: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  sourceApp?: string;
};

async function resolveCurrentStore() {
  return prisma.store.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, storeCode: true, name: true },
  });
}

async function syncPendingGatewayPaymentState(params: {
  transaction: { id: string; invoiceNumber: string };
  order: { id: string } | null;
  gatewayPayment: PaymentGatewayCreateResponse;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: params.transaction.id },
      data: {
        paymentMethod: 'xendit',
        status: 'pending',
        amountPaid: 0,
        gatewayPaymentId: params.gatewayPayment.gatewayPaymentId,
      },
    });

    if (params.order) {
      await tx.order.update({
        where: { id: params.order.id },
        data: { gatewayPaymentId: params.gatewayPayment.gatewayPaymentId },
      });
    }

    await tx.activityLog.create({
      data: {
        action: 'payment_gateway_payment_created',
        tableName: 'transactions',
        recordId: params.transaction.id,
        description: `Xendit payment session created for ${params.transaction.invoiceNumber}`,
        newValue: toPrismaJson({
          gatewayPaymentId: params.gatewayPayment.gatewayPaymentId,
          externalId: params.gatewayPayment.externalId,
          xenditSessionId: params.gatewayPayment.xenditSessionId,
          xenditPaymentRequestId: params.gatewayPayment.xenditPaymentRequestId,
          status: params.gatewayPayment.status,
          expiresAt: params.gatewayPayment.expiresAt,
        }),
      },
    });
  });
}

export async function createPaymentSession(params: CreatePaymentSessionParams) {
  const { transactionId, customerEmail, customerName: overrideCustomerName, description: overrideDescription, successRedirectUrl: overrideSuccessUrl, failureRedirectUrl: overrideFailureUrl, sourceApp = 'sistemkasir' } = params;

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      status: true,
      customerName: true,
    },
  });

  if (!transaction) throw new Error('Transaction not found');

  const order = await prisma.order.findFirst({
    where: { transactionId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      totalAmount: true,
      paidAt: true,
    },
  });

  const store = await resolveCurrentStore();
  if (!store) throw new Error('Store not found');

  if (order?.status === 'cancelled' || transaction.status === 'void' || transaction.status === 'refunded') {
    throw new Error('Transaction is no longer payable');
  }

  if (order?.status === 'completed' || transaction.status === 'completed' || order?.status === 'paid') {
    throw new Error('Transaction has already been paid');
  }

  const orderingBaseUrl = await getOrderingAppBaseUrl();
  
  const successRedirectUrl = overrideSuccessUrl || new URL(`/order-status/${transaction.id}`, orderingBaseUrl).toString();
  const failureRedirectUrl = overrideFailureUrl || new URL(`/checkout?error=failed&id=${transaction.id}`, orderingBaseUrl).toString();

  const customerName = overrideCustomerName || transaction.customerName || 'Pelanggan';
  const description = overrideDescription || `Pembayaran Pesanan ${order?.orderNumber ?? transaction.invoiceNumber}`;

  const gatewayPayment = await createGatewayPayment({
    storeId: store.id,
    transactionId: transaction.id,
    orderId: order?.id ?? null,
    invoiceNumber: transaction.invoiceNumber,
    orderNumber: order?.orderNumber ?? null,
    amount: Number(transaction.totalAmount),
    currency: 'IDR',
    description,
    customer: { name: customerName, email: customerEmail || undefined },
    redirectUrls: { success: successRedirectUrl, failure: failureRedirectUrl },
    idempotencyKey: `payment:create:${transaction.id}`,
    metadata: {
      source: sourceApp,
      storeId: store.id,
      storeCode: store.storeCode,
      orderId: order?.id ?? null,
      orderNumber: order?.orderNumber ?? null,
      transactionId: transaction.id,
      invoiceNumber: transaction.invoiceNumber,
    },
  });

  if (!gatewayPayment.paymentUrl) throw new Error('Payment gateway did not return a payment URL');

  await syncPendingGatewayPaymentState({
    transaction: { id: transaction.id, invoiceNumber: transaction.invoiceNumber },
    order: order ? { id: order.id } : null,
    gatewayPayment,
  });

  return {
    gatewayPaymentId: gatewayPayment.gatewayPaymentId,
    paymentUrl: gatewayPayment.paymentUrl,
    externalId: gatewayPayment.externalId,
    status: gatewayPayment.status,
    xenditSessionId: gatewayPayment.xenditSessionId,
    xenditPaymentRequestId: gatewayPayment.xenditPaymentRequestId,
    expiryDate: gatewayPayment.expiresAt,
  };
}
