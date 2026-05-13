import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/serverAuth';
import { rateLimit } from '@/lib/rateLimit';

const categorySelect = {
  id: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const limitResult = rateLimit(`bootstrap_${session.userId}`, 20, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Batas permintaan API terlampaui. Tunggu beberapa saat.' },
        { status: 429, headers: limitResult.headers }
      );
    }

    const store = await prisma.store.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!store) {
      return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 });
    }

    const [
      users,
      categories,
      products,
      shifts,
      shiftSessions,
      shiftEmployees,
      shiftCashTransfers,
      transactions,
      transactionDetails,
      expenses,
      expenseCategories,
      activityLogs,
      tables,
      orders,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: categorySelect,
      }),
      prisma.product.findMany({
        include: {
          category: {
            select: categorySelect,
          },
        },
      }),
      prisma.shift.findMany(),
      prisma.shiftSession.findMany({
        take: 50,
        orderBy: { openedAt: 'desc' },
      }),
      prisma.shiftEmployee.findMany({ take: 200, orderBy: { createdAt: 'desc' } }),
      prisma.shiftCashTransfer.findMany({ take: 100, orderBy: { createdAt: 'desc' } }),
      prisma.transaction.findMany({ take: 100, orderBy: { createdAt: 'desc' } }),
      prisma.transactionDetail.findMany({ take: 500 }),
      prisma.expense.findMany({ take: 100, orderBy: { createdAt: 'desc' } }),
      prisma.expenseCategory.findMany(),
      prisma.activityLog.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.table.findMany({ orderBy: { name: 'asc' } }),
      prisma.order.findMany({ take: 200, orderBy: { createdAt: 'desc' } }),
    ]);

    return NextResponse.json({
      data: {
        store,
        users,
        categories,
        products,
        shifts,
        shiftSessions,
        shiftEmployees,
        shiftCashTransfers,
        transactions,
        transactionDetails,
        expenses,
        expenseCategories,
        activityLogs,
        tables,
        orders,
      },
    });
  } catch (error) {
    console.error('Bootstrap Error:', error);
    const message = error instanceof Error ? error.message : 'Bootstrap gagal diproses';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
