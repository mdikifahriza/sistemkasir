import { prisma } from '@/lib/prisma';

let cachedStoreId: string | null = null;

export async function getStoreId(): Promise<string> {
  if (cachedStoreId) return cachedStoreId;
  const store = await prisma.store.findFirstOrThrow({
    select: { id: true },
  });
  cachedStoreId = store.id;
  return cachedStoreId;
}
