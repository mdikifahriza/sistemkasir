'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Empty, Input, Modal, Space, Switch, Tag, Typography, App } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/widgets/PageHeader';
import { useDataStore } from '@/store/dataStore';

const { Title, Text } = Typography;

type CategoryFormState = {
  name: string;
  isActive: boolean;
};

const EMPTY_FORM: CategoryFormState = {
  name: '',
  isActive: true,
};

export default function CategoriesPage() {
  const router = useRouter();
  const categories = useDataStore((state) => state.categories);
  const products = useDataStore((state) => state.products);
  const addCategory = useDataStore((state) => state.addCategory);
  const updateCategory = useDataStore((state) => state.updateCategory);
  const removeCategory = useDataStore((state) => state.removeCategory);
  const { message: messageApi, modal } = App.useApp();

  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const usageMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((product) => {
      if (!product.categoryId) return;
      map.set(product.categoryId, (map.get(product.categoryId) || 0) + 1);
    });
    return map;
  }, [products]);

  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return [...categories]
      .filter((category) => {
        if (!keyword) return true;
        return category.name.toLowerCase().includes(keyword);
      });
  }, [categories, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    const category = categories.find((item) => item.id === id);
    if (!category) return;

    setEditingId(id);
    setForm({
      name: category.name || '',
      isActive: Boolean(category.isActive),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      messageApi.error('Nama kategori wajib diisi');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        isActive: form.isActive,
      };

      if (editingId) {
        await updateCategory(editingId, payload);
        messageApi.success('Kategori berhasil diperbarui');
      } else {
        await addCategory(payload);
        messageApi.success('Kategori berhasil ditambahkan');
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal menyimpan kategori');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const usedCount = usageMap.get(id) || 0;
    if (usedCount > 0) {
      messageApi.warning('Kategori yang sudah dipakai produk tidak bisa dihapus.');
      return;
    }

    modal.confirm({
      title: 'Hapus Kategori',
      content: 'Apakah Anda yakin ingin menghapus kategori ini?',
      okText: 'Hapus',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        setDeletingId(id);
        try {
          await removeCategory(id);
          messageApi.success('Kategori berhasil dihapus');
        } catch (error) {
          messageApi.error(error instanceof Error ? error.message : 'Gagal menghapus kategori');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Kategori"
        subtitle="Kelola kategori produk, atur tampilan, dan jaga agar kategori yang sudah dipakai tetap aman"
        actions={
          <Space wrap>
            <Button onClick={() => router.push('/products')}>Kembali ke Produk</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} className="bg-[#10b981] hover:bg-[#059669]">
              Tambah Kategori
            </Button>
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        title="Aturan hapus kategori"
        description="Kategori boleh dihapus kalau belum dipakai produk. Kalau sudah dipakai, kategori akan dikunci dan hanya bisa diubah informasinya."
      />

      <Card className="border-slate-200 shadow-sm dark:border-[#303030]">
        <Input
          size="large"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari kategori..."
          className="mb-6 w-full max-w-md"
        />

        {filteredCategories.length === 0 ? (
          <Empty description="Belum ada kategori" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCategories.map((category) => {
              const usageCount = usageMap.get(category.id) || 0;
              const locked = usageCount > 0;

              return (
                <Card
                  key={category.id}
                  className="border-slate-200 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-[#303030]"
                  styles={{ body: { padding: 18 } }}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Title level={5} className="!mb-1 truncate">
                        {category.name}
                      </Title>
                    </div>
                    <Space wrap>
                      <Tag color={category.isActive ? 'success' : 'default'} className="m-0">
                        {category.isActive ? 'Aktif' : 'Nonaktif'}
                      </Tag>
                      {locked ? <Tag color="gold" className="m-0">{usageCount} produk</Tag> : <Tag className="m-0">Kosong</Tag>}
                    </Space>
                  </div>

                  <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4 dark:border-[#303030]">
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => openEdit(category.id)}
                      className="flex-1"
                    >
                      Ubah
                    </Button>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(category.id)}
                      disabled={locked}
                      loading={deletingId === category.id}
                      className="flex-1"
                    >
                      Hapus
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit Kategori' : 'Tambah Kategori'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        width="min(560px, calc(100vw - 1rem))"
      >
        <div className="space-y-4 pt-4">
          <div>
            <Text strong className="mb-1 block">
              Nama Kategori
            </Text>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Masukkan nama kategori"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-[#303030]">
            <div>
              <Text strong className="block">
                Status Aktif
              </Text>
              <Text type="secondary" className="block text-xs">
                Nonaktifkan jika kategori sementara tidak ingin ditampilkan
              </Text>
            </div>
            <Switch checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
