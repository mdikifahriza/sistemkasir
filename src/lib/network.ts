export const OFFLINE_DISABLED_MESSAGE =
  'Koneksi internet terputus. Semua fitur dinonaktifkan sampai koneksi kembali.';

export const OFFLINE_BOOTSTRAP_MESSAGE =
  'Koneksi internet terputus. Data online belum bisa dimuat sampai koneksi kembali.';

export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export function assertOnline(message: string = OFFLINE_DISABLED_MESSAGE): void {
  if (!isBrowserOnline()) {
    throw new Error(message);
  }
}

export function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /failed to fetch|networkerror|load failed|fetch failed/i.test(error.message);
}

export function isOfflineErrorMessage(message?: string | null): boolean {
  if (!message) {
    return false;
  }

  return (
    message === OFFLINE_DISABLED_MESSAGE ||
    message === OFFLINE_BOOTSTRAP_MESSAGE ||
    /koneksi internet terputus/i.test(message)
  );
}
