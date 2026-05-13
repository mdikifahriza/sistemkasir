import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireSession } from '@/lib/serverAuth';

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    // Role check: Only owner, manager, and cashier can record expenses
    const roleError = requireRole(session, ['owner', 'manager', 'cashier']);
    if (roleError) {
      return roleError;
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '';
    const shiftSessionId = typeof body.shiftSessionId === 'string' ? body.shiftSessionId : '';

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Jumlah pengeluaran harus lebih dari 0' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'Deskripsi pengeluaran wajib diisi' }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: 'Kategori pengeluaran wajib dipilih' }, { status: 400 });
    }
    if (!shiftSessionId) {
      return NextResponse.json({ error: 'Sesi shift wajib disertakan' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Validasi Shift Session
      const shiftSession = await tx.shiftSession.findUnique({
        where: { id: shiftSessionId },
        select: { id: true, status: true },
      });

      if (!shiftSession) {
        throw new Error('Sesi shift tidak ditemukan');
      }

      if (shiftSession.status !== 'open') {
        throw new Error('Tidak bisa menambah pengeluaran pada shift yang sudah ditutup');
      }

      // 2. Create Expense
      const expense = await tx.expense.create({
        data: {
          amount,
          description,
          expenseCategoryId: categoryId,
          shiftSessionId,
          recordedBy: session.userId,
          expenseDate: new Date(),
        },
      });

      // 3. Update Shift Session Total
      await tx.shiftSession.update({
        where: { id: shiftSessionId },
        data: {
          totalExpenses: {
            increment: amount,
          },
        },
      });

      // 4. Log Activity
      await tx.activityLog.create({
        data: {
          userId: session.userId,
          action: 'create_expense',
          tableName: 'expenses',
          recordId: expense.id,
          description: `Pengeluaran dicatat: Rp ${amount} - ${description}`,
          newValue: { amount, description, categoryId, shiftSessionId },
        },
      });

      return expense;
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[pos/expenses] Error:', error);
    const message = error instanceof Error ? error.message : 'Gagal mencatat pengeluaran';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const shiftSessionId = req.nextUrl.searchParams.get('shiftSessionId');
    
    const expenses = await prisma.expense.findMany({
      where: shiftSessionId ? { shiftSessionId } : {},
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ data: expenses });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal memuat data pengeluaran' }, { status: 500 });
  }
}
