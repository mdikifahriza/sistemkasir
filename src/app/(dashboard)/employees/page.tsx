'use client';

import { useEffect, useState } from 'react';
import { Avatar, Button, Card, Input, Modal, Select, Tag, Upload, message, Typography, App } from 'antd';
import { EditOutlined, PlusOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import type { Role, User } from '@/lib/data/types';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { PageHeader } from '@/components/widgets/PageHeader';
import { formatRole } from '@/lib/utils/roles';
import { getMediaUrl } from '@/lib/utils/media';
import { uploadMedia } from '@/lib/upload';
import { useDataStore } from '@/store/dataStore';

const { Title, Text } = Typography;

type UserFormState = {
  fullName: string;
  username: string;
  role: Role;
  phone: string;
  email: string;
  pinCode: string;
  avatarUrl: string;
  isActive: boolean;
};

const EMPTY_FORM: UserFormState = {
  fullName: '',
  username: '',
  role: 'cashier',
  phone: '',
  email: '',
  pinCode: '',
  avatarUrl: '',
  isActive: true,
};

export default function EmployeesPage() {
  const users = useDataStore((state) => state.users);
  const addUser = useDataStore((state) => state.addUser);
  const updateUser = useDataStore((state) => state.updateUser);
  const currentUser = useCurrentUser();
  const { message: messageApi } = App.useApp();

  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const canManage = currentUser?.role === 'owner' || currentUser?.role === 'manager';

  useEffect(() => {
    if (avatarFile) {
      const objectUrl = URL.createObjectURL(avatarFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }

    setPreviewUrl(getMediaUrl(form.avatarUrl) || '');
    return undefined;
  }, [avatarFile, form.avatarUrl]);

  const openCreate = () => {
    setEditingId(null);
    setAvatarFile(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingId(user.id);
    setAvatarFile(null);
    setForm({
      fullName: user.fullName || '',
      username: user.username || '',
      role: user.role,
      phone: user.phone || '',
      email: user.email || '',
      pinCode: user.pinCode || '',
      avatarUrl: user.avatarUrl || '',
      isActive: user.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!canManage) return;
    if (!form.fullName.trim() || !form.username.trim()) {
      messageApi.error('Nama dan nama pengguna wajib diisi');
      return;
    }

    setSaving(true);

    try {
      let avatarUrl = form.avatarUrl;
      if (avatarFile) {
        const upload = await uploadMedia(avatarFile, 'users');
        avatarUrl = upload.publicUrl;
      }

      const payload = {
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        pinCode: form.pinCode.trim() || '123456',
        avatarUrl,
        isActive: form.isActive,
      };

      if (editingId) {
        await updateUser(editingId, payload);
        messageApi.success('Karyawan berhasil diperbarui');
      } else {
        await addUser({
          ...payload,
          password: 'password',
        });
        messageApi.success('Karyawan berhasil ditambahkan');
      }

      setModalOpen(false);
      setEditingId(null);
      setAvatarFile(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal menyimpan karyawan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Karyawan"
        subtitle="Kelola profil, foto, dan akses pengguna kasir"
        actions={
          canManage ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} className="bg-[#10b981] hover:bg-[#059669]">
              Tambah Karyawan
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {users.map((user) => (
          <Card
            key={user.id}
            className="overflow-hidden border-slate-200 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-[#303030]"
            styles={{ body: { padding: 20 } }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  size={48}
                  src={getMediaUrl(user.avatarUrl) || undefined}
                  className="flex-shrink-0 bg-[#10b981]/10 text-[#10b981]"
                >
                  {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
                <div className="min-w-0">
                  <h3 className="m-0 truncate text-sm font-black transition-colors group-hover:text-[#10b981]">
                    {user.fullName}
                  </h3>
                  <p className="m-0 mt-1 text-[10px] font-bold text-slate-500">@{user.username}</p>
                </div>
              </div>
              {canManage ? (
                <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(user)} />
              ) : null}
            </div>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-[#303030]">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-500 uppercase tracking-wider">Peran</span>
                <span className="text-[#10b981] uppercase tracking-widest">{formatRole(user.role)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-500 uppercase tracking-wider">Kontak</span>
                <span className="max-w-[140px] truncate text-slate-900 dark:text-slate-100">
                  {user.email || user.phone || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-500 uppercase tracking-wider">PIN</span>
                <span className="text-slate-900 dark:text-slate-100">{user.pinCode ? 'Terisi' : '-'}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Tag color={user.isActive ? 'success' : 'error'} className="m-0 border-none px-2 py-0.5 text-[10px] font-bold uppercase">
                {user.isActive ? 'Aktif' : 'Nonaktif'}
              </Tag>
              <span className="text-xs text-slate-400">{user.avatarUrl ? 'Foto tersedia' : 'Tanpa foto'}</span>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit Karyawan' : 'Tambah Karyawan'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        width="min(760px, calc(100vw - 1rem))"
      >
        <div className="space-y-5 pt-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Avatar size={72} src={getMediaUrl(previewUrl) || undefined} className="bg-[#10b981]/10 text-[#10b981]">
              {form.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
            <div className="space-y-2">
              <Upload
                beforeUpload={(file) => {
                  setAvatarFile(file);
                  return false;
                }}
                showUploadList={false}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />}>Pilih Foto</Button>
              </Upload>
              <p className="m-0 text-xs text-slate-500">Gunakan foto karyawan agar identifikasi lebih cepat.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Text strong className="mb-1 block">
                Nama Lengkap
              </Text>
              <Input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Masukkan nama" />
            </div>
            <div>
              <Text strong className="mb-1 block">
                Nama Pengguna
              </Text>
              <Input
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder="Username login"
              />
            </div>
            <div>
              <Text strong className="mb-1 block">
                Peran
              </Text>
              <Select
                className="w-full"
                value={form.role}
                onChange={(value) => setForm({ ...form, role: value as Role })}
                options={[
                  { value: 'owner', label: 'Pemilik' },
                  { value: 'manager', label: 'Manajer' },
                  { value: 'cashier', label: 'Kasir' },
                  { value: 'kitchen', label: 'Dapur' },
                ]}
              />
            </div>
            <div>
              <Text strong className="mb-1 block">
                Status
              </Text>
              <Select
                className="w-full"
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(value) => setForm({ ...form, isActive: value === 'active' })}
                options={[
                  { value: 'active', label: 'Aktif' },
                  { value: 'inactive', label: 'Nonaktif' },
                ]}
              />
            </div>
            <div>
              <Text strong className="mb-1 block">
                Telepon
              </Text>
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Nomor telepon" />
            </div>
            <div>
              <Text strong className="mb-1 block">
                Email
              </Text>
              <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Alamat email" />
            </div>
            <div>
              <Text strong className="mb-1 block">
                PIN
              </Text>
              <Input value={form.pinCode} onChange={(event) => setForm({ ...form, pinCode: event.target.value })} placeholder="PIN karyawan" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#303030] dark:bg-[#1f1f1f]">
              <Text strong className="mb-1 block">
                Foto Profil
              </Text>
              <Text type="secondary" className="block text-xs">
                Foto cukup diunggah dari perangkat. Kalau tidak upload foto baru saat edit, sistem akan tetap memakai foto yang lama.
              </Text>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
