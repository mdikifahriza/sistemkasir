'use client';

import { useState } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useDataStore } from '@/store/dataStore';
import { PageHeader } from '@/components/widgets/PageHeader';
import { formatRole } from '@/lib/utils/roles';
import { Card, Input, Button, message, Typography, App } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function ProfilePage() {
  const user = useCurrentUser();
  const updateUser = useDataStore((state) => state.updateUser);
  const { message: messageApi } = App.useApp();

  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });

  if (!user) {
    return <div className="text-sm text-slate-500">User tidak ditemukan.</div>;
  }

  const handleSave = async () => {
    try {
      await updateUser(user.id, {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
      });
      messageApi.success('Profil tersimpan');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal menyimpan profil');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader title="Profil Saya" subtitle="Kelola data pribadi dan informasi akun" />

      <Card className="shadow-sm border-slate-200 dark:border-[#303030] max-w-4xl">
        <Title level={5} className="mb-4">Informasi Akun</Title>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <div>
            <Text strong className="block mb-1">Nama Lengkap</Text>
            <Input
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            />
          </div>
          <div>
            <Text strong className="block mb-1">Telepon</Text>
            <Input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </div>
          <div>
            <Text strong className="block mb-1">Email</Text>
            <Input
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
          <div>
            <Text strong className="block mb-1">Peran Akun</Text>
            <Input value={formatRole(user.role)} disabled className="bg-slate-50 dark:bg-[#1f1f1f]" />
          </div>
        </div>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} className="bg-[#10b981] hover:bg-[#059669]">
          Simpan Profil
        </Button>
      </Card>
    </div>
  );
}
