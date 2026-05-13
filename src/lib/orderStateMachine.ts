/**
 * Order State Machine
 *
 * Status lifecycle:
 * pending_payment -> paid -> processing -> ready -> completed
 * pending_payment -> cancelled
 * paid -> cancelled
 */

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type UserRole = 'owner' | 'manager' | 'cashier' | 'kitchen' | 'system' | string;

export interface StatusTransition {
  from: OrderStatus;
  to: OrderStatus;
  allowedRoles: Set<string>;
  label: string;
  description: string;
}

const TRANSITIONS: StatusTransition[] = [
  {
    from: 'pending_payment',
    to: 'paid',
    allowedRoles: new Set(['system']),
    label: 'Bayar',
    description: 'Pembayaran diterima via Xendit',
  },
  {
    from: 'pending_payment',
    to: 'cancelled',
    allowedRoles: new Set(['system', 'owner', 'manager']),
    label: 'Batalkan',
    description: 'Pembayaran expired atau dibatalkan manual',
  },
  {
    from: 'paid',
    to: 'processing',
    allowedRoles: new Set(['owner', 'manager', 'cashier', 'kitchen']),
    label: 'Mulai Masak',
    description: 'Dapur mulai mengerjakan pesanan',
  },
  {
    from: 'paid',
    to: 'cancelled',
    allowedRoles: new Set(['owner', 'manager']),
    label: 'Batalkan Pesanan',
    description: 'Pembatalan pesanan yang sudah dibayar',
  },
  {
    from: 'processing',
    to: 'ready',
    allowedRoles: new Set(['owner', 'manager', 'cashier', 'kitchen']),
    label: 'Selesai Masak',
    description: 'Pesanan siap diantar',
  },
  {
    from: 'ready',
    to: 'completed',
    allowedRoles: new Set(['owner', 'manager', 'cashier']),
    label: 'Selesaikan',
    description: 'Pesanan telah selesai',
  },
];

const transitionMap = new Map<string, StatusTransition>();
for (const transition of TRANSITIONS) {
  transitionMap.set(`${transition.from}:${transition.to}`, transition);
}

export function isValidTransition(from: string, to: string): boolean {
  return transitionMap.has(`${from}:${to}`);
}

export function getTransition(from: string, to: string): StatusTransition | null {
  return transitionMap.get(`${from}:${to}`) ?? null;
}

export function validateTransition(
  currentStatus: string,
  targetStatus: string,
  userRole: string
): string | null {
  if (currentStatus === targetStatus) {
    return null;
  }

  const transition = getTransition(currentStatus, targetStatus);
  if (!transition) {
    return `Transisi dari "${currentStatus}" ke "${targetStatus}" tidak diizinkan`;
  }

  if (!transition.allowedRoles.has(userRole)) {
    return `Role "${userRole}" tidak diizinkan untuk transisi ${currentStatus} -> ${targetStatus}`;
  }

  return null;
}

export function getAvailableTransitions(
  currentStatus: string,
  userRole: string
): StatusTransition[] {
  return TRANSITIONS.filter((transition) => {
    return transition.from === currentStatus && transition.allowedRoles.has(userRole);
  });
}

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'pending_payment',
  'paid',
  'processing',
  'ready',
];

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['completed', 'cancelled'];

export const KDS_VISIBLE_STATUSES: OrderStatus[] = ['paid', 'processing', 'ready'];
