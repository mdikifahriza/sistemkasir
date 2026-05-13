import { NextRequest, NextResponse } from 'next/server';

import {
  type PaymentGatewayEventPayload,
  syncPaymentStateFromGateway,
} from '@/lib/paymentSync';

function getExpectedGatewayToken(): string {
  const value =
    process.env.PAYMENT_GATEWAY_API_KEY?.trim() ??
    process.env.GATEWAY_INTERNAL_API_KEY?.trim();

  if (!value) {
    throw new Error('PAYMENT_GATEWAY_API_KEY is not configured');
  }

  return value;
}

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
    return 'Unknown gateway callback error';
  }
}

export async function POST(req: NextRequest) {
  try {
    const callbackToken =
      req.headers.get('x-gateway-callback-token') ??
      req.headers.get('x-gateway-key') ??
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!callbackToken || callbackToken !== getExpectedGatewayToken()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as PaymentGatewayEventPayload;
    const result = await syncPaymentStateFromGateway(body);

    return NextResponse.json({
      success: true,
      ignored: result.ignored,
      idempotentSkip: result.idempotentSkip,
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    console.error('[internal/gateway/payment-events] Error', { message, error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
