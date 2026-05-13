import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createId } from '@/lib/utils/id';
import { mapToCamel } from '@/lib/utils/case';
import { clearAllIndexedDbDatabases } from '@/lib/browser/indexedDb';
import { assertOnline, OFFLINE_DISABLED_MESSAGE } from '@/lib/network';

type LogoutOptions = {
  redirectToLogin?: boolean;
};

interface AuthState {
  userId: string | null;
  role: string | null;
  fullName: string | null;
  token: string | null;
  isAuthenticated: boolean;
  loginId: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      role: null,
      fullName: null,
      token: null,
      isAuthenticated: false,
      loginId: null,
      login: async (username, password) => {
        assertOnline('Koneksi internet diperlukan untuk login.');

        let res: Response;
        try {
          res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(OFFLINE_DISABLED_MESSAGE);
          }
          throw error;
        }

        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || 'Nama pengguna atau kata sandi salah');
        }

        const payload = (await res.json()) as { data: { user: Record<string, unknown> } };
        const user = mapToCamel(payload.data.user) as { id: string; role: string; fullName: string };

        set({
          userId: user.id,
          role: user.role ?? null,
          fullName: user.fullName ?? null,
          token: createId('token'),
          isAuthenticated: true,
          loginId: createId('login'),
        });
      },
      logout: async (options) => {
        const shouldRedirect = options?.redirectToLogin ?? true;

        set({
          userId: null,
          role: null,
          fullName: null,
          token: null,
          isAuthenticated: false,
          loginId: null,
        });

        const cleanupTasks = [
          fetch('/api/auth/logout', { method: 'POST', keepalive: true }).catch(() => undefined),
          clearAllIndexedDbDatabases().catch(() => undefined),
          import('@/store/dataStore')
            .then(({ useDataStore }) => useDataStore.getState().reset())
            .catch(() => undefined),
        ];

        await Promise.allSettled(cleanupTasks);

        if (shouldRedirect && typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      },
    }),
    {
      name: 'pos-pro-auth',
    }
  )
);
