'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { 
  X, Menu, 
  LayoutDashboard, ShoppingCart, Package, Boxes, 
  History, 
  Table, Utensils, UserCog, HandCoins, 
  Receipt, Clock, FileBarChart, PieChart, 
  Settings, Activity
} from 'lucide-react';
import { hasPermission } from '@/lib/utils/permissions';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useDataStore } from '@/store/dataStore';
import { formatRole } from '@/lib/utils/roles';

const navigation = [
  { name: 'Dasbor', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Kasir', href: '/pos', permission: 'transactions.create', icon: ShoppingCart },
  { name: 'Produk', href: '/products', permission: 'products.view', icon: Package },
  { name: 'Kategori', href: '/categories', permission: 'categories.view', icon: Boxes },
  { name: 'Transaksi', href: '/transactions', permission: 'transactions.view', icon: History },
  { name: 'Meja', href: '/tables', icon: Table },
  { name: 'Dapur', href: '/kitchen', icon: Utensils },
  { name: 'Xendit', href: '/xendit', icon: HandCoins },
  { name: 'Karyawan', href: '/employees', permission: 'employees.view', icon: UserCog },
  { name: 'Pengeluaran', href: '/expenses', icon: Receipt },
  { name: 'Shift', href: '/shifts', icon: Clock },
  { name: 'Laporan', href: '/reports', permission: 'reports.view', icon: FileBarChart },
  { name: 'Analitik', href: '/analytics', permission: 'reports.view', icon: PieChart },
  { name: 'Pengaturan', href: '/settings', permission: 'settings.view', icon: Settings },
  { name: 'Log Aktivitas', href: '/activity-logs', permission: 'activity_logs.view', icon: Activity },
];

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const user = useCurrentUser();
  const storeName = useDataStore((state) => state.store.name);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center rounded-md p-2 text-ink hover:bg-surface-3 lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-surface-2 transition-transform duration-300 ease-in-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col px-4 py-6">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-ink-muted">POS PRO</p>
              <p className="text-lg font-semibold text-ink">{storeName}</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-ink-muted hover:bg-surface-3 hover:text-ink"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navigation
              .filter((item) => (item.permission ? hasPermission(user?.role, item.permission) : true))
              .map((item) => {
                const normalizedPath = pathname.replace(/\/$/, '');
                const normalizedHref = item.href.replace(/\/$/, '');
                const active = normalizedPath === normalizedHref || normalizedPath.startsWith(normalizedHref + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={clsx(
                      'flex items-center rounded-md px-3 py-2 text-sm font-medium transition',
                      active
                        ? '!bg-[#10b981] !text-white shadow-lg shadow-emerald-500/20'
                        : 'text-ink-muted hover:bg-surface-3 hover:text-ink'
                    )}
                  >
                    <item.icon 
                      size={18} 
                      className={clsx(
                        'mr-3',
                        active ? '!text-white' : 'text-primary/60'
                      )} 
                    />
                    {item.name}
                  </Link>
                );
              })}
          </nav>

          {/* User Info */}
          <Link
            href="/profile"
            onClick={() => setIsOpen(false)}
            className="mt-6 rounded-lg border border-border bg-surface p-3 text-xs text-ink-muted transition hover:border-[#10b981]/30 hover:bg-surface-3"
          >
            <p className="font-semibold text-ink">Masuk sebagai</p>
            <p>{user?.fullName || 'Pengguna'}</p>
            <p className="uppercase">{formatRole(user?.role)}</p>
            <p className="mt-1 font-semibold uppercase text-[#10b981]">Buka Profil</p>
          </Link>
        </div>
      </aside>
    </>
  );
}
