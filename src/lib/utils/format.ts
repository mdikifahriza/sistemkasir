function toValidDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCurrency(amount: number, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(amount: number) {
  return new Intl.NumberFormat('id-ID').format(amount);
}

export function formatDateTime(value: string | Date) {
  const date = toValidDate(value);
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateOnly(value: string | Date) {
  const date = toValidDate(value);
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function maskAccountNumber(value: string | null | undefined) {
  if (!value) return '-';
  if (value.length <= 4) return value;
  return `****${value.slice(-4)}`;
}
