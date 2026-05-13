import type { Prisma } from '@prisma/client';

export async function deductStockForOrder(
  _tx: Prisma.TransactionClient,
  orderId: string,
  reason: string
): Promise<void> {
  console.warn('[stockService] Stock deduction skipped: ingredient inventory layer is not active yet', {
    orderId,
    reason,
  });
}

export async function restoreStockForOrder(
  _tx: Prisma.TransactionClient,
  orderId: string,
  previousStatus: string,
  reason: string
): Promise<void> {
  console.warn('[stockService] Stock restoration skipped: ingredient inventory layer is not active yet', {
    orderId,
    previousStatus,
    reason,
  });
}
