import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ACTIVE_ORDER_STATUSES, getOperationalTableStatus, isTableUnavailableForOrdering } from '@/lib/tableStatus';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tableId } = await params;

    if (!tableId) {
      return NextResponse.json({ error: 'Table ID is required' }, { status: 400 });
    }

    const table = await prisma.table.findUnique({
      where: { id: tableId },
    });

    // --- Validation: Table not found ---
    if (!table) {
      return NextResponse.json(
        { error: 'Meja tidak ditemukan', code: 'TABLE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const store = await prisma.store.findFirst({
      select: {
        id: true,
        name: true,
        logoUrl: true,
        isActive: true,
        currency: true,
        taxPercentage: true,
      },
    });

    // --- Validation: Store not active ---
    if (!store || store.isActive === false) {
      return NextResponse.json(
        { error: 'Toko sedang tidak aktif', code: 'STORE_INACTIVE' },
        { status: 403 }
      );
    }

    // --- Validation: Table not usable (e.g. reserved for maintenance) ---
    if (isTableUnavailableForOrdering(table.status)) {
      return NextResponse.json(
        { error: 'Meja sedang tidak tersedia', code: 'TABLE_UNAVAILABLE' },
        { status: 403 }
      );
    }

    // Include current active orders count for the ordering app to display
    const activeOrderCount = await prisma.order.count({
      where: {
        tableId,
        status: {
          in: [...ACTIVE_ORDER_STATUSES],
        },
      },
    });

    return NextResponse.json({
      data: {
        id: table.id,
        name: table.name,
        status: getOperationalTableStatus(table.status, activeOrderCount),
        store,
        activeOrderCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memvalidasi meja';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
