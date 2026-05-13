export const ACTIVE_ORDER_STATUSES = ['pending_payment', 'paid', 'processing', 'ready'];
export const UNAVAILABLE_TABLE_STATUSES = ['inactive', 'maintenance', 'reserved'];

export function getOperationalTableStatus(status: string, activeOrderCount: number): string {
  if (activeOrderCount > 0) {
    return 'occupied';
  }

  return status === 'occupied' ? 'available' : status;
}

export function isTableUnavailableForOrdering(status: string): boolean {
  return UNAVAILABLE_TABLE_STATUSES.includes(status);
}
