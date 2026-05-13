import { NextRequest, NextResponse } from 'next/server';
import { createPaymentSession } from '@/lib/paymentService';

export async function POST(req: NextRequest) {
  try {
    const internalKey = process.env.SK_INTERNAL_API_KEY;
    const clientKey = req.headers.get('x-internal-api-key');

    if (!internalKey || clientKey !== internalKey) {
      return NextResponse.json({ error: 'Unauthorized internal access' }, { status: 401 });
    }

    const body = await req.json();
    const { transactionId, customerName, customerEmail, sourceApp } = body;

    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }

    const result = await createPaymentSession({
      transactionId,
      customerName,
      customerEmail,
      sourceApp: sourceApp || 'sistempemesanan',
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[internal/payment-session] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('already been paid') || message.includes('no longer payable') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
