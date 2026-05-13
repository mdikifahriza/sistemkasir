'use client';

import { useMemo } from 'react';
import { useDataStore } from '@/store/dataStore';

export function useCurrentShiftState() {
  const currentShiftId = useDataStore((state) => state.currentShiftId);
  const shiftSessions = useDataStore((state) => state.shiftSessions);
  const shifts = useDataStore((state) => state.shifts);
  const isReady = useDataStore((state) => state.isReady);

  return useMemo(() => {
    const currentSession =
      (currentShiftId
        ? shiftSessions.find((session) => session.id === currentShiftId)
        : null) ??
      shiftSessions.find((session) => session.status === 'open') ??
      null;

    const currentShift = currentSession
      ? shifts.find((shift) => shift.id === currentSession.shiftId) ?? null
      : null;

    return {
      currentSession,
      currentShift,
      isShiftOpen: !!currentSession,
      isInitialized: isReady,
    };
  }, [currentShiftId, isReady, shiftSessions, shifts]);
}
