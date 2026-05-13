import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useDataStore } from '@/store/dataStore';

export function useCurrentUser() {
  const userId = useAuthStore((state) => state.userId);
  const users = useDataStore((state) => state.users);

  return useMemo(() => users.find((user) => user.id === userId) || null, [users, userId]);
}
