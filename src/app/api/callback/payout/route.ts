import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type PayoutCallbackPayload = {
  eventId: string;
  eventType: string;
  storeId: string;
  shiftSessionId: string | null;
  referenceId: string;
  xenditPayoutId: string | null;
  status: string;
  amount: number;
  currency: string;
  channelCode: string;
  accountHolderName: string;
  failureCode: string | null;
  failureMessage: string | null;
  completedAt: string | null;
  raw: unknown;
};

function assertCallbackToken(req: NextRequest) {
  const token = req.headers.get('x-gateway-callback-token');
  const expected = process.env.GATEWAY_CALLBACK_TOKEN?.trim();

  if (!expected) return;

  if (!token || token !== expected) {
    throw new Error('Unauthorized callback');
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCallbackToken(req);

    const body = (await req.json()) as PayoutCallbackPayload;

    if (!body.referenceId || !body.status) {
      return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
    }

    const existing = await prisma.shiftCashTransfer.findUnique({
      where: { referenceId: body.referenceId },
    });

    if (!existing) {
      // Kembalikan 200 supaya pg tidak retry terus
      console.warn('[gateway/callback/payout] referenceId tidak ditemukan:', body.referenceId);
      return NextResponse.json({ success: true, ignored: true });
    }

    const normalizedStatus = body.status.toLowerCase();

    // Hanya update kalau status belum terminal
    const terminalStatuses = ['succeeded', 'failed', 'cancelled'];
    if (terminalStatuses.includes(existing.status ?? '')) {
      return NextResponse.json({ success: true, ignored: true });
    }

    await prisma.shiftCashTransfer.update({
      where: { referenceId: body.referenceId },
      data: {
        status: normalizedStatus,
        xenditPayoutId: body.xenditPayoutId ?? existing.xenditPayoutId,
        failureCode: body.failureCode ?? null,
        failureMessage: body.failureMessage ?? null,
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Callback error';

    if (message === 'Unauthorized callback') {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    console.error('[gateway/callback/payout] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}