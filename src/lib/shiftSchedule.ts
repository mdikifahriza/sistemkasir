const TIME_ONLY_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function getMinutesFromTimeParts(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

export function normalizeShiftTimeString(value: string | Date): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}`;
  }

  const trimmed = value.trim();
  const match = TIME_ONLY_PATTERN.exec(trimmed);

  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] || '0');

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      Number.isNaN(seconds) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      return null;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

export function buildShiftTimeDate(value: string): Date | null {
  const normalized = normalizeShiftTimeString(value);
  if (!normalized) {
    return null;
  }

  return new Date(`1970-01-01T${normalized}`);
}

export function formatShiftTimeLabel(value: string | Date | null | undefined): string {
  if (!value) {
    return '-';
  }

  const normalized =
    value instanceof Date
      ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}`
      : normalizeShiftTimeString(value);

  return normalized ? normalized.slice(0, 5) : String(value);
}

function getShiftMinutes(value: string | Date): number | null {
  const normalized = normalizeShiftTimeString(value);
  if (!normalized) {
    return null;
  }

  const [hours, minutes] = normalized.split(':').map(Number);
  return getMinutesFromTimeParts(hours, minutes);
}

function expandIntervals(startMinutes: number, endMinutes: number): Array<[number, number]> {
  if (startMinutes === endMinutes) {
    return [];
  }

  if (endMinutes > startMinutes) {
    return [[startMinutes, endMinutes]];
  }

  return [
    [startMinutes, 24 * 60],
    [0, endMinutes],
  ];
}

function intervalsOverlap(left: [number, number], right: [number, number]): boolean {
  return left[0] < right[1] && right[0] < left[1];
}

export function hasShiftTimeOverlap(
  shifts: Array<{ id?: string; shiftName?: string; startTime: string | Date; endTime: string | Date }>,
  candidate: { startTime: string; endTime: string },
  excludeId?: string
): boolean {
  const startMinutes = getShiftMinutes(candidate.startTime);
  const endMinutes = getShiftMinutes(candidate.endTime);

  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return true;
  }

  const candidateIntervals = expandIntervals(startMinutes, endMinutes);

  return shifts.some((shift) => {
    if (excludeId && shift.id === excludeId) {
      return false;
    }

    const shiftStartMinutes = getShiftMinutes(shift.startTime);
    const shiftEndMinutes = getShiftMinutes(shift.endTime);

    if (shiftStartMinutes === null || shiftEndMinutes === null || shiftStartMinutes === shiftEndMinutes) {
      return false;
    }

    const existingIntervals = expandIntervals(shiftStartMinutes, shiftEndMinutes);
    return candidateIntervals.some((candidateInterval) =>
      existingIntervals.some((existingInterval) => intervalsOverlap(candidateInterval, existingInterval))
    );
  });
}
