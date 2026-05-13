'use client';

import { useState } from 'react';
import { useDataStore } from '@/store/dataStore';
import { PageHeader } from '@/components/widgets/PageHeader';
import { Card, Input, InputNumber, Select, Button, Space, Typography, App } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const store = useDataStore((state) => state.store);
  const updateStore = useDataStore((state) => state.updateStore);
  const { message: messageApi, modal } = App.useApp();

  const [form, setForm] = useState({
    name: store.name,
    address: store.address,
    phone: store.phone,
    email: store.email,
    taxPercentage: store.taxPercentage,
    serviceChargePercentage: store.serviceChargePercentage,
    currency: store.currency,
    printerType: store.printerType || 'thermal',
    printerWidth: store.printerWidth || 80,
    orderingAppUrl: store.orderingAppUrl || '',
  });

  const handleSave = async () => {
    const performUpdate = async () => {
      try {
        await updateStore({
          name: form.name,
          address: form.address,
          phone: form.phone,
          email: form.email,
          taxPercentage: Number(form.taxPercentage),
          serviceChargePercentage: Number(form.serviceChargePercentage),
          currency: form.currency,
          printerType: form.printerType,
          printerWidth: Number(form.printerWidth),
          orderingAppUrl: form.orderingAppUrl,
        });
        messageApi.success('Pengaturan tersimpan');
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan');
      }
    };

    if (form.orderingAppUrl !== (store.orderingAppUrl || '')) {
      modal.confirm({
        title: 'Peringatan Perubahan URL',
        content: 'Mengubah URL Sistem Pemesanan akan menyebabkan seluruh QR Code yang sudah dicetak menjadi tidak valid. Anda perlu memperbarui semua QR dan mencetaknya ulang. Lanjutkan?',
        okText: 'Ya, Simpan',
        cancelText: 'Batal',
        onOk: performUpdate,
      });
    } else {
      await performUpdate();
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 pb-20">
      <PageHeader title="Pengaturan" subtitle="Pengaturan toko dan hardware" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm border-slate-200 dark:border-[#303030]">
          <Title level={5} className="mb-4">Informasi Toko</Title>
          <div className="grid gap-4 sm:grid-cols-1">
            <div>
              <Text strong className="block mb-1 text-slate-500">Nama Toko</Text>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text strong className="block mb-1 text-slate-500">Telepon</Text>
                <Input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
              <div>
                <Text strong className="block mb-1 text-slate-500">Email</Text>
                <Input
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
            </div>
            <div>
              <Text strong className="block mb-1 text-slate-500">Alamat</Text>
              <Input.TextArea
                rows={3}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text strong className="block mb-1 text-slate-500">Pajak (%)</Text>
                <InputNumber
                  className="w-full"
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                  value={form.taxPercentage}
                  onChange={(value) => setForm({ ...form, taxPercentage: value || 0 })}
                />
              </div>
              <div>
                <Text strong className="block mb-1 text-slate-500">Service Charge (%)</Text>
                <InputNumber
                  className="w-full"
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                  value={form.serviceChargePercentage}
                  onChange={(value) => setForm({ ...form, serviceChargePercentage: value || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text strong className="block mb-1 text-slate-500">Mata Uang</Text>
                <Select
                  className="w-full"
                  value={form.currency}
                  onChange={(value) => setForm({ ...form, currency: value })}
                  options={[
                    { value: 'IDR', label: 'Rupiah (IDR)' },
                    { value: 'USD', label: 'US Dollar (USD)' },
                  ]}
                />
              </div>
              <div className="pt-4 border-t">
                <Text type="secondary" className="block mb-2">ID Toko (Gunakan untuk Sistem Pemesanan)</Text>
                <Space.Compact block>
                  <Input
                    value={store?.id}
                    readOnly
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(store?.id || '');
                      messageApi.success('ID Toko disalin!');
                    }}
                  >
                    Salin
                  </Button>
                </Space.Compact>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200 dark:border-[#303030]">
            <Title level={5} className="mb-4">Hardware & Printer</Title>
            <div className="grid gap-4">
              <div>
                <Text strong className="block mb-1 text-slate-500">Tipe Printer</Text>
                <Select
                  className="w-full"
                  value={form.printerType}
                  onChange={(value) => setForm({ ...form, printerType: value })}
                  options={[
                    { value: 'thermal', label: 'Thermal Printer (ESC/POS)' },
                    { value: 'browser', label: 'Browser/PDF Print' },
                  ]}
                />
              </div>
              <div>
                <Text strong className="block mb-1 text-slate-500">Lebar Kertas</Text>
                <Select
                  className="w-full"
                  value={form.printerWidth}
                  onChange={(value) => setForm({ ...form, printerWidth: value })}
                  options={[
                    { value: '58', label: '58mm' },
                    { value: '80', label: '80mm' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card className="shadow-sm border-slate-200 dark:border-[#303030]">
            <Title level={5} className="mb-4">Identitas Sistem</Title>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Text>Kode Toko</Text>
                <Text strong>{store.storeCode || '-'}</Text>
              </div>
              <div className="flex items-center justify-between">
                <Text>Zona Waktu</Text>
                <Text strong>{store.timezone || 'Asia/Jakarta'}</Text>
              </div>
            </div>
          </Card>

          <Card className="shadow-sm border-slate-200 dark:border-[#303030]">
            <Title level={5} className="mb-4">Sistem Pemesanan (Ordering App)</Title>
            <div className="space-y-4">
              <div>
                <Text strong className="block mb-1 text-slate-500">Base URL Pemesanan</Text>
                <Input
                  placeholder="https://order.tokokamu.com"
                  value={form.orderingAppUrl}
                  onChange={(e) => setForm({ ...form, orderingAppUrl: e.target.value })}
                />
                <Text type="secondary" className="text-xs mt-1 block">
                  Alamat web tempat pelanggan melakukan pemesanan.
                </Text>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button 
          type="primary" 
          size="large"
          icon={<SaveOutlined />} 
          onClick={handleSave} 
          className="bg-[#10b981] hover:bg-[#059669] h-12 px-10 rounded-lg shadow-md"
        >
          Simpan Semua Pengaturan
        </Button>
      </div>
    </div>
  );
}
