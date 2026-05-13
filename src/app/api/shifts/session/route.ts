import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { requireSession } from '@/lib/serverAuth';

const SHIFT_OPEN_LOCK_KEY = 9042001;

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const limitResult = rateLimit(`open_shift_${session.userId}`, 10, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan buka shift. Tunggu beberapa saat.' },
        { status: 429, headers: limitResult.headers }
      );
    }

    const body = (await req.json()) as {
      shiftId?: string;
      openingBalance?: number;
      digitalOpeningBalance?: number;
    };

    const shiftId = typeof body.shiftId === 'string' ? body.shiftId : '';
    if (!shiftId) {
      return NextResponse.json({ error: 'shiftId wajib diisi' }, { status: 400 });
    }

    const openingBalance = Math.max(toNumber(body.openingBalance), 0);
    const digitalOpeningBalance = Math.max(toNumber(body.digitalOpeningBalance), 0);
    const now = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SHIFT_OPEN_LOCK_KEY})`;

        const activeShift = await tx.shiftSession.findFirst({
          where: { status: 'open' },
          orderBy: { openedAt: 'desc' },
        });

        if (activeShift) {
          return { created: false as const, session: activeShift };
        }

        const shift = await tx.shift.findUnique({
          where: { id: shiftId },
          select: { id: true, shiftName: true, isActive: true },
        });

        if (!shift || shift.isActive === false) {
          throw new Error('Shift tidak ditemukan atau tidak aktif');
        }

        const createdSession = await tx.shiftSession.create({
          data: {
            shiftId: shift.id,
            userId: session.userId,
            sessionDate: now,
            xenditBalanceOpen: digitalOpeningBalance,
            cashDrawerOpen: openingBalance,
            totalTransactions: 0,
            totalCashSales: 0,
            totalDigitalSales: 0,
            totalCashlessOther: 0,
            totalExpenses: 0,
            xenditTransactionCount: 0,
            xenditTotalIn: 0,
            openedAt: now,
            status: 'open',
          },
        });

        await tx.activityLog.create({
          data: {
            userId: session.userId,
            action: 'open_shift',
            tableName: 'shift_sessions',
            recordId: createdSession.id,
            description: `Shift dibuka. Laci: Rp ${openingBalance}, Xendit: Rp ${digitalOpeningBalance}`,
          },
        });

        return { created: true as const, session: createdSession };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!result.created) {
      return NextResponse.json(
        { error: 'Shift aktif sudah ada', data: result.session },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: result.session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membuka shift';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const limitResult = rateLimit(`close_shift_${session.userId}`, 10, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan tutup shift. Tunggu beberapa saat.' },
        { status: 429, headers: limitResult.headers }
      );
    }

    const body = (await req.json()) as {
      sessionId?: string;
      actualClosingBalance?: number;
      digitalActualClosingBalance?: number;
      notes?: string;
    };

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId wajib diisi' }, { status: 400 });
    }

    const actualClosingBalance = Math.max(toNumber(body.actualClosingBalance), 0);
    const digitalActualClosingBalance = Math.max(toNumber(body.digitalActualClosingBalance), 0);
    const notes = typeof body.notes === 'string' ? body.notes : null;

    const updatedSession = await prisma.$transaction(async (tx) => {
      const existing = await tx.shiftSession.findUnique({
        where: { id: sessionId },
      });

      if (!existing) {
        throw new Error('Sesi shift tidak ditemukan');
      }

      if (existing.status !== 'open') {
        throw new Error('Sesi shift ini sudah ditutup');
      }

      const expectedCash =
        Number(existing.cashDrawerOpen || 0) +
        Number(existing.totalCashSales || 0) -
        Number(existing.totalExpenses || 0);
      const cashDiscrepancy = actualClosingBalance - expectedCash;

      const expectedDigital = Number(existing.xenditBalanceOpen || 0) + Number(existing.xenditTotalIn || 0);
      const digitalDiscrepancy = digitalActualClosingBalance - expectedDigital;

      const closedAt = new Date();
      const updated = await tx.shiftSession.update({
        where: { id: sessionId },
        data: {
          cashDrawerExpected: expectedCash,
          cashDrawerClose: actualClosingBalance,
          cashDiscrepancy,
          xenditBalanceClose: digitalActualClosingBalance,
          xenditDiscrepancy: digitalDiscrepancy,
          notes,
          status: 'closed',
          closedAt,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.userId,
          action: 'close_shift',
          tableName: 'shift_sessions',
          recordId: sessionId,
          description: `Shift ditutup. Selisih Laci: ${cashDiscrepancy}, Selisih Xendit: ${digitalDiscrepancy}`,
        },
      });

      return updated;
    });

    return NextResponse.json({ data: updatedSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menutup shift';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
