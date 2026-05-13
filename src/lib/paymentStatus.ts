import { Prisma } from '@prisma/client';

export type NormalizedPaymentStatus =
  | 'pending'
  | 'paid'
  | 'expired'
  | 'failed'
  | 'voided';

export const PAID_ORDER_STATUSES = new Set(['paid', 'processing', 'ready', 'completed']);
export const FINAL_PAYMENT_STATUSES = new Set(['paid', 'expired', 'failed', 'voided']);

const UUID_PREFIX_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function pickFirstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function normalizePaymentStatus(
  status?: string | null
): NormalizedPaymentStatus {
  const normalized = status?.trim().toUpperCase();

  switch (normalized) {
    case 'PAID':
    case 'SETTLED':
    case 'COMPLETED':
    case 'SUCCEEDED':
      return 'paid';
    case 'EXPIRED':
      return 'expired';
    case 'FAILED':
      return 'failed';
    case 'VOIDED':
    case 'CANCELED':
    case 'CANCELLED':
    case 'REFUNDED':
      return 'voided';
    default:
      return 'pending';
  }
}

export function toBillPaymentStatus(
  status?: string | null
): 'UNPAID' | 'PAID' | 'REFUNDED' | 'VOID' {
  const rawStatus = status?.trim().toUpperCase();

  switch (normalizePaymentStatus(status)) {
    case 'paid':
      return 'PAID';
    case 'voided':
      return rawStatus === 'REFUNDED' ? 'REFUNDED' : 'VOID';
    default:
      return 'UNPAID';
  }
}

export function toPaymentRecordStatus(
  status?: string | null
): 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED' {
  const rawStatus = status?.trim().toUpperCase();

  switch (rawStatus) {
    case 'PAID':
    case 'SETTLED':
    case 'COMPLETED':
    case 'SUCCEEDED':
      return 'PAID';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'FAILED':
      return 'FAILED';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'VOIDED':
    case 'CANCELED':
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

export function toXenditPaymentStatus(
  status?: string | null
): 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' {
  const rawStatus = status?.trim().toUpperCase();

  switch (rawStatus) {
    case 'PAID':
    case 'SETTLED':
    case 'COMPLETED':
    case 'SUCCEEDED':
      return 'PAID';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'FAILED':
      return 'FAILED';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'VOIDED':
    case 'CANCELED':
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

export function isPaymentSuccess(status?: string | null): boolean {
  return normalizePaymentStatus(status) === 'paid';
}

export function isPaymentTerminal(status?: string | null): boolean {
  return FINAL_PAYMENT_STATUSES.has(normalizePaymentStatus(status));
}

export function parsePaymentDate(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function extractTransactionIdFromExternalId(
  externalId: string | null
): string | null {
  if (!externalId) {
    return null;
  }

  const match = externalId.match(UUID_PREFIX_PATTERN);
  return match ? match[0] : null;
}

export function buildPaymentMethodFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const body = raw as Record<string, unknown>;
  const nestedData =
    body.data && typeof body.data === 'object'
      ? (body.data as Record<string, unknown>)
      : null;
  const paymentDetails =
    body.paymentDetails && typeof body.paymentDetails === 'object'
      ? (body.paymentDetails as Record<string, unknown>)
      : null;
  const nestedPaymentDetails =
    nestedData?.paymentDetails && typeof nestedData.paymentDetails === 'object'
      ? (nestedData.paymentDetails as Record<string, unknown>)
      : null;

  const parts = [
    pickFirstString(body.paymentMethod, body.payment_method, nestedData?.paymentMethod, nestedData?.payment_method),
    pickFirstString(body.paymentChannel, body.payment_channel, nestedData?.paymentChannel, nestedData?.payment_channel),
    pickFirstString(paymentDetails?.source, nestedPaymentDetails?.source),
    pickFirstString(body.ewalletType, body.ewallet_type, nestedData?.ewalletType, nestedData?.ewallet_type),
    pickFirstString(body.bankCode, body.bank_code, nestedData?.bankCode, nestedData?.bank_code),
  ].filter((value): value is string => Boolean(value?.trim()));

  const uniqueParts = Array.from(new Set(parts.map((value) => value.trim())));
  return uniqueParts.length > 0 ? uniqueParts.join(' / ') : null;
}

export function extractFeeAmountFromRaw(raw: unknown): number {
  if (!raw || typeof raw !== 'object') {
    return 0;
  }

  const body = raw as Record<string, unknown>;
  const candidateFees = [
    body.fees,
    body.data && typeof body.data === 'object'
      ? (body.data as Record<string, unknown>).fees
      : null,
  ];

  for (const candidate of candidateFees) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    return candidate.reduce((total, fee) => {
      if (!fee || typeof fee !== 'object') {
        return total;
      }

      const value = (fee as { value?: unknown }).value;
      return total + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
    }, 0);
  }

  return 0;
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
