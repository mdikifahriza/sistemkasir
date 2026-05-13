import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrderingAppBaseUrl } from '@/lib/runtimeConfig';
import { requireRole, requireSession } from '@/lib/serverAuth';
import { ACTIVE_ORDER_STATUSES, getOperationalTableStatus } from '@/lib/tableStatus';

/**
 * Generates the QR code URL for a given table, pointing to the ordering app.
 */
async function buildQrCodeUrl(tableId: string): Promise<string> {
  return `${await getOrderingAppBaseUrl()}?tableId=${tableId}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const tables = await prisma.table.findMany({
      where: {},
      orderBy: { name: 'asc' },
      include: {
        orders: {
          where: { status: { in: ACTIVE_ORDER_STATUSES } },
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });

    // Compute live status based on active orders
    const data = tables.map((table) => ({
      ...table,
      status: getOperationalTableStatus(table.status, table.orders.length),
      activeOrderCount: table.orders.length,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat meja';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) {
      return roleError;
    }

    const { name, status } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Nama meja wajib diisi' }, { status: 400 });
    }



    const newTable = await prisma.table.create({
      data: {
        name,
        status: status || 'available',
        qrCodeUrl: '',
      },
    });

    const updatedTable = await prisma.table.update({
      where: { id: newTable.id },
      data: {
        qrCodeUrl: await buildQrCodeUrl(newTable.id),
      },
    });

    return NextResponse.json({ data: updatedTable });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membuat meja';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) {
      return roleError;
    }

    const { id, name, status } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Table ID is required' }, { status: 400 });
    }

    const existingTable = await prisma.table.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingTable) {
      return NextResponse.json({ error: 'Meja tidak ditemukan' }, { status: 404 });
    }

    const allowedStatuses = ['available', 'occupied', 'reserved', 'inactive', 'maintenance'];
    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name;
    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json({ error: 'Status meja tidak valid' }, { status: 400 });
      }
      updateData.status = status;
    }

    const updatedTable = await prisma.table.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updatedTable });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui meja';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = requireSession(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const roleError = requireRole(session, ['owner', 'manager']);
    if (roleError) {
      return roleError;
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const table = await prisma.table.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!table) {
      return NextResponse.json({ error: 'Meja tidak ditemukan' }, { status: 404 });
    }

    const orderCount = await prisma.order.count({
      where: { tableId: id },
    });

    if (orderCount > 0) {
      return NextResponse.json(
        {
          error: `Meja tidak bisa dihapus karena sudah pernah digunakan untuk ${orderCount} transaksi. Silakan ubah status ke 'Nonaktif' jika meja sudah tidak digunakan.`,
        },
        { status: 409 }
      );
    }

    await prisma.table.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus meja';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
