'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, Typography } from 'antd';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { Sidebar } from '@/components/layouts/Sidebar';
import { Header } from '@/components/layouts/Header';
import { useConnectivity } from '@/components/providers/ConnectivityProvider';
import { useAuthStore } from '@/store/authStore';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { useDataStore } from '@/store/dataStore';
import { OFFLINE_BOOTSTRAP_MESSAGE, isLikelyNetworkError, isOfflineErrorMessage } from '@/lib/network';

const { Text } = Typography;

import { NotificationProvider } from '@/components/providers/NotificationProvider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { isOnline, offlineMessage } = useConnectivity();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const loginId = useAuthStore((state) => state.loginId);
  const logout = useAuthStore((state) => state.logout);
  const isReady = useDataStore((state) => state.isReady);
  const isLoading = useDataStore((state) => state.isLoading);
  const error = useDataStore((state) => state.error);
  const bootstrap = useDataStore((state) => state.bootstrap);
  const [isSessionValidated, setIsSessionValidated] = useState(false);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      setIsSessionValidated(false);
      router.replace('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !isOnline) {
      return;
    }

    let isCancelled = false;
    setIsSessionValidated(false);

    void (async () => {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (response.status === 401) {
          await logout({ redirectToLogin: true });
          return;
        }

        if (!response.ok) {
          return;
        }

        if (!isCancelled) {
          setIsSessionValidated(true);
        }
      } catch (networkError) {
        if (!isCancelled && networkError instanceof Error && isLikelyNetworkError(networkError)) {
          return;
        }

        await logout({ redirectToLogin: true });
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [hydrated, isAuthenticated, isOnline, loginId, logout]);

  useEffect(() => {
    const canRetryBootstrap = !error || isOfflineErrorMessage(error);

    if (hydrated && isAuthenticated && isOnline && isSessionValidated && !isReady && !isLoading && canRetryBootstrap) {
      bootstrap();
    }
  }, [hydrated, isAuthenticated, isOnline, isSessionValidated, isReady, isLoading, error, bootstrap]);

  if (!hydrated) {
    return <div className="min-h-screen bg-app" />;
  }

  if (!isAuthenticated) {
    return <div className="min-h-screen bg-app" />;
  }

  if (!isOnline && !isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-4">
        <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-red-200 bg-white px-6 py-8 text-center shadow-xl dark:border-red-900/40 dark:bg-[#141414]">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <WifiOff className="h-7 w-7" />
          </span>
          <div className="space-y-2">
            <p className="m-0 text-xs font-bold uppercase tracking-[0.28em] text-red-500">Mode Full Online</p>
            <h2 className="m-0 text-xl font-black">Internet terputus</h2>
            <p className="m-0 text-sm text-slate-500">{error || OFFLINE_BOOTSTRAP_MESSAGE}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isSessionValidated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 dark:border-[#303030] dark:bg-[#141414]">
          <div className="flex flex-col items-center gap-3">
            {!isOnline ? (
              <>
                <WifiOff className="h-7 w-7 text-red-500" />
                <Text type="secondary">{offlineMessage}</Text>
              </>
            ) : (
              <>
                <Spin size="large" />
                <Text type="secondary">Memverifikasi sesi...</Text>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 dark:border-[#303030] dark:bg-[#141414]">
          <div className="flex flex-col items-center gap-3">
            {error ? (
              <Text type="danger">Gagal memuat data: {error}</Text>
            ) : (
              <>
                <Spin size="large" />
                <Text type="secondary">Memuat data...</Text>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen bg-app">
      <NotificationProvider>
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col overflow-x-clip">
          <Header />
          <main className="flex-1 overflow-y-auto overflow-x-clip">{children}</main>
        </div>
      </NotificationProvider>

      {!isOnline ? (
        <div className="absolute inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white px-6 py-6 shadow-2xl dark:border-red-900/50 dark:bg-[#141414]">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <div className="space-y-2">
                  <p className="m-0 text-xs font-bold uppercase tracking-[0.24em] text-red-500">Fitur Dikunci</p>
                  <h2 className="m-0 text-lg font-black">Koneksi internet terputus</h2>
                  <p className="m-0 text-sm text-slate-500">{offlineMessage}</p>
                  <p className="m-0 text-xs text-slate-400">
                    Aplikasi akan aktif lagi otomatis setelah koneksi kembali.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
