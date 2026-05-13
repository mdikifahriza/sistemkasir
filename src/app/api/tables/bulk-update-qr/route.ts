import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrderingAppBaseUrl } from '@/lib/runtimeConfig';
import { requireRole, requireSession } from '@/lib/serverAuth';

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

    const orderingBaseUrl = await getOrderingAppBaseUrl();
    const tables = await prisma.table.findMany({
      select: { id: true },
    });

    const updates = tables.map((table) =>
      prisma.table.update({
        where: { id: table.id },
        data: {
          qrCodeUrl: `${orderingBaseUrl}/?tableId=${table.id}`,
        },
      })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ success: true, count: tables.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui semua QR';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
