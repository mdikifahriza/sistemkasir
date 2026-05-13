'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Tabs,
  Table,
  Tag,
  TimePicker,
  Typography,
  App,
} from 'antd';
import {
  CreditCardOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/widgets/PageHeader';
import { useCurrentShiftState } from '@/lib/hooks/useCurrentShiftState';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { formatShiftTimeLabel, hasShiftTimeOverlap, normalizeShiftTimeString } from '@/lib/shiftSchedule';
import { useDataStore } from '@/store/dataStore';

const { Title, Text } = Typography;

type ShiftFormValues = {
  shiftName: string;
  startTime: dayjs.Dayjs;
  endTime: dayjs.Dayjs;
};

function toPickerValue(value: string | Date | null | undefined) {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function getDiscrepancyTone(value: number) {
  return value < 0 ? 'text-red-500' : 'text-emerald-500';
}

function getDiscrepancyTagColor(value: number): 'error' | 'success' {
  return value < 0 ? 'error' : 'success';
}

function getDiscrepancyLabel(value: number) {
  if (value < 0) {
    return 'Kurang';
  }

  if (value > 0) {
    return 'Lebih';
  }

  return 'Sesuai';
}

async function readGatewayBalance(storeId: string) {
  const response = await fetch(`/api/internal/gateway/store-balance?storeId=${storeId}`, {
    cache: 'no-store',
  });
  const payload = (await response.json()) as { data?: { balance?: number }; error?: string };

  if (!response.ok || !payload.data) {
    throw new Error(payload.error || 'Gagal mengambil saldo Xendit');
  }

  return Number(payload.data.balance || 0);
}

export default function ShiftsPage() {
  const store = useDataStore((state) => state.store);
  const shifts = useDataStore((state) => state.shifts);
  const shiftSessions = useDataStore((state) => state.shiftSessions);
  const openShift = useDataStore((state) => state.openShift);
  const closeShift = useDataStore((state) => state.closeShift);
  const addShift = useDataStore((state) => state.addShift);
  const updateShift = useDataStore((state) => state.updateShift);
  const removeShift = useDataStore((state) => state.removeShift);
  const isShiftSessionMutating = useDataStore((state) => state.isShiftSessionMutating);
  const { currentSession } = useCurrentShiftState();
  const user = useCurrentUser();
  const { message: messageApi, modal } = App.useApp();
  const [form] = Form.useForm<ShiftFormValues>();

  const [selectedShift, setSelectedShift] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [digitalOpeningBalance, setDigitalOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [digitalClosingBalance, setDigitalClosingBalance] = useState(0);
  const [notes, setNotes] = useState('');
  const [masterOpen, setMasterOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<(typeof shifts)[number] | null>(null);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [closingLoading, setClosingLoading] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [gatewayBalanceSyncedAt, setGatewayBalanceSyncedAt] = useState<string | null>(null);

  const canManageMaster = user?.role === 'owner' || user?.role === 'manager';

  useEffect(() => {
    if (!selectedShift && shifts.length > 0) {
      setSelectedShift(shifts[0].id);
    }
  }, [selectedShift, shifts]);

  const syncGatewayBalance = async (mode: 'opening' | 'closing', showToast = false) => {
    if (!store.id) {
      throw new Error('Store belum siap');
    }

    setGatewayLoading(true);
    setGatewayError(null);

    try {
      const balance = await readGatewayBalance(store.id);
      if (mode === 'closing') {
        setDigitalClosingBalance(balance);
      } else {
        setDigitalOpeningBalance(balance);
      }
      setGatewayBalanceSyncedAt(new Date().toISOString());
      if (showToast) {
        messageApi.success('Saldo Xendit berhasil disinkronkan');
      }
      return balance;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengambil saldo Xendit';
      setGatewayError(message);
      if (showToast) {
        messageApi.error(message);
      }
      throw error;
    } finally {
      setGatewayLoading(false);
    }
  };

  useEffect(() => {
    if (!store.id) {
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      try {
        const balance = await readGatewayBalance(store.id);
        if (cancelled) {
          return;
        }

        setGatewayError(null);
        if (currentSession) {
          setDigitalClosingBalance(balance);
        } else {
          setDigitalOpeningBalance(balance);
        }
        setGatewayBalanceSyncedAt(new Date().toISOString());
      } catch (error) {
        if (!cancelled) {
          setGatewayError(error instanceof Error ? error.message : 'Gagal mengambil saldo Xendit');
        }
      } finally {
        if (!cancelled) {
          setGatewayLoading(false);
        }
      }
    };

    setGatewayLoading(true);
    void run();

    if (currentSession) {
      intervalId = setInterval(() => {
        setGatewayLoading(true);
        void run();
      }, 30000);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentSession, store.id]);

  const handleOpen = async () => {
    if (!user || !selectedShift) {
      messageApi.error('Pilih shift terlebih dahulu');
      return;
    }

    if (openingLoading || isShiftSessionMutating) {
      return;
    }

    setOpeningLoading(true);

    try {
      const latestGatewayBalance = await syncGatewayBalance('opening');
      const result = await openShift(selectedShift, user.id, openingBalance, latestGatewayBalance);
      if (!result) {
        messageApi.error('Shift aktif sudah ada');
        return;
      }
      messageApi.success('Shift berhasil dibuka');
      setOpeningBalance(0);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal membuka shift');
    } finally {
      setOpeningLoading(false);
    }
  };

  const handleClose = async () => {
    if (!currentSession || closingLoading || isShiftSessionMutating) {
      return;
    }

    setClosingLoading(true);

    try {
      const latestGatewayBalance = await syncGatewayBalance('closing');
      await closeShift(currentSession.id, closingBalance, latestGatewayBalance, notes);
      messageApi.success('Shift berhasil ditutup');
      setClosingBalance(0);
      setDigitalClosingBalance(0);
      setNotes('');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal menutup shift');
    } finally {
      setClosingLoading(false);
    }
  };

  const handleSaveMaster = async (values: ShiftFormValues) => {
    const normalizedStart = normalizeShiftTimeString(values.startTime.format('HH:mm:ss'));
    const normalizedEnd = normalizeShiftTimeString(values.endTime.format('HH:mm:ss'));

    if (!normalizedStart || !normalizedEnd) {
      messageApi.error('Format jam shift tidak valid');
      return;
    }

    if (normalizedStart === normalizedEnd) {
      messageApi.error('Jam mulai dan jam selesai tidak boleh sama');
      return;
    }

    if (hasShiftTimeOverlap(shifts, { startTime: normalizedStart, endTime: normalizedEnd }, editingShift?.id)) {
      messageApi.error('Jadwal shift bertabrakan dengan shift lain');
      return;
    }

    const payload = {
      shiftName: values.shiftName,
      startTime: normalizedStart,
      endTime: normalizedEnd,
      colorCode: editingShift?.colorCode || '#10b981',
      isActive: true,
    };

    setSavingLoading(true);

    try {
      if (editingShift) {
        await updateShift(editingShift.id, payload);
        messageApi.success('Shift berhasil diperbarui');
      } else {
        await addShift(payload);
        messageApi.success('Shift baru berhasil dibuat');
      }
      setMasterOpen(false);
      setEditingShift(null);
      form.resetFields();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal menyimpan shift');
    } finally {
      setSavingLoading(false);
    }
  };

  const handleDeleteShift = (id: string) => {
    modal.confirm({
      title: 'Hapus Shift',
      content: 'Apakah Anda yakin ingin menghapus shift ini?',
      okText: 'Hapus',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        setDeletingShiftId(id);
        try {
          await removeShift(id);
          messageApi.success('Shift berhasil dihapus');
        } catch (error) {
          messageApi.error(error instanceof Error ? error.message : 'Gagal menghapus shift');
        } finally {
          setDeletingShiftId(null);
        }
      },
    });
  };

  const currentSessionExpectedCash =
    Number(currentSession?.cashDrawerOpen || 0) +
    Number(currentSession?.totalCashSales || 0) -
    Number(currentSession?.totalExpenses || 0);

  const currentSessionExpectedDigital =
    Number(currentSession?.xenditBalanceOpen || 0) + Number(currentSession?.xenditTotalIn || 0);
  const currentCashDiscrepancy = closingBalance - currentSessionExpectedCash;
  const currentDigitalDiscrepancy = digitalClosingBalance - currentSessionExpectedDigital;

  const operasionalContent = (
    <div className="mt-4 space-y-6">
      {!currentSession ? (
        <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-[#303030]">
          <div className="border-b border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <Title level={5} style={{ margin: 0 }}>
              Mulai Shift Baru
            </Title>
          </div>
          <div className="space-y-6 p-6">
            <Row gutter={[24, 24]}>
              <Col xs={24} md={8}>
                <Text strong className="mb-2 block">
                  Pilih Shift
                </Text>
                <Select
                  className="h-12 w-full"
                  value={selectedShift}
                  onChange={setSelectedShift}
                  options={shifts.map((shift) => ({ value: shift.id, label: shift.shiftName }))}
                  disabled={openingLoading || isShiftSessionMutating}
                />
              </Col>
              <Col xs={24} md={8}>
                <Text strong className="mb-2 flex items-center gap-2">
                  <WalletOutlined /> Saldo Awal Laci
                </Text>
                <InputNumber
                  className="h-12 w-full"
                  style={{ width: '100%' }}
                  min={0}
                  value={openingBalance}
                  onChange={(value) => setOpeningBalance(Number(value || 0))}
                  formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={(value) => Number(value?.replace(/[^\d]/g, '') || 0)}
                  disabled={openingLoading || isShiftSessionMutating}
                />
              </Col>
              <Col xs={24} md={8}>
                <Text strong className="mb-2 flex items-center gap-2">
                  <CreditCardOutlined /> Saldo Awal Xendit
                </Text>
                <div className="flex gap-2">
                  <Input
                    className="h-12"
                    readOnly
                    value={formatCurrency(digitalOpeningBalance)}
                    status={gatewayError ? 'warning' : undefined}
                    disabled={openingLoading || isShiftSessionMutating}
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void syncGatewayBalance('opening', true)}
                    loading={gatewayLoading}
                    className="h-12"
                    disabled={openingLoading || isShiftSessionMutating}
                  >
                    Sync
                  </Button>
                </div>
                <Text type="secondary" className="mt-1 block text-xs">
                  {gatewayError
                    ? `Gateway: ${gatewayError}`
                    : gatewayBalanceSyncedAt
                      ? `Otomatis dari Xendit • ${formatDateTime(gatewayBalanceSyncedAt)}`
                      : 'Menunggu sinkronisasi saldo'}
                </Text>
              </Col>
            </Row>
            <Button
              type="primary"
              size="large"
              block
              onClick={() => void handleOpen()}
              loading={openingLoading || isShiftSessionMutating}
              disabled={openingLoading || isShiftSessionMutating || !selectedShift}
              className="h-14 rounded-xl bg-[#10b981] text-lg font-black hover:bg-[#059669]"
            >
              BUKA SHIFT SEKARANG
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-[#303030]">
          <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
            <div className="flex items-center gap-3">
              <StopOutlined className="text-xl text-amber-500" />
              <Title level={5} style={{ margin: 0 }}>
                Tutup Shift Aktif
              </Title>
              <Tag color="warning" className="ml-2">
                RUNNING
              </Tag>
            </div>
            <Text type="secondary" className="text-xs font-bold">
              Dibuka: {formatDateTime(currentSession.openedAt || currentSession.sessionDate)}
            </Text>
          </div>

          <div className="p-6">
            <Row gutter={[48, 24]}>
              <Col xs={24} lg={12} className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#303030] dark:bg-[#141414]">
                  <Title level={5} className="mb-4 flex items-center gap-2">
                    <WalletOutlined className="text-[#10b981]" /> Rekonsiliasi Tunai
                  </Title>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <Text type="secondary">Modal Awal</Text>
                      <Text strong>{formatCurrency(currentSession.cashDrawerOpen)}</Text>
                    </div>
                    <div className="flex justify-between text-sm">
                      <Text type="secondary">Penjualan Tunai (+)</Text>
                      <Text strong className="text-emerald-500">
                        {formatCurrency(currentSession.totalCashSales)}
                      </Text>
                    </div>
                    <div className="flex justify-between text-sm">
                      <Text type="secondary">Pengeluaran (-)</Text>
                      <Text strong className="text-red-500">
                        {formatCurrency(currentSession.totalExpenses)}
                      </Text>
                    </div>
                    <Divider className="my-2" />
                    <div className="flex justify-between">
                      <Text strong>Ekspektasi di Laci</Text>
                      <Text strong className="text-lg">
                        {formatCurrency(currentSessionExpectedCash)}
                      </Text>
                    </div>
                    <div className="mt-4">
                      <Text strong className="mb-1 block text-xs uppercase text-slate-500">
                        Saldo Aktual di Laci
                      </Text>
                      <InputNumber
                        className="h-12 w-full text-lg font-black"
                        style={{ width: '100%' }}
                        value={closingBalance}
                        onChange={(value) => setClosingBalance(Number(value || 0))}
                        formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                        parser={(value) => Number(value?.replace(/[^\d]/g, '') || 0)}
                        disabled={closingLoading || isShiftSessionMutating}
                      />
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-[#303030] dark:bg-[#101010]">
                        <div>
                          <Text type="secondary" className="block text-xs">
                            Selisih Tunai
                          </Text>
                          <Text strong className={`text-base ${getDiscrepancyTone(currentCashDiscrepancy)}`}>
                            {formatCurrency(currentCashDiscrepancy)}
                          </Text>
                        </div>
                        <Tag color={getDiscrepancyTagColor(currentCashDiscrepancy)} className="m-0 rounded-full px-3 font-bold">
                          {getDiscrepancyLabel(currentCashDiscrepancy)}
                        </Tag>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>

              <Col xs={24} lg={12} className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#303030] dark:bg-[#141414]">
                  <Title level={5} className="mb-4 flex items-center gap-2">
                    <CreditCardOutlined className="text-blue-500" /> Rekonsiliasi Digital
                  </Title>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <Text type="secondary">Saldo Awal</Text>
                      <Text strong>{formatCurrency(currentSession.xenditBalanceOpen)}</Text>
                    </div>
                    <div className="flex justify-between text-sm">
                      <Text type="secondary">Penerimaan Xendit (+)</Text>
                      <Text strong className="text-blue-500">
                        {formatCurrency(currentSession.xenditTotalIn)}
                      </Text>
                    </div>
                    <div className="flex justify-between text-sm">
                      <Text type="secondary">Jumlah Transaksi</Text>
                      <Text strong>{currentSession.xenditTransactionCount} Trx</Text>
                    </div>
                    <Divider className="my-2" />
                    <div className="flex justify-between">
                      <Text strong>Saldo Seharusnya</Text>
                      <Text strong className="text-lg">
                        {formatCurrency(currentSessionExpectedDigital)}
                      </Text>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <Text strong className="block text-xs uppercase text-slate-500">
                          Saldo Aktual di Xendit
                        </Text>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => void syncGatewayBalance('closing', true)}
                          loading={gatewayLoading}
                          size="small"
                          disabled={closingLoading || isShiftSessionMutating}
                        >
                          Sync
                        </Button>
                      </div>
                      <Input
                        className="h-12 text-lg font-black"
                        readOnly
                        value={formatCurrency(digitalClosingBalance)}
                        status={gatewayError ? 'warning' : undefined}
                        disabled={closingLoading || isShiftSessionMutating}
                      />
                      <Text type="secondary" className="mt-1 block text-xs">
                        {gatewayError
                          ? `Gateway: ${gatewayError}`
                          : gatewayBalanceSyncedAt
                            ? `Otomatis dari Xendit • ${formatDateTime(gatewayBalanceSyncedAt)}`
                            : 'Menunggu sinkronisasi saldo'}
                      </Text>
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-[#303030] dark:bg-[#101010]">
                        <div>
                          <Text type="secondary" className="block text-xs">
                            Selisih Digital
                          </Text>
                          <Text strong className={`text-base ${getDiscrepancyTone(currentDigitalDiscrepancy)}`}>
                            {formatCurrency(currentDigitalDiscrepancy)}
                          </Text>
                        </div>
                        <Tag color={getDiscrepancyTagColor(currentDigitalDiscrepancy)} className="m-0 rounded-full px-3 font-bold">
                          {getDiscrepancyLabel(currentDigitalDiscrepancy)}
                        </Tag>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>

            <div className="mt-6">
              <Text strong className="mb-2 block">
                Catatan Penutupan
              </Text>
              <Input.TextArea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Catatan penutupan shift"
                disabled={closingLoading || isShiftSessionMutating}
              />
            </div>

            <Button
              danger
              type="primary"
              size="large"
              block
              className="mt-6 h-14 rounded-xl text-lg font-black shadow-lg shadow-red-500/20"
              onClick={() => void handleClose()}
              loading={closingLoading || isShiftSessionMutating}
              disabled={closingLoading || isShiftSessionMutating}
            >
              TUTUP SHIFT & REKONSILIASI
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-8">
        <Title level={5} className="mb-4">
          Riwayat Sesi Terakhir
        </Title>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shiftSessions.map((session) => {
            const shiftName = shifts.find((shift) => shift.id === session.shiftId)?.shiftName || 'Shift';
            const totalSales =
              Number(session.totalCashSales) +
              Number(session.totalDigitalSales) +
              Number(session.totalCashlessOther);

            return (
              <div
                key={session.id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-[#303030] dark:bg-[#141414]"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="m-0 text-sm font-black">{shiftName}</h3>
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      {formatDateTime(session.openedAt || session.sessionDate)}
                    </p>
                  </div>
                  <Tag
                    color={session.status === 'open' ? 'green' : 'default'}
                    className="m-0 rounded-full border-none px-2 text-[9px] font-black uppercase"
                  >
                    {session.status}
                  </Tag>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <Text type="secondary">Total Penjualan</Text>
                    <Text strong>{formatCurrency(totalSales)}</Text>
                  </div>
                  <div className="flex justify-between text-xs">
                    <Text type="secondary">Selisih Tunai</Text>
                    <Text strong className={getDiscrepancyTone(Number(session.cashDiscrepancy || 0))}>
                      {formatCurrency(session.cashDiscrepancy || 0)}
                    </Text>
                  </div>
                  <div className="flex justify-between text-xs">
                    <Text type="secondary">Selisih Xendit</Text>
                    <Text strong className={getDiscrepancyTone(Number(session.xenditDiscrepancy || 0))}>
                      {formatCurrency(session.xenditDiscrepancy || 0)}
                    </Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const masterContent = (
    <div className="mt-4">
      <div className="mb-4 flex items-center justify-between">
        <Title level={5}>Master Shift</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingShift(null);
            form.resetFields();
            setMasterOpen(true);
          }}
          className="bg-[#10b981]"
        >
          Tambah Shift
        </Button>
      </div>

      <Table
        dataSource={shifts}
        rowKey="id"
        pagination={false}
        className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#303030]"
        columns={[
          {
            title: 'Nama Shift',
            dataIndex: 'shiftName',
            key: 'shiftName',
            render: (text) => <Text strong>{text}</Text>,
          },
          {
            title: 'Jam',
            key: 'time',
            render: (_, record) => `${formatShiftTimeLabel(record.startTime)} - ${formatShiftTimeLabel(record.endTime)}`,
          },
          {
            title: 'Aksi',
            key: 'action',
            render: (_, record) => (
              <Space>
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => {
                    setEditingShift(record);
                    form.setFieldsValue({
                      shiftName: record.shiftName,
                      startTime: toPickerValue(record.startTime) ?? dayjs(),
                      endTime: toPickerValue(record.endTime) ?? dayjs(),
                    });
                    setMasterOpen(true);
                  }}
                />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  loading={deletingShiftId === record.id}
                  onClick={() => handleDeleteShift(record.id)}
                />
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingShift ? 'Edit Shift' : 'Tambah Shift'}
        open={masterOpen}
        onCancel={() => setMasterOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={savingLoading}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveMaster}>
          <Form.Item name="shiftName" label="Nama Shift" rules={[{ required: true, message: 'Nama shift wajib diisi' }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startTime" label="Jam Mulai" rules={[{ required: true, message: 'Jam mulai wajib diisi' }]}>
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="Jam Selesai" rules={[{ required: true, message: 'Jam selesai wajib diisi' }]}>
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader title="Manajemen Shift" subtitle="Kelola operasional dan rekonsiliasi saldo kasir" />
      <Tabs
        items={[
          { key: 'operasional', label: 'Operasional', children: operasionalContent },
          ...(canManageMaster ? [{ key: 'master', label: 'Master Shift', children: masterContent }] : []),
        ]}
      />
    </div>
  );
}
