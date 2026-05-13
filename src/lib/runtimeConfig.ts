import { prisma } from '@/lib/prisma';

export async function getOrderingAppBaseUrl(): Promise<string> {
  const store = await prisma.store.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { orderingAppUrl: true },
  });

  if (!store?.orderingAppUrl) {
    throw new Error('URL Sistem Pemesanan belum diatur di Pengaturan Toko.');
  }

  try {
    return new URL(store.orderingAppUrl).origin;
  } catch {
    throw new Error('URL Sistem Pemesanan tidak valid. Periksa Pengaturan Toko.');
  }
}
