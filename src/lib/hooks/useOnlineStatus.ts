'use client';

import { useEffect, useState } from 'react';
import { isBrowserOnline } from '@/lib/network';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(isBrowserOnline());
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return isOnline;
}
