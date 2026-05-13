import { NextRequest, NextResponse } from 'next/server';
import { createPaymentSession } from '@/lib/paymentService';

type PaymentCreateBody = {
  transactionId?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PaymentCreateBody;
    const { transactionId, customerEmail, customerName, description, successRedirectUrl, failureRedirectUrl } = body;

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const result = await createPaymentSession({
      transactionId,
      customerEmail,
      customerName,
      description,
      successRedirectUrl,
      failureRedirectUrl,
      sourceApp: 'sistemkasir',
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[payments/create] Payment error', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('already been paid') || message.includes('no longer payable') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
