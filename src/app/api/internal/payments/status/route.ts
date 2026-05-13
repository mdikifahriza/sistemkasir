import { NextRequest, NextResponse } from 'next/server';
import { fetchGatewayPaymentStatus } from '@/lib/paymentGateway';
import { prisma } from '@/lib/prisma';
import { syncPaymentStateFromGateway } from '@/lib/paymentSync';

export async function GET(req: NextRequest) {
  try {
    const internalKey = process.env.SK_INTERNAL_API_KEY;
    const clientKey = req.headers.get('x-internal-api-key');
    if (!internalKey || clientKey !== internalKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactionId = req.nextUrl.searchParams.get('transactionId')?.trim();
    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId required' }, { status: 400 });
    }

    // Aktif poll gateway dan sync
    try {
      const gatewayPayment = await fetchGatewayPaymentStatus({ transactionId });
      await syncPaymentStateFromGateway({
        eventType: 'internal.status_poll',
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
    } catch (pollError) {
      console.warn('[internal/payments/status] Gateway poll failed:', pollError);
      // Gateway poll failed, return current DB state
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, status: true, totalAmount: true, paidAt: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ data: { transaction } });
  } catch (error) {
    console.error('[internal/payments/status] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
