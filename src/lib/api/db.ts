import { assertOnline, OFFLINE_DISABLED_MESSAGE, isLikelyNetworkError } from '@/lib/network';
import { useAuthStore } from '@/store/authStore';

export async function dbRequest<T>(payload: {
  action: 'select' | 'insert' | 'update' | 'delete';
  table: string;
  match?: Record<string, any>;
  data?: any;
  order?: { column: string; ascending?: boolean };
  single?: boolean;
}) {
  assertOnline();

  let res: Response;
  try {
    res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (isLikelyNetworkError(error)) {
      throw new Error(OFFLINE_DISABLED_MESSAGE);
    }
    throw error;
  }

  if (!res.ok) {
    if (res.status === 401) {
      void useAuthStore.getState().logout({ redirectToLogin: true });
      throw new Error('Sesi login telah berakhir. Silakan login kembali.');
    }

    const fallbackResponse = res.clone();
    let payloadError = '';
    try {
      const payload = (await res.json()) as { error?: string };
      payloadError = payload?.error || '';
    } catch {
      // fallback ke text body di bawah
    }

    if (payloadError) {
      throw new Error(payloadError);
    }

    const message = await fallbackResponse.text();
    throw new Error(message || 'Gagal terhubung ke server database');
  }

  const data = (await res.json()) as { data: T };
  return data.data;
}
