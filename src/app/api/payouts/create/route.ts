import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireRole } from '@/lib/serverAuth';
import { prisma } from '@/lib/prisma';
import { createGatewayPayout } from '@/lib/paymentGateway';

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) return roleError;

    const body = await req.json();
    const {
      storeId,
      shiftSessionId,
      amount,
      channelCode,
      accountNumber,
      accountHolderName,
      description,
      idempotencyKey,
      reason,
    } = body;

    if (!storeId || !shiftSessionId || !amount || !channelCode || !accountNumber || !accountHolderName || !idempotencyKey) {
      return NextResponse.json({ error: 'Data payout tidak lengkap' }, { status: 400 });
    }

    const shift = await prisma.shiftSession.findUnique({
      where: { id: shiftSessionId },
    });

    if (!shift || shift.status !== 'open') {
      return NextResponse.json({ error: 'Shift tidak aktif atau tidak ditemukan' }, { status: 400 });
    }

    const referenceId = `payout-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Call Payment Gateway
    const gatewayResponse = await createGatewayPayout({
      storeId,
      shiftSessionId,
      requestedBy: session.userId,
      referenceId,
      channelCode,
      accountNumber,
      accountHolderName,
      amount: Number(amount),
      currency: 'IDR',
      description: description || reason,
      idempotencyKey,
      metadata: {
        reason,
        requestedByName: session.fullName,
      },
    });

    // Mask account number for local storage
    const maskedAccount = accountNumber.length > 4 
      ? `****${accountNumber.slice(-4)}`
      : accountNumber;

    // Create local record in shift_cash_transfers
    const transfer = await prisma.shiftCashTransfer.create({
      data: {
        shiftSessionId,
        type: 'transfer_out',
        amount: Number(amount),
        referenceId: referenceId,
        gatewayPayoutId: gatewayResponse.id,
        xenditPayoutId: gatewayResponse.xenditPayoutId,
        status: gatewayResponse.status.toLowerCase(),
        channelCode,
        accountNumberMasked: maskedAccount,
        accountHolderName,
        reason: reason || description,
        approvedBy: session.userId,
        requestedAt: gatewayResponse.createdAt ? new Date(gatewayResponse.createdAt) : new Date(),
      },
    });

    return NextResponse.json({
      data: {
        id: transfer.id,
        referenceId: transfer.referenceId,
        status: transfer.status,
        amount: Number(transfer.amount),
        createdAt: transfer.createdAt,
      },
    });
  } catch (error) {
    console.error('Payout creation failed:', error);
    const message = error instanceof Error ? error.message : 'Gagal membuat permintaan payout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
