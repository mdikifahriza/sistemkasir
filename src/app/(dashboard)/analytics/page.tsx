'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDataStore } from '@/store/dataStore';
import { PageHeader } from '@/components/widgets/PageHeader';
import { Card, DatePicker, Spin, Empty, Tag, Typography } from 'antd';
import { formatCurrency } from '@/lib/utils/format';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type TopProduct = {
  productId: string | null;
  productName: string;
  totalRevenue: number;
  totalQty: number;
};

type PaymentBreakdown = {
  method: string;
  total: number;
  count: number;
};

type AnalyticsData = {
  summary: {
    totalSales: number;
    completedTransactions: number;
    netSales: number;
    totalRefunds: number;
    refundedTransactions: number;
  };
  topProducts: TopProduct[];
  paymentBreakdown: PaymentBreakdown[];
  dailyTrend: { date: string; total: number; count: number }[];
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Tunai',
  card: 'Kartu',
  qris: 'QRIS',
  transfer: 'Transfer',
  'e-wallet': 'Dompet Digital',
};

// Compute ABC category based on cumulative revenue share
function getAbcCategory(index: number, total: number): 'A' | 'B' | 'C' {
  const ratio = index / total;
  if (ratio < 0.2) return 'A';
  if (ratio < 0.5) return 'B';
  return 'C';
}

const ABC_COLOR: Record<string, string> = {
  A: 'success',
  B: 'processing',
  C: 'default',
};

export default function AnalyticsPage() {
  const store = useDataStore((state) => state.store);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().endOf('month').format('YYYY-MM-DD'),
  ]);

  const fetchAnalytics = useCallback(async () => {
    if (!store.id) return;
    setLoading(true);
    try {
      const [from, to] = dateRange;
      const res = await fetch(
        `/api/reports/summary?from=${from}&to=${to}`
      );
      const payload = await res.json();
      if (res.ok) setData(payload.data);
    } finally {
      setLoading(false);
    }
  }, [store.id, dateRange]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const maxRevenue = data ? Math.max(...data.topProducts.map((p) => p.totalRevenue), 1) : 1;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Analitik"
        subtitle="Analisis performa produk & pola penjualan — data server-side"
        actions={
          <RangePicker
            value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
            onChange={(dates) => {
              if (dates?.[0] && dates?.[1]) {
                setDateRange([
                  dates[0].format('YYYY-MM-DD'),
                  dates[1].format('YYYY-MM-DD'),
                ]);
              }
            }}
            format="DD/MM/YYYY"
          />
        }
      />

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spin size="large" /></div>
      ) : data ? (
        <>
          {/* KPI Strip */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="shadow-sm border-slate-200 dark:border-[#303030] bg-slate-50 dark:bg-[#1f1f1f]">
              <p className="text-[10px] uppercase font-bold text-slate-500 m-0">Net Penjualan</p>
              <p className="text-lg font-bold m-0 text-[#10b981]">{formatCurrency(data.summary.netSales, store.currency)}</p>
            </Card>
            <Card className="shadow-sm border-slate-200 dark:border-[#303030] bg-slate-50 dark:bg-[#1f1f1f]">
              <p className="text-[10px] uppercase font-bold text-slate-500 m-0">Transaksi Selesai</p>
              <p className="text-lg font-bold m-0">{data.summary.completedTransactions}</p>
            </Card>
            <Card className="shadow-sm border-slate-200 dark:border-[#303030] bg-slate-50 dark:bg-[#1f1f1f]">
              <p className="text-[10px] uppercase font-bold text-slate-500 m-0">Rata-rata per Transaksi</p>
              <p className="text-lg font-bold m-0">
                {formatCurrency(
                  data.summary.completedTransactions > 0
                    ? data.summary.netSales / data.summary.completedTransactions
                    : 0,
                  store.currency
                )}
              </p>
            </Card>
          </div>

          {/* Top Products — ABC Analysis */}
          <Card className="shadow-sm border-slate-200 dark:border-[#303030]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 m-0">Analisis ABC Produk</p>
            <Title level={5} className="!mt-1 mb-6">
              Kontribusi Penjualan Per Produk
            </Title>
            {data.topProducts.length === 0 ? (
              <Empty description="Belum ada data penjualan." />
            ) : (
              <div className="space-y-5">
                {data.topProducts.map((item, i) => {
                  const abc = getAbcCategory(i, data.topProducts.length);
                  const pct = data.summary.totalSales > 0
                    ? ((item.totalRevenue / data.summary.totalSales) * 100).toFixed(1)
                    : '0';
                  return (
                    <div key={item.productId ?? item.productName} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <Tag color={ABC_COLOR[abc]} className="font-bold border-none text-[10px] m-0">{abc}</Tag>
                          <span className="font-medium truncate max-w-[140px] sm:max-w-none">{item.productName}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-400 text-xs hidden sm:inline">{item.totalQty} terjual</span>
                          <span className="font-bold text-[#10b981]">{formatCurrency(item.totalRevenue, store.currency)}</span>
                          <span className="text-slate-400 text-xs">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#1f1f1f] overflow-hidden shadow-inner">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#10b981]/80 to-[#10b981] transition-all duration-500"
                          style={{ width: `${(item.totalRevenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Payment Breakdown + ABC Legend */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-l-4 border-l-[#10b981] shadow-sm border-slate-200 dark:border-[#303030]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 m-0">Metode Pembayaran</p>
              <div className="mt-3 space-y-3">
                {data.paymentBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada data.</p>
                ) : (
                  data.paymentBreakdown.map((row) => (
                    <div key={row.method}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{METHOD_LABELS[row.method] ?? row.method}</span>
                        <span className="font-bold">{row.count}×</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{formatCurrency(row.total, store.currency)}</span>
                        <span>
                          {data.summary.totalSales > 0
                            ? `${((row.total / data.summary.totalSales) * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm border-slate-200 dark:border-[#303030]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 m-0">Analisis ABC — Legenda</p>
              <div className="mt-3 space-y-2 text-xs leading-relaxed">
                <div className="flex items-start gap-2">
                  <Tag color="success" className="border-none font-bold m-0 mt-0.5">A</Tag>
                  <div>
                    <p className="font-bold m-0">Top 20% Produk</p>
                    <p className="text-slate-500 m-0">Produk paling menguntungkan — jaga stok dan kualitas</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Tag color="processing" className="border-none font-bold m-0 mt-0.5">B</Tag>
                  <div>
                    <p className="font-bold m-0">30% Produk Menengah</p>
                    <p className="text-slate-500 m-0">Potensi naik ke A dengan promosi yang tepat</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Tag color="default" className="border-none font-bold m-0 mt-0.5">C</Tag>
                  <div>
                    <p className="font-bold m-0">50% Produk Lainnya</p>
                    <p className="text-slate-500 m-0">Evaluasi ulang — pertimbangkan penghapusan atau promosi</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
