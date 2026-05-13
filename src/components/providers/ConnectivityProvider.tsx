'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { WifiOff } from 'lucide-react';
import { OFFLINE_DISABLED_MESSAGE } from '@/lib/network';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

type ConnectivityContextValue = {
  isOnline: boolean;
  isOffline: boolean;
  offlineMessage: string;
};

const ConnectivityContext = createContext<ConnectivityContextValue>({
  isOnline: true,
  isOffline: false,
  offlineMessage: OFFLINE_DISABLED_MESSAGE,
});

export function useConnectivity() {
  return useContext(ConnectivityContext);
}

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();

  return (
    <ConnectivityContext.Provider
      value={{
        isOnline,
        isOffline: !isOnline,
        offlineMessage: OFFLINE_DISABLED_MESSAGE,
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
}

export function ConnectivityBanner() {
  const { isOffline, offlineMessage } = useConnectivity();

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[70] border-b border-red-300 bg-red-600/95 px-4 py-3 text-white shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
          <WifiOff className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.24em] text-red-100">
            Koneksi Terputus
          </p>
          <p className="m-0 truncate text-sm font-medium">{offlineMessage}</p>
        </div>
      </div>
    </div>
  );
}
