'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Tag, Typography } from 'antd';
import { useConnectivity } from '@/components/providers/ConnectivityProvider';
import { useCurrentShiftState } from '@/lib/hooks/useCurrentShiftState';
import { formatCurrency } from '@/lib/utils/format';
import { useDataStore } from '@/store/dataStore';
import { PageHeader } from '@/components/widgets/PageHeader';
import { StatCard } from '@/components/widgets/StatCard';

const { Title } = Typography;

const ACTIVE_ORDER_STATUSES = new Set(['pending_payment', 'paid', 'processing', 'ready']);

type ReportSummary = {
  totalSales: number;
  totalRefunds: number;
  netSales: number;
  totalExpenses: number;
  netIncome: number;
  completedTransactions: number;
};

type TopProduct = {
  productId: string | null;
  productName: string;
  totalRevenue: number;
  totalQty: number;
};

type DailyTrend = {
  date: string;
  total: number;
  count: number;
};

type ReportPayload = {
  summary: ReportSummary;
  topProducts: TopProduct[];
  dailyTrend: DailyTrend[];
};

function toDayKey(value?: string | null): string {
  if (!value) {
    return '';
  }

  return new Date(value).toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { isOnline } = useConnectivity();
  const store = useDataStore((state) => state.store);
  const orders = useDataStore((state) => state.orders);
  const tables = useDataStore((state) => state.tables);
  const transactions = useDataStore((state) => state.transactions);
  const { currentSession } = useCurrentShiftState();

  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (!store.id || !isOnline) {
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    let cancelled = false;

    const fetchReport = async () => {
      setLoadingReport(true);
      try {
        const res = await fetch(
          `/api/reports/summary?from=${monthStart}&to=${today}`
        );

        if (!res.ok) {
          return;
        }

        const payload = (await res.json()) as { data?: ReportPayload };
        if (!cancelled && payload.data) {
          setReport(payload.data);
        }
      } catch {
        if (!cancelled) {
          setReport(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingReport(false);
        }
      }
    };

    void fetchReport();

    return () => {
      cancelled = true;
    };
  }, [isOnline, store.id]);

  const activeOrders = useMemo(
    () =>
      orders
        .filter((order) => ACTIVE_ORDER_STATUSES.has(order.status))
        .sort(
          (left, right) =>
            new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime()
        ),
    [orders]
  );

  const occupiedTableIds = useMemo(
    () => new Set(activeOrders.map((order) => order.tableId).filter(Boolean)),
    [activeOrders]
  );

  const tableNames = useMemo(
    () => new Map(tables.map((table) => [table.id, table.name])),
    [tables]
  );

  const linkedTransactionIds = useMemo(
    () => new Set(orders.map((order) => order.transactionId).filter(Boolean)),
    [orders]
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const manualTransactionsToday = useMemo(
    () =>
      transactions.filter((transaction) => {
        const isToday = toDayKey(transaction.transactionDate) === todayKey;
        const isManual = !linkedTransactionIds.has(transaction.id);
        return isToday && isManual && transaction.status === 'completed';
      }),
    [linkedTransactionIds, todayKey, transactions]
  );

  const pendingPaymentCount = activeOrders.filter((order) => order.status === 'pending_payment').length;
  const paidWaitingKitchenCount = activeOrders.filter((order) => order.status === 'paid').length;
  const processingCount = activeOrders.filter((order) => order.status === 'processing').length;
  const readyCount = activeOrders.filter((order) => order.status === 'ready').length;
  const currentSessionSales = currentSession
    ? Number(currentSession.totalCashSales) +
      Number(currentSession.totalDigitalSales) +
      Number(currentSession.totalCashlessOther)
    : 0;
  const maxDaily = Math.max(...(report?.dailyTrend.map((item) => item.total) ?? [0]), 1);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Dasbor"
        subtitle={`Ringkasan operasional ${store.name || 'toko'} untuk flow restoran`}
        actions={
          currentSession ? (
            <Tag color="success" className="border-none font-bold uppercase tracking-wider">
              Shift aktif
            </Tag>
          ) : (
            <Tag color="warning" className="border-none font-bold uppercase tracking-wider">
              Shift belum dibuka
            </Tag>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net Penjualan Bulan Ini"
          value={report ? formatCurrency(report.summary.netSales, store.currency) : '—'}
        />
        <StatCard label="Pesanan Aktif" value={activeOrders.length.toString()} />
        <StatCard label="Meja Terpakai" value={`${occupiedTableIds.size}/${tables.length || 0}`} />
        <StatCard label="Transaksi POS Hari Ini" value={manualTransactionsToday.length.toString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm dark:border-[#303030] lg:col-span-2">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">Operasional Restoran</p>
          <Title level={5} className="!mb-4 !mt-1">
            Status Layanan Saat Ini
          </Title>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#303030] dark:bg-[#1f1f1f]">
              <p className="m-0 text-xs font-bold uppercase text-slate-500">Menunggu Bayar</p>
              <p className="m-0 mt-2 text-2xl font-black">{pendingPaymentCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#303030] dark:bg-[#1f1f1f]">
              <p className="m-0 text-xs font-bold uppercase text-slate-500">Menunggu Dapur</p>
              <p className="m-0 mt-2 text-2xl font-black">{paidWaitingKitchenCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#303030] dark:bg-[#1f1f1f]">
              <p className="m-0 text-xs font-bold uppercase text-slate-500">Sedang Dimasak</p>
              <p className="m-0 mt-2 text-2xl font-black">{processingCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#303030] dark:bg-[#1f1f1f]">
              <p className="m-0 text-xs font-bold uppercase text-slate-500">Siap Antar</p>
              <p className="m-0 mt-2 text-2xl font-black">{readyCount}</p>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-[#303030]">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">Shift Aktif</p>
          <Title level={5} className="!mb-4 !mt-1">
            Ringkasan Kasir
          </Title>
          {currentSession ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#303030] dark:bg-[#1f1f1f]">
                <span className="text-slate-500">Penjualan</span>
                <span className="font-bold text-[#10b981]">
                  {formatCurrency(currentSessionSales, store.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#303030] dark:bg-[#1f1f1f]">
                <span className="text-slate-500">Transaksi</span>
                <span className="font-bold">{currentSession.totalTransactions}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#303030] dark:bg-[#1f1f1f]">
                <span className="text-slate-500">Tunai</span>
                <span className="font-semibold">{formatCurrency(currentSession.totalCashSales, store.currency)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#303030] dark:bg-[#1f1f1f]">
                <span className="text-slate-500">Digital Xendit</span>
                <span className="font-semibold">
                  {formatCurrency(currentSession.totalDigitalSales, store.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#303030] dark:bg-[#1f1f1f]">
                <span className="text-slate-500">Cashless Lain</span>
                <span className="font-semibold">
                  {formatCurrency(currentSession.totalCashlessOther, store.currency)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Belum ada shift aktif hari ini.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm dark:border-[#303030] lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">Antrean Layanan</p>
              <Title level={5} className="!m-0">
                Pesanan Aktif Terbaru
              </Title>
            </div>
            <Tag color="processing" className="m-0 border-none">
              Order + meja
            </Tag>
          </div>

          {activeOrders.length === 0 ? (
            <div className="py-10">
              <Empty description="Belum ada pesanan aktif" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {activeOrders.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#303030] dark:bg-[#1f1f1f] md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="m-0 text-sm font-black">{order.orderNumber}</p>
                    <p className="m-0 text-xs text-slate-500">
                      {order.tableId ? tableNames.get(order.tableId) || 'Meja tidak diketahui' : 'Take away'} •{' '}
                      {formatCurrency(order.totalAmount, store.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag
                      color={order.status === 'ready' ? 'success' : order.status === 'processing' ? 'warning' : 'processing'}
                      className="m-0 border-none font-bold uppercase"
                    >
                      {order.status.replace('_', ' ')}
                    </Tag>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-[#303030]">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">Produk Terlaris</p>
          <Title level={5} className="!mb-4 !mt-1">
            Bulan Ini
          </Title>
          {loadingReport && !report ? (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          ) : report?.topProducts.length ? (
            <div className="space-y-3">
              {report.topProducts.slice(0, 5).map((product) => (
                <div key={product.productId ?? product.productName} className="flex items-center justify-between">
                  <span className="truncate pr-3 text-sm font-medium">{product.productName}</span>
                  <Tag color="success" className="m-0 border-none font-medium">
                    {product.totalQty} terjual
                  </Tag>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Belum ada data penjualan.</p>
          )}
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-[#303030]">
        <div className="flex items-center justify-between">
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tren Penjualan</p>
            <Title level={5} className="!m-0">
              7 Hari Terakhir
            </Title>
          </div>
          <Tag color="processing" className="m-0 border-none">
            Server-side
          </Tag>
        </div>

        {loadingReport && !report ? (
          <div className="flex justify-center py-12">
            <Spin />
          </div>
        ) : report?.dailyTrend.length ? (
          <div className="mt-8 flex h-40 items-end justify-between gap-2 px-1">
            {report.dailyTrend.map((item) => (
              <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full flex-col items-center justify-end">
                  <div
                    className="w-full max-w-[30px] rounded-t-sm bg-[#10b981]/80 shadow-sm transition-all"
                    style={{
                      height: `${(item.total / maxDaily) * 100}%`,
                      minHeight: item.total > 0 ? '4px' : '0',
                    }}
                  />
                </div>
                <span className="text-[9px] font-bold uppercase text-slate-500">
                  {item.date.slice(8)}/{item.date.slice(5, 7)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Belum ada data tren harian.</p>
        )}
      </Card>
    </div>
  );
}
