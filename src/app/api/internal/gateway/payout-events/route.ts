import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getExpectedGatewayToken(): string {
  const value =
    process.env.PAYMENT_GATEWAY_API_KEY?.trim() ??
    process.env.GATEWAY_INTERNAL_API_KEY?.trim();

  if (!value) {
    throw new Error('PAYMENT_GATEWAY_API_KEY is not configured');
  }

  return value;
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

    const body = await req.json();
    const {
      referenceId,
      status,
      completedAt,
      failureCode,
      failureMessage,
      xenditPayoutId,
    } = body;

    if (!referenceId) {
      return NextResponse.json({ error: 'Missing referenceId' }, { status: 400 });
    }

    const transfer = await prisma.shiftCashTransfer.findFirst({
      where: { referenceId },
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Payout record not found', ignored: true });
    }

    // Idempotent update
    const newStatus = status.toLowerCase();
    
    // Only update if status is different or we are getting a terminal state
    const isTerminal = ['succeeded', 'failed', 'cancelled', 'reversed'].includes(newStatus);
    const currentIsTerminal = ['succeeded', 'failed', 'cancelled', 'reversed'].includes(transfer.status || '');

    if (newStatus === transfer.status && (!isTerminal || transfer.completedAt)) {
      return NextResponse.json({ success: true, idempotentSkip: true });
    }

    await prisma.shiftCashTransfer.update({
      where: { id: transfer.id },
      data: {
        status: newStatus,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        failureCode: failureCode || undefined,
        failureMessage: failureMessage || undefined,
        xenditPayoutId: xenditPayoutId || undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[internal/gateway/payout-events] Error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
