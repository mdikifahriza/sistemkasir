'use client';

import { Menu, LogOut } from 'lucide-react';
import { Button, Tag } from 'antd';
import { useCurrentShiftState } from '@/lib/hooks/useCurrentShiftState';
import { useAuthStore } from '@/store/authStore';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useDataStore } from '@/store/dataStore';
import { formatRole } from '@/lib/utils/roles';
import { normalizeShiftTimeString } from '@/lib/shiftSchedule';
import { useUIStore } from '@/store/uiStore';

const ACTIVE_ORDER_STATUSES = new Set(['pending_payment', 'paid', 'processing', 'ready']);

function buildShiftDateTime(baseValue: string | null | undefined, timeValue: string | null | undefined) {
  if (!baseValue || !timeValue) {
    return null;
  }

  const baseDate = new Date(baseValue);
  const normalizedTime = normalizeShiftTimeString(timeValue);

  if (Number.isNaN(baseDate.getTime()) || !normalizedTime) {
    return null;
  }

  const [hours, minutes, seconds] = normalizedTime.split(':').map(Number);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, seconds, 0);

  return Number.isNaN(result.getTime()) ? null : result;
}

export function Header() {
  const logout = useAuthStore((state) => state.logout);
  const user = useCurrentUser();
  const { currentSession, currentShift } = useCurrentShiftState();
  const orders = useDataStore((state) => state.orders);
  const tables = useDataStore((state) => state.tables);
  const { toggleSidebar } = useUIStore();

  const activeOrders = orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status));
  const readyOrders = activeOrders.filter((order) => order.status === 'ready').length;
  const occupiedTableIds = new Set(activeOrders.map((order) => order.tableId).filter(Boolean));
  const occupiedTables = Math.max(
    tables.filter((table) => table.status === 'occupied').length,
    occupiedTableIds.size
  );

  const overtimeInfo = (() => {
    if (!currentSession || !currentShift) return null;

    const baseDate = currentSession.openedAt || currentSession.sessionDate;
    const startDate = buildShiftDateTime(baseDate, currentShift.startTime);
    const endDate = buildShiftDateTime(baseDate, currentShift.endTime);

    if (!startDate || !endDate) return null;

    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const now = new Date();
    if (now <= endDate) return null;

    const minutes = Math.floor((now.getTime() - endDate.getTime()) / 60000);
    if (!Number.isFinite(minutes) || minutes < 0) {
      return null;
    }

    return { minutes };
  })();

  const overtimeLabel = overtimeInfo
    ? (() => {
        const hours = Math.floor(overtimeInfo.minutes / 60);
        const minutes = overtimeInfo.minutes % 60;
        if (hours > 0) {
          return `Over jam ${hours}j ${minutes}m`;
        }
        return `Over jam ${minutes}m`;
      })()
    : null;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-3 py-3 backdrop-blur-md dark:border-[#303030] dark:bg-[#141414]/80 md:px-6 md:py-4">
      <div className="flex items-center">
        <Button
          type="text"
          icon={<Menu size={20} />}
          onClick={toggleSidebar}
          className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 dark:border-[#303030]"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 font-sans md:gap-3">
        <Tag color={currentSession ? 'success' : 'warning'} className="m-0">
          {currentSession ? 'Shift Buka' : 'Shift Tutup'}
        </Tag>
        {readyOrders > 0 ? (
          <Tag color="success" className="m-0 hidden lg:inline-flex">
            {readyOrders} Siap Antar
          </Tag>
        ) : null}
        {occupiedTables > 0 ? (
          <Tag color="warning" className="m-0 hidden xl:inline-flex">
            {occupiedTables}/{tables.length || 0} Meja Terpakai
          </Tag>
        ) : null}
        {overtimeLabel ? (
          <Tag color="error" className="m-0 hidden md:inline-flex">
            {overtimeLabel}
          </Tag>
        ) : null}

        <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 dark:border-[#303030] md:pl-4 lg:flex">
          <div className="hidden text-right lg:block">
            <p className="m-0 text-sm font-bold leading-tight">{user?.fullName || 'Pengguna'}</p>
            <p className="m-0 text-[10px] font-bold uppercase tracking-tight text-slate-500">
              {formatRole(user?.role)}
            </p>
          </div>
        </div>

        <Button
          danger
          onClick={() => void logout()}
          icon={<LogOut size={16} />}
          className="h-10 w-10 shrink-0 border-red-200 bg-red-50 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 sm:h-auto sm:w-auto sm:px-4"
        >
          <span className="hidden sm:inline">Keluar</span>
        </Button>
      </div>
    </header>
  );
}
