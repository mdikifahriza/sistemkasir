'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  X, Sun, Moon, LogOut, 
  LayoutDashboard, ShoppingCart, Package, Boxes, 
  History, 
  Table as TableIcon, Utensils, UserCog, HandCoins, 
  Receipt, Clock, FileBarChart, PieChart, 
  Settings, Activity
} from 'lucide-react';
import { hasPermission } from '@/lib/utils/permissions';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useDataStore } from '@/store/dataStore';
import { formatRole } from '@/lib/utils/roles';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { Drawer, Button } from 'antd';

const navigation = [
  { name: 'Dasbor', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Kasir', href: '/pos', permission: 'transactions.create', icon: ShoppingCart },
  { name: 'Menu & Produk', href: '/products-categories', permission: 'products.view', icon: Package },
  { name: 'Transaksi', href: '/transactions', permission: 'transactions.view', icon: History },
  { name: 'Meja', href: '/tables', icon: TableIcon },
  { name: 'Dapur', href: '/kitchen', icon: Utensils },
  { name: 'Karyawan', href: '/employees', permission: 'employees.view', icon: UserCog },
  { name: 'Pengeluaran', href: '/expenses', icon: Receipt },
  { name: 'Xendit', href: '/xendit', icon: HandCoins },
  { name: 'Shift', href: '/shifts', icon: Clock },
  { name: 'Laporan', href: '/reports', permission: 'reports.view', icon: FileBarChart },
  { name: 'Analitik', href: '/analytics', permission: 'reports.view', icon: PieChart },
  { name: 'Pengaturan', href: '/settings', permission: 'settings.view', icon: Settings },
  { name: 'Log Aktivitas', href: '/activity-logs', permission: 'activity_logs.view', icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const storeName = useDataStore((state) => state.store.name);
  const { isSidebarOpen, setSidebarOpen, theme, toggleTheme } = useUIStore();
  const logout = useAuthStore((state) => state.logout);

  return (
    <Drawer
      placement="left"
      closable={false}
      onClose={() => setSidebarOpen(false)}
      open={isSidebarOpen}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100%' },
        wrapper: {
          width: 'min(20rem, calc(100vw - 1rem))',
          maxWidth: 'calc(100vw - 1rem)',
        }
      }}
      className="bg-white dark:bg-[#141414]"
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4 dark:border-[#303030] dark:bg-[#1f1f1f] sm:p-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#10b981]">POS PRO SYSTEM</p>
          <p className="max-w-[11rem] truncate text-lg font-black tracking-tight">{storeName}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="text"
            icon={theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            onClick={toggleTheme}
            className="flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-[#303030] transition-colors text-slate-500"
          />
          <Button
            type="text"
            icon={<X size={18} />}
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-[#303030] transition-colors text-slate-500"
          />
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-3 pb-6 sm:p-4">
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
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 ${
                  active
                    ? '!bg-[#10b981] !text-white shadow-lg shadow-emerald-500/20 scale-[1.02]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1f1f1f] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <item.icon 
                  size={20} 
                  className={`mr-3 transition-transform group-hover:scale-110 ${
                    active ? "!text-white" : "text-[#10b981]"
                  }`} 
                />
                {item.name}
              </Link>
            );
          })}
      </nav>

      <div className="space-y-3 border-t border-slate-200 bg-slate-50/50 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-[#303030] dark:bg-[#1f1f1f]/50">
        <Link
          href="/profile"
          onClick={() => setSidebarOpen(false)}
          className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-[#10b981]/30 hover:shadow-md dark:border-[#303030] dark:bg-[#141414]"
        >
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-[#10b981]/10 flex items-center justify-center text-[#10b981] font-bold border border-[#10b981]/20">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate text-sm leading-none mb-1">{user?.fullName || 'Pengguna'}</p>
            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wide">{formatRole(user?.role)}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#10b981]">Buka Profil</p>
          </div>
        </Link>

        <Button
          danger
          block
          icon={<LogOut size={16} />}
          onClick={() => {
            logout();
            setSidebarOpen(false);
          }}
          className="h-auto p-3 flex items-center justify-center font-black transition-all duration-300"
        >
          KELUAR SISTEM
        </Button>
      </div>
    </Drawer>
  );
}
