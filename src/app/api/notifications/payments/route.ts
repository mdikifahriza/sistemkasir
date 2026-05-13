import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/serverAuth';

function parseSince(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const since = parseSince(req.nextUrl.searchParams.get('since'));

    const rows = await prisma.transaction.findMany({
      where: {
        paymentMethod: 'xendit',
        status: 'completed',
        ...(since ? { updatedAt: { gte: since } } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        totalAmount: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: since ? 20 : 10,
    });

    return NextResponse.json({
      data: rows.reverse().map((item) => ({
        id: item.id,
        invoiceNumber: item.invoiceNumber,
        customerName: item.customerName,
        totalAmount: Number(item.totalAmount),
        updatedAt: item.updatedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
