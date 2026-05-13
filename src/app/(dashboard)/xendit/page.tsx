'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Spin, Tag, Typography, App, Form, Input, InputNumber, Select, Modal, Divider, Badge } from 'antd';
import { BankOutlined, CreditCardOutlined, HistoryOutlined, InfoCircleOutlined, ReloadOutlined, SendOutlined, WalletOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/widgets/PageHeader';
import { useDataStore } from '@/store/dataStore';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';

const { Title, Text } = Typography;
const { Option } = Select;

type GatewayBalanceResponse = {
  balance: number;
  currency?: string | null;
  atTimestamp?: string | null;
  storeCode?: string | null;
};

const BANK_CHANNELS = [
  { label: 'BCA', value: 'ID_BCA' },
  { label: 'BNI', value: 'ID_BNI' },
  { label: 'BRI', value: 'ID_BRI' },
  { label: 'Mandiri', value: 'ID_MANDIRI' },
  { label: 'Permata', value: 'ID_PERMATA' },
  { label: 'CIMB', value: 'ID_CIMB' },
  { label: 'DANA', value: 'ID_DANA' },
  { label: 'OVO', value: 'ID_OVO' },
  { label: 'LinkAja', value: 'ID_LINKAJA' },
  { label: 'ShopeePay', value: 'ID_SHOPEEPAY' },
];

export default function XenditPage() {
  const store = useDataStore((state) => state.store);
  const transactions = useDataStore((state) => state.transactions);
  const shiftCashTransfers = useDataStore((state) => state.shiftCashTransfers);
  const currentShiftId = useDataStore((state) => state.currentShiftId);
  const bootstrap = useDataStore((state) => state.bootstrap);
  
  const role = useAuthStore((state) => state.role);
  const canPayout = role === 'owner' || role === 'manager';

  const { message: messageApi, modal: modalApi } = App.useApp();
  const [balance, setBalance] = useState<GatewayBalanceResponse | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [refreshingPayoutId, setRefreshingPayoutId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const xenditTransactions = useMemo(
    () =>
      [...transactions]
        .filter((transaction) => transaction.paymentMethod === 'xendit')
        .sort(
          (left, right) =>
            new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime(),
        ),
    [transactions],
  );

  const xenditTotal = useMemo(
    () => xenditTransactions.reduce((sum, transaction) => sum + Number(transaction.totalAmount || 0), 0),
    [xenditTransactions],
  );

  const loadBalance = useCallback(async () => {
    if (!store.id) {
      setBalanceError('Store belum siap');
      return;
    }

    setLoadingBalance(true);
    setBalanceError(null);

    try {
      const response = await fetch(`/api/internal/gateway/store-balance?storeId=${store.id}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as { data?: GatewayBalanceResponse; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || 'Gagal mengambil saldo Xendit');
      }

      setBalance({
        ...payload.data,
        balance: Number(payload.data.balance || 0),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengambil saldo Xendit';
      setBalanceError(message);
    } finally {
      setLoadingBalance(false);
    }
  }, [store.id]);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  const handlePayoutSubmit = async (values: any) => {
    if (!currentShiftId) {
      messageApi.error('Shift aktif diperlukan untuk mencatat payout');
      return;
    }

    setSubmittingPayout(true);
    try {
      const response = await fetch('/api/payouts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: store.id,
          shiftSessionId: currentShiftId,
          amount: values.amount,
          channelCode: values.channelCode,
          accountNumber: values.accountNumber,
          accountHolderName: values.accountHolderName,
          reason: values.reason,
          idempotencyKey: `payout-ui-${Date.now()}`,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal membuat payout');

      messageApi.success('Permintaan payout berhasil dikirim');
      setIsPayoutModalOpen(false);
      form.resetFields();
      
      // Refresh data to show new payout
      await bootstrap();
      void loadBalance();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal memproses payout');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const refreshPayoutStatus = async (referenceId: string, id: string) => {
    setRefreshingPayoutId(id);
    try {
      const response = await fetch(`/api/payouts/status?referenceId=${referenceId}`);
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || 'Gagal refresh status');
      
      messageApi.success('Status berhasil diperbarui');
      await bootstrap(); // Sync local state
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal sinkron status');
    } finally {
      setRefreshingPayoutId(null);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'succeeded':
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'cancelled':
      case 'canceled': return 'default';
      case 'reversed': return 'warning';
      case 'pending':
      case 'accepted': return 'processing';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
          title="Xendit & Keuangan"
          subtitle="Pantau saldo digital, transaksi online, dan lakukan penarikan dana ke rekening toko"
          actions={
            <div className="flex gap-2">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => void loadBalance()}
                loading={loadingBalance}
              >
                Cek Saldo
              </Button>
              {canPayout && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  disabled={!currentShiftId}
                  onClick={() => setIsPayoutModalOpen(true)}
                  className="bg-[#10b981] hover:bg-[#059669]"
                >
                  Tarik Dana (Payout)
                </Button>
              )}
            </div>
          }
      />

      {balanceError ? (
        <Alert
          type="warning"
          showIcon
          title={balanceError}
          description="Halaman ini tetap bisa dipakai untuk melihat rekap transaksi digital lokal, tetapi saldo live dari payment gateway belum berhasil diambil."
        />
      ) : null}

      {!currentShiftId && canPayout && (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          title="Shift Tidak Aktif"
          description="Anda harus membuka shift terlebih dahulu sebelum dapat melakukan penarikan dana (payout) agar transaksi tercatat dalam pembukuan shift."
        />
      )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-200 shadow-sm dark:border-[#303030]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Text type="secondary" className="text-xs uppercase tracking-wider">
                  Saldo Live Xendit
                </Text>
                <Title level={3} className="mt-2 !mb-0">
                  {loadingBalance && !balance ? <Spin size="small" /> : formatCurrency(balance?.balance || 0, store.currency)}
                </Title>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                <WalletOutlined />
              </div>
            </div>
            <Text type="secondary" className="mt-3 block text-xs">
              {balance?.atTimestamp ? `Tersinkron ${formatDateTime(balance.atTimestamp)}` : 'Menunggu sinkronisasi'}
            </Text>
          </Card>

          <Card className="border-slate-200 shadow-sm dark:border-[#303030]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Text type="secondary" className="text-xs uppercase tracking-wider">
                  Total Masuk (Xendit)
                </Text>
                <Title level={3} className="mt-2 !mb-0">
                  {formatCurrency(xenditTotal, store.currency)}
                </Title>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CreditCardOutlined />
              </div>
            </div>
            <Text type="secondary" className="mt-3 block text-xs">
              Dari {xenditTransactions.length} transaksi pembayaran digital
            </Text>
          </Card>

          <Card className="border-slate-200 shadow-sm dark:border-[#303030]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Text type="secondary" className="text-xs uppercase tracking-wider">
                  Penarikan Dana (Payout)
                </Text>
                <Title level={3} className="mt-2 !mb-0">
                  {shiftCashTransfers.filter(t => t.type === 'transfer_out').length} kali
                </Title>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                <BankOutlined />
              </div>
            </div>
            <Text type="secondary" className="mt-3 block text-xs">
              Mencakup tarik ke laci dan payout ke rekening
            </Text>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          {/* Payout History */}
          <Card 
            className="border-slate-200 shadow-sm dark:border-[#303030]"
            title={<div className="flex items-center gap-2"><HistoryOutlined /> Riwayat Penarikan Dana & Payout</div>}
          >
            {shiftCashTransfers.length === 0 ? (
              <Empty description="Belum ada riwayat penarikan" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#303030]">
                      <th className="pb-3 pr-4 font-semibold">Waktu / Deskripsi</th>
                      <th className="pb-3 pr-4 font-semibold">Tujuan</th>
                      <th className="pb-3 pr-4 font-semibold">Nominal</th>
                      <th className="pb-3 pr-4 font-semibold text-center">Status</th>
                      <th className="pb-3 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#303030]">
                    {shiftCashTransfers.slice(0, 15).map((transfer) => (
                      <tr key={transfer.id} className="group">
                        <td className="py-4 pr-4">
                          <div className="font-medium">
                            {transfer.type === 'transfer_out' ? 'Payout ke Rekening' : 'Tarik ke Laci'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDateTime(transfer.createdAt)}
                            {transfer.reason ? ` • ${transfer.reason}` : ''}
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          {transfer.channelCode ? (
                            <div>
                              <Text strong className="text-xs uppercase">{transfer.channelCode}</Text>
                              <div className="text-xs text-slate-500">{transfer.accountNumberMasked || '-'}</div>
                              <div className="text-[10px] text-slate-400">{transfer.accountHolderName}</div>
                            </div>
                          ) : (
                            <Text type="secondary">-</Text>
                          )}
                        </td>
                        <td className="py-4 pr-4">
                          <Text strong>{formatCurrency(transfer.amount, store.currency)}</Text>
                        </td>
                        <td className="py-4 pr-4 text-center">
                          <Tag color={getStatusColor(transfer.status)} className="m-0 border-none font-bold uppercase text-[10px]">
                            {transfer.status || 'completed'}
                          </Tag>
                        </td>
                        <td className="py-4 text-right">
                          {transfer.referenceId && (transfer.status === 'pending' || transfer.status === 'accepted') && (
                            <Button
                              size="small"
                              type="text"
                              icon={<ReloadOutlined spin={refreshingPayoutId === transfer.id} />}
                              onClick={() => refreshPayoutStatus(transfer.referenceId!, transfer.id)}
                            />
                          )}
                          {transfer.failureMessage && (
                            <Button 
                              size="small" 
                              type="text" 
                              danger 
                              icon={<InfoCircleOutlined />} 
                              onClick={() => modalApi.error({ title: 'Gagal Payout', content: transfer.failureMessage })}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Xendit Transactions Recap */}
          <Card 
            className="border-slate-200 shadow-sm dark:border-[#303030]"
            title={<div className="flex items-center gap-2"><CreditCardOutlined /> Transaksi Digital (Xendit)</div>}
          >
            {xenditTransactions.length === 0 ? (
              <Empty description="Belum ada transaksi digital" />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#303030]">
                {xenditTransactions.slice(0, 8).map((transaction) => (
                  <div key={transaction.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{transaction.invoiceNumber}</div>
                        <div className="text-[11px] text-slate-500">
                          {transaction.customerName || 'Pelanggan umum'} • {formatDateTime(transaction.transactionDate)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(transaction.totalAmount, store.currency)}
                        </div>
                        <Badge status="success" text={<Text type="secondary" style={{ fontSize: '10px' }}>SUCCESS</Text>} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Divider className="my-4" />
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#1a1a1a]">
              <div className="flex justify-between text-xs font-medium">
                <Text type="secondary">Total Digital</Text>
                <Text strong>{formatCurrency(xenditTotal, store.currency)}</Text>
              </div>
            </div>
          </Card>
        </div>

      {/* Payout Modal */}
      <Modal
        title={<div className="flex items-center gap-2 text-[#10b981]"><SendOutlined /> Buat Penarikan Dana (Payout)</div>}
        open={isPayoutModalOpen}
        onCancel={() => !submittingPayout && setIsPayoutModalOpen(false)}
        footer={null}
        destroyOnHidden
        mask={{ closable: !submittingPayout }}
      >
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            <InfoCircleOutlined className="mr-2" />
            Dana akan dikirim ke rekening tujuan menggunakan layanan Payout Xendit. 
            Pastikan saldo live mencukupi.
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handlePayoutSubmit}
            initialValues={{ amount: 10000 }}
          >
            <div className="grid gap-x-4 md:grid-cols-2">
              <Form.Item
                label="Bank / Channel"
                name="channelCode"
                rules={[{ required: true, message: 'Pilih bank tujuan' }]}
              >
                <Select placeholder="Pilih Bank">
                  {BANK_CHANNELS.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
                </Select>
              </Form.Item>

              <Form.Item
                label="Nomor Rekening"
                name="accountNumber"
                rules={[{ required: true, message: 'Isi nomor rekening' }]}
              >
                <Input placeholder="Contoh: 12345678" />
              </Form.Item>
            </div>

            <Form.Item
              label="Nama Pemilik Rekening"
              name="accountHolderName"
              rules={[{ required: true, message: 'Isi nama pemilik rekening' }]}
            >
              <Input placeholder="Sesuai buku tabungan" />
            </Form.Item>

            <Form.Item
              label="Jumlah Penarikan (IDR)"
              name="amount"
              rules={[
                { required: true, message: 'Isi jumlah' },
                { type: 'number', min: 10000, message: 'Minimal Rp 10.000' }
              ]}
            >
              <InputNumber
                className="w-full"
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={value => value?.replace(/\./g, '') as any}
                placeholder="Jumlah ditarik"
              />
            </Form.Item>

            <Form.Item
              label="Alasan / Catatan"
              name="reason"
            >
              <Input.TextArea rows={2} placeholder="Misal: Tarik profit mingguan" />
            </Form.Item>

            <div className="mt-6 flex justify-end gap-3">
              <Button onClick={() => setIsPayoutModalOpen(false)} disabled={submittingPayout}>
                Batal
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={submittingPayout}
                className="bg-[#10b981] hover:bg-[#059669]"
              >
                Konfirmasi & Kirim
              </Button>
            </div>
          </Form>
      </Modal>
    </div>
  );
}
