import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/serverAuth';
import { prisma } from '@/lib/prisma';
import { fetchGatewayPayoutStatus } from '@/lib/paymentGateway';

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(req.url);
    const referenceId = searchParams.get('referenceId');
    const id = searchParams.get('id');

    if (!referenceId && !id) {
      return NextResponse.json({ error: 'Missing lookup parameter' }, { status: 400 });
    }

    const lookupFilters = [
      id ? { id } : null,
      referenceId ? { referenceId } : null,
    ].filter((value): value is { id: string } | { referenceId: string } => Boolean(value));

    const transfer = await prisma.shiftCashTransfer.findFirst({
      where: {
        OR: lookupFilters,
      },
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Data payout tidak ditemukan' }, { status: 404 });
    }

    // Refresh from Gateway if status is not terminal
    if (transfer.status === 'pending' || transfer.status === 'accepted') {
      try {
        const gatewayStatus = await fetchGatewayPayoutStatus({
          id: transfer.gatewayPayoutId,
          referenceId: transfer.referenceId,
        });

        if (gatewayStatus.status.toLowerCase() !== transfer.status) {
          const updated = await prisma.shiftCashTransfer.update({
            where: { id: transfer.id },
            data: {
              status: gatewayStatus.status.toLowerCase(),
              completedAt: gatewayStatus.completedAt ? new Date(gatewayStatus.completedAt) : null,
              failureCode: gatewayStatus.failureCode,
              failureMessage: gatewayStatus.failureMessage,
              xenditPayoutId: gatewayStatus.xenditPayoutId || transfer.xenditPayoutId,
            },
          });

          return NextResponse.json({
            data: {
              id: updated.id,
              referenceId: updated.referenceId,
              status: updated.status,
              amount: Number(updated.amount),
              completedAt: updated.completedAt,
              failureMessage: updated.failureMessage,
            },
          });
        }
      } catch (error) {
        console.error('Failed to sync payout status with gateway:', error);
      }
    }

    return NextResponse.json({
      data: {
        id: transfer.id,
        referenceId: transfer.referenceId,
        status: transfer.status,
        amount: Number(transfer.amount),
        completedAt: transfer.completedAt,
        failureMessage: transfer.failureMessage,
      },
    });
  } catch (error) {
    console.error('Payout status check failed:', error);
    return NextResponse.json({ error: 'Gagal mengecek status payout' }, { status: 500 });
  }
}
