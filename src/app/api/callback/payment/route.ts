import { NextRequest, NextResponse } from 'next/server';
import { syncPaymentStateFromGateway } from '@/lib/paymentSync';

type PaymentCallbackPayload = {
  eventId: string;
  eventType: string;
  storeId: string;
  transactionId: string;
  orderId: string | null;
  externalId: string;
  xenditInvoiceId: string | null;
  xenditSessionId: string | null;
  xenditPaymentRequestId: string | null;
  providerProduct: string;
  status: string;
  amount: number;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentChannel: string | null;
  feeAmount: number;
  raw: unknown;
};

function assertCallbackToken(req: NextRequest) {
  const token = req.headers.get('x-gateway-callback-token');
  const expected = process.env.GATEWAY_CALLBACK_TOKEN?.trim();

  if (!expected) return; // kalau env tidak di-set, skip validasi

  if (!token || token !== expected) {
    throw new Error('Unauthorized callback');
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCallbackToken(req);

    const body = (await req.json()) as PaymentCallbackPayload;

    if (!body.transactionId || !body.status) {
      return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
    }

    await syncPaymentStateFromGateway({
      eventType: body.eventType,
      transactionId: body.transactionId,
      orderId: body.orderId,
      externalId: body.externalId,
      xenditInvoiceId: body.xenditInvoiceId,
      xenditSessionId: body.xenditSessionId,
      xenditPaymentRequestId: body.xenditPaymentRequestId,
      status: body.status,
      amount: body.amount,
      paidAt: body.paidAt,
      paymentMethod: body.paymentMethod,
      paymentChannel: body.paymentChannel,
      raw: body.raw,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Callback error';

    if (message === 'Unauthorized callback') {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    console.error('[gateway/callback/payment] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}