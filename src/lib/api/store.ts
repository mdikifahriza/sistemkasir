/**
 * Legacy Supabase API adapter.
 * 
 * Routes requests through the /api/db endpoint instead of direct Supabase access.
 * This maintains backward compatibility with settingsStore while using the unified API.
 */
import { assertOnline, OFFLINE_DISABLED_MESSAGE, isLikelyNetworkError } from '@/lib/network';
import { useAuthStore } from '@/store/authStore';

export async function storeRequest<T = any>(params: {
  action: 'select' | 'insert' | 'update' | 'delete';
  table: string;
  match?: Record<string, any>;
  data?: any;
  single?: boolean;
  order?: { column: string; ascending?: boolean };
}): Promise<T> {
  assertOnline();

  let res: Response;
  try {
    res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (error) {
    if (isLikelyNetworkError(error)) {
      throw new Error(OFFLINE_DISABLED_MESSAGE);
    }
    throw error;
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      void useAuthStore.getState().logout({ redirectToLogin: true });
      throw new Error('Sesi login telah berakhir. Silakan login kembali.');
    }
    throw new Error(payload.error || 'Database request failed');
  }

  return payload.data as T;
}
