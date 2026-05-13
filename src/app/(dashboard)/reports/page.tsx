'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDataStore } from '@/store/dataStore';
import { PageHeader } from '@/components/widgets/PageHeader';
import { Card, Button, DatePicker, Spin, Empty, Typography, Tag, Table } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { formatCurrency } from '@/lib/utils/format';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type ReportSummary = {
  totalSales: number;
  totalRefunds: number;
  netSales: number;
  totalExpenses: number;
  netIncome: number;
  totalTax: number;
  totalDiscount: number;
  completedTransactions: number;
  refundedTransactions: number;
  expenseCount: number;
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

type PaymentBreakdown = {
  method: string;
  total: number;
  count: number;
};

type ReportData = {
  period: { from: string; to: string };
  summary: ReportSummary;
  topProducts: TopProduct[];
  dailyTrend: DailyTrend[];
  paymentBreakdown: PaymentBreakdown[];
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Tunai',
  card: 'Kartu',
  qris: 'QRIS',
  transfer: 'Transfer',
  'e-wallet': 'Dompet Digital',
};

export default function ReportsPage() {
  const store = useDataStore((state) => state.store);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default: current month
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().endOf('month').format('YYYY-MM-DD'),
  ]);

  const fetchReport = useCallback(async () => {
    if (!store.id) return;
    setLoading(true);
    setError(null);

    try {
      const [from, to] = dateRange;
      const res = await fetch(
        `/api/reports/summary?from=${from}&to=${to}`
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Gagal memuat laporan');
      setData(payload.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [store.id, dateRange]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ['Ringkasan Laporan'],
      [`Periode`, `${dateRange[0]} s/d ${dateRange[1]}`],
      [],
      ['Metrik', 'Nilai'],
      ['Total Penjualan', data.summary.totalSales.toString()],
      ['Total Refund', data.summary.totalRefunds.toString()],
      ['Net Penjualan', data.summary.netSales.toString()],
      ['Total Pengeluaran', data.summary.totalExpenses.toString()],
      ['Laba Bersih', data.summary.netIncome.toString()],
      ['Pajak', data.summary.totalTax.toString()],
      ['Diskon', data.summary.totalDiscount.toString()],
      ['Transaksi Selesai', data.summary.completedTransactions.toString()],
      ['Transaksi Refund', data.summary.refundedTransactions.toString()],
      [],
      ['Produk Terlaris'],
      ['Produk', 'Revenue', 'Qty'],
      ...data.topProducts.map((p) => [p.productName, p.totalRevenue.toString(), p.totalQty.toString()]),
      [],
      ['Tren Harian'],
      ['Tanggal', 'Total', 'Jumlah Transaksi'],
      ...data.dailyTrend.map((d) => [d.date, d.total.toString(), d.count.toString()]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `laporan-${dateRange[0]}-${dateRange[1]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const topProductColumns = [
    {
      title: 'Produk',
      dataIndex: 'productName',
      key: 'name',
      render: (name: string) => <span className="font-medium">{name}</span>,
    },
    {
      title: 'Revenue',
      dataIndex: 'totalRevenue',
      key: 'revenue',
      render: (v: number) => <span className="font-bold text-[#10b981]">{formatCurrency(v, store.currency)}</span>,
    },
    {
      title: 'Qty Terjual',
      dataIndex: 'totalQty',
      key: 'qty',
      render: (v: number) => <Tag color="processing" className="border-none font-bold">{v}</Tag>,
    },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Laporan"
        subtitle="Ringkasan laporan laba rugi — data langsung dari server"
        actions={
          <div className="flex flex-wrap gap-2 items-center">
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
            <Button icon={<ReloadOutlined />} onClick={fetchReport} loading={loading}>
              Muat Ulang
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!data}>
              Ekspor .CSV
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 text-red-600 text-sm">
          Gagal memuat laporan: {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spin size="large" /></div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-50 dark:bg-[#1f1f1f] shadow-sm border-slate-200 dark:border-[#303030]">
              <p className="text-[10px] uppercase font-bold text-slate-500 m-0">Total Penjualan</p>
              <p className="text-xl font-bold truncate m-0">{formatCurrency(data.summary.totalSales, store.currency)}</p>
              <p className="text-xs text-slate-400 m-0 mt-1">{data.summary.completedTransactions} transaksi selesai</p>
            </Card>
            <Card className="bg-slate-50 dark:bg-[#1f1f1f] shadow-sm border-slate-200 dark:border-[#303030]">
              <p className="text-[10px] uppercase font-bold text-slate-500 m-0">Refund</p>
              <p className="text-xl font-bold truncate m-0 text-orange-500">
                -{formatCurrency(data.summary.totalRefunds, store.currency)}
              </p>
              <p className="text-xs text-slate-400 m-0 mt-1">{data.summary.refundedTransactions} transaksi dikembalikan</p>
            </Card>
            <Card className="bg-slate-50 dark:bg-[#1f1f1f] shadow-sm border-slate-200 dark:border-[#303030]">
              <p className="text-[10px] uppercase font-bold text-slate-500 m-0">Pengeluaran</p>
              <p className="text-xl font-bold truncate m-0">{formatCurrency(data.summary.totalExpenses, store.currency)}</p>
              <p className="text-xs text-slate-400 m-0 mt-1">{data.summary.expenseCount} entri</p>
            </Card>
            <Card className="bg-[#10b981]/5 border-[#10b981]/20 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-[#10b981]/80 m-0">Laba Bersih</p>
              <p className={`text-xl font-bold truncate m-0 ${data.summary.netIncome < 0 ? 'text-red-500' : 'text-[#10b981]'}`}>
                {formatCurrency(data.summary.netIncome, store.currency)}
              </p>
              <p className="text-xs text-slate-400 m-0 mt-1">
                Net penjualan – pengeluaran
              </p>
            </Card>
          </div>

          {/* Secondary metrics */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="shadow-sm border-slate-200 dark:border-[#303030]">
              <p className="text-[10px] uppercase font-bold text-slate-500 m-0">Net Penjualan</p>
              <p className="text-lg font-bold m-0">{formatCurrency(data.summary.netSales, store.currency)}</p>
              <p className="text-xs text-slate-400 m-0 mt-1">Total penjualan – refund</p>
            </Card>
            <Card className="shadow-sm border-slate-200 dark:border-[#303030]">
              <p className="text-[10px] uppercase font-bold text-slate-500 m-0">Pajak Terkumpul</p>
              <p className="text-lg font-bold m-0">{formatCurrency(data.summary.totalTax, store.currency)}</p>
            </Card>
            <Card className="shadow-sm border-slate-200 dark:border-[#303030]">
              <p className="text-[10px] uppercase font-bold text-slate-500 m-0">Total Diskon</p>
              <p className="text-lg font-bold m-0">{formatCurrency(data.summary.totalDiscount, store.currency)}</p>
            </Card>
          </div>

          {/* Top Products + Payment Breakdown */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card
                className="shadow-sm border-slate-200 dark:border-[#303030]"
                title={<span className="text-sm font-bold uppercase tracking-wider text-slate-500">Produk Terlaris</span>}
              >
                {data.topProducts.length === 0 ? (
                  <Empty description="Belum ada data produk" />
                ) : (
                  <Table
                    dataSource={data.topProducts}
                    columns={topProductColumns}
                    rowKey={(r) => r.productId ?? r.productName}
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                  />
                )}
              </Card>
            </div>

            <Card
              className="shadow-sm border-slate-200 dark:border-[#303030]"
              title={<span className="text-sm font-bold uppercase tracking-wider text-slate-500">Metode Pembayaran</span>}
            >
              {data.paymentBreakdown.length === 0 ? (
                <Empty description="Belum ada data" />
              ) : (
                <div className="space-y-4">
                  {data.paymentBreakdown.map((row) => (
                    <div key={row.method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{METHOD_LABELS[row.method] ?? row.method}</span>
                        <span className="font-bold">{formatCurrency(row.total, store.currency)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{row.count} transaksi</span>
                        <span>
                          {data.summary.totalSales > 0
                            ? `${((row.total / data.summary.totalSales) * 100).toFixed(1)}%`
                            : '0%'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#1f1f1f] mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#10b981] transition-all"
                          style={{
                            width: `${data.summary.totalSales > 0
                              ? (row.total / data.summary.totalSales) * 100
                              : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Daily Trend */}
          {data.dailyTrend.length > 0 && (
            <Card
              className="shadow-sm border-slate-200 dark:border-[#303030]"
              title={<span className="text-sm font-bold uppercase tracking-wider text-slate-500">Tren Harian</span>}
            >
              <div className="flex items-end gap-1 h-32 sm:h-40 overflow-x-auto pb-1">
                {(() => {
                  const max = Math.max(...data.dailyTrend.map((d) => d.total), 1);
                  return data.dailyTrend.map((row) => (
                    <div key={row.date} className="flex flex-col items-center gap-1 min-w-[28px] flex-1">
                      <div
                        className="w-full max-w-[28px] rounded-t-sm bg-[#10b981]/80 hover:bg-[#10b981] transition-all"
                        style={{ height: `${(row.total / max) * 100}%`, minHeight: row.total > 0 ? '4px' : '0' }}
                        title={`${row.date}: ${formatCurrency(row.total, store.currency)}`}
                      />
                      <span className="text-[9px] text-slate-400 font-bold" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        {row.date.slice(5)}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
