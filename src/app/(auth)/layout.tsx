'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useHydrated } from '@/lib/hooks/useHydrated';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [hydrated, isAuthenticated, router]);

  return <div className="min-h-screen bg-app">{children}</div>;
}
