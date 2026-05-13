'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDataStore } from '@/store/dataStore';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { PageHeader } from '@/components/widgets/PageHeader';
import { formatCurrency } from '@/lib/utils/format';
import { getMediaUrl } from '@/lib/utils/media';
import { uploadMedia } from '@/lib/upload';
import { Card, Button, Input, Select, Modal, Tag, message, Typography, InputNumber, Upload, Space, App } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function ProductsPage() {
  const router = useRouter();
  const store = useDataStore((state) => state.store);
  const products = useDataStore((state) => state.products);
  const categories = useDataStore((state) => state.categories);
  const transactionDetails = useDataStore((state) => state.transactionDetails);
  const addProduct = useDataStore((state) => state.addProduct);
  const updateProduct = useDataStore((state) => state.updateProduct);
  const removeProduct = useDataStore((state) => state.removeProduct);
  const user = useCurrentUser();
  const { message: messageApi, modal } = App.useApp();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    sellingPrice: 0,
    status: 'available' as const,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [csvInput, setCsvInput] = useState('');

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(keyword)
    );
  }, [products, search]);
  const usedProductIds = useMemo(
    () => new Set(transactionDetails.map((detail) => detail.productId).filter(Boolean)),
    [transactionDetails],
  );
  const isEditingLocked = editingId ? usedProductIds.has(editingId) : false;

  const openCreate = () => {
    setEditingId(null);
    setImageFile(null);
    setForm({
      name: '',
      description: '',
      categoryId: categories[0]?.id || '',
      sellingPrice: 0,
      status: 'available',
    });
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setEditingId(id);
    setImageFile(null);
    setForm({
      name: product.name,
      description: product.description || '',
      categoryId: product.categoryId || '',
      sellingPrice: product.sellingPrice,
      status: (product as any).status || 'available',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      let imageUrl = '';
      const existing = editingId ? products.find((item) => item.id === editingId) : null;
      if (existing?.imageUrl) {
        imageUrl = existing.imageUrl;
      }
      if (imageFile) {
        const upload = await uploadMedia(imageFile, 'products');
        imageUrl = upload.publicUrl;
      }

      if (editingId) {
        await updateProduct(editingId, {
          name: form.name,
          description: form.description,
          categoryId: form.categoryId || null,
          ...(isEditingLocked ? {} : { sellingPrice: Number(form.sellingPrice) }),
          status: form.status,
          imageUrl,
        } as any);
        messageApi.success('Produk berhasil diperbarui');
      } else {
        await addProduct({
          name: form.name,
          categoryId: form.categoryId || null,
          description: form.description,
          unit: 'pcs',
          sellingPrice: Number(form.sellingPrice),
          status: form.status,
          imageUrl,
          createdBy: user?.id || undefined,
        } as any);
        messageApi.success('Produk berhasil ditambahkan');
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal menyimpan produk');
      return;
    }

    setModalOpen(false);
  };

  const handleImport = async () => {
    const rows = csvInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    let count = 0;
    await Promise.all(
      rows.map(async (row) => {
        const [name, price, categoryName] = row.split(',').map((cell) => cell.trim());
        if (!name) return;
        const category = categories.find((cat) => cat.name.toLowerCase() === categoryName?.toLowerCase());
        await addProduct({
          name,
          categoryId: category?.id || null,
          description: '',
          unit: 'pcs',
          sellingPrice: Number(price) || 0,
          status: 'available',
          imageUrl: '',
          createdBy: user?.id || undefined,
        } as any);
        count++;
      })
    );

    messageApi.success(`Berhasil mengimpor ${count} produk`);
    setCsvInput('');
  };

  const handleRemove = async (id: string) => {
    if (usedProductIds.has(id)) {
      messageApi.warning('Produk yang sudah pernah dipakai transaksi tidak bisa dihapus. Ubah status menjadi Diarsipkan.');
      return;
    }

    modal.confirm({
      title: 'Hapus Produk',
      content: 'Apakah Anda yakin ingin menghapus produk ini?',
      okText: 'Hapus',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await removeProduct(id);
          messageApi.success('Produk berhasil dihapus');
        } catch (error) {
          messageApi.error(error instanceof Error ? error.message : 'Gagal menghapus produk');
        }
      }
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Produk"
        subtitle="Kelola menu dan produk restoran"
        actions={
          <Space wrap>
            <Button onClick={() => router.push('/categories')}>Kelola Kategori</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} className="bg-[#10b981] hover:bg-[#059669]">
              Tambah Produk
            </Button>
          </Space>
        }
      />

      <Card className="shadow-sm border-slate-200 dark:border-[#303030]">
        <Input
          size="large"
          prefix={<SearchOutlined className="text-slate-400" />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nama produk..."
          className="mb-6 w-full max-w-md"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => {
            const hasHistory = usedProductIds.has(product.id);

            return (
            <div key={product.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-[#303030] bg-white dark:bg-[#141414] transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="aspect-square w-full relative bg-slate-50 dark:bg-[#1f1f1f] overflow-hidden">
                {product.imageUrl ? (
                  <img src={getMediaUrl(product.imageUrl)} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-[#303030] font-black text-4xl select-none">
                    {product.name.charAt(0)}
                  </div>
                )}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                  <div className="bg-black/60 text-white text-[9px] font-bold px-2 py-1 rounded-full backdrop-blur-md w-fit uppercase tracking-tighter">
                    {categories.find((cat) => cat.id === product.categoryId)?.name || 'Umum'}
                  </div>
                  <Tag color={product.status === 'available' ? 'success' : product.status === 'sold_out' ? 'warning' : 'error'} className="m-0 border-none font-bold text-[9px] uppercase px-2 py-0.5 rounded-full">
                    {product.status === 'available' ? 'Tersedia' : product.status === 'sold_out' ? 'Habis' : 'Arsip'}
                  </Tag>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="mb-auto">
                  <h3 className="text-sm font-extrabold line-clamp-2 leading-tight group-hover:text-[#10b981] transition-colors m-0">{product.name}</h3>
                  {product.description ? (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{product.description}</p>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1">Harga Jual</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">{formatCurrency(product.sellingPrice, store.currency)}</span>
                  </div>
                  {hasHistory ? (
                    <Tag color="gold" className="m-0 border-none px-2 py-0.5 text-[9px] font-bold uppercase">
                      Harga Terkunci
                    </Tag>
                  ) : null}
                </div>

                <div className="mt-4 flex gap-2 border-t border-slate-100 dark:border-[#303030] pt-4">
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(product.id)} className="flex-1 h-9 rounded-xl font-bold text-xs bg-slate-50 dark:bg-[#1f1f1f] hover:bg-[#10b981]/10 hover:text-[#10b981] transition-all">
                    Ubah
                  </Button>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemove(product.id)}
                    disabled={hasHistory}
                    className="flex-1 h-9 rounded-xl font-bold text-xs transition-all border border-transparent"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full shadow-sm border-slate-200 dark:border-[#303030]">
          <Title level={4} className="mb-2">Kategori Dipisah ke Modul Sendiri</Title>
          <Text type="secondary" className="block mb-4">
            Kelola kategori lewat modul khusus agar aturan hapus kategori dan relasi produk lebih rapi.
          </Text>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 8).map((category) => (
              <Tag key={category.id} color="blue" className="px-3 py-1 text-sm">
                {category.name}
              </Tag>
            ))}
          </div>
          <div className="mt-4">
            <Button onClick={() => router.push('/categories')}>Buka Modul Kategori</Button>
          </div>
        </Card>

        <Card className="h-full shadow-sm border-slate-200 dark:border-[#303030]">
          <Title level={4} className="mb-2">Impor CSV</Title>
          <Text type="secondary" className="block mb-4">
            Format: <Text code>nama,harga,kategori</Text>
          </Text>
          <TextArea
            rows={5}
            value={csvInput}
            onChange={(event) => setCsvInput(event.target.value)}
            placeholder="Produk Baru,12000,Makanan"
            className="mb-4"
          />
          <Button onClick={handleImport} icon={<UploadOutlined />}>
            Impor Data
          </Button>
        </Card>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit Produk' : 'Tambah Produk'}
        onCancel={() => setModalOpen(false)}
        width="min(600px, calc(100vw - 1rem))"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button key="cancel" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button key="submit" className="w-full bg-[#10b981] hover:bg-[#059669] sm:w-auto" type="primary" onClick={handleSave}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 pt-4">
          <div>
            <Text strong className="block mb-1">Nama Produk</Text>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Masukkan nama produk"
            />
          </div>
          <div>
            <Text strong className="block mb-1">Deskripsi</Text>
            <TextArea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={3}
              placeholder="Deskripsi singkat menu atau catatan penyajian"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Text strong className="block mb-1">Kategori</Text>
              <Select
                value={form.categoryId || undefined}
                onChange={(value) => setForm({ ...form, categoryId: value })}
                className="w-full"
                placeholder="Pilih Kategori"
                options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
              />
            </div>
            <div>
              <Text strong className="block mb-1">Status</Text>
              <Select
                value={form.status}
                onChange={(value) => setForm({ ...form, status: value })}
                className="w-full"
                options={[
                  { value: 'available', label: 'Tersedia' },
                  { value: 'sold_out', label: 'Habis (Sold Out)' },
                  { value: 'discontinued', label: 'Diarsipkan' },
                ]}
              />
            </div>
          </div>
          <div>
            <Text strong className="block mb-1">Harga Jual</Text>
            <InputNumber
              value={form.sellingPrice}
              onChange={(value) => setForm({ ...form, sellingPrice: value || 0 })}
              className="w-full"
              style={{ width: '100%' }}
              min={0}
              disabled={isEditingLocked}
              formatter={value => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={value => value?.replace(/[^\d]/g, '') as unknown as number}
            />
            {isEditingLocked ? (
              <Text type="secondary" className="mt-1 block text-xs">
                Harga jual terkunci karena produk ini sudah pernah dipakai transaksi. Jika ingin harga baru, buat produk baru.
              </Text>
            ) : null}
          </div>
          <div className="md:col-span-2">
            <Text strong className="block mb-1">Foto Produk</Text>
            <Upload
              beforeUpload={(file) => {
                setImageFile(file);
                return false;
              }}
              maxCount={1}
              accept="image/*"
              listType="picture"
            >
              <Button icon={<UploadOutlined />}>Pilih Foto</Button>
            </Upload>
          </div>
        </div>
      </Modal>
    </div>
  );
}
