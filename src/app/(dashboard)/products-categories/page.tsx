'use client';

import { useMemo, useState, useEffect } from 'react';
import { useDataStore } from '@/store/dataStore';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { PageHeader } from '@/components/widgets/PageHeader';
import { formatCurrency } from '@/lib/utils/format';
import { getMediaUrl } from '@/lib/utils/media';
import { uploadMedia } from '@/lib/upload';
import { Card, Button, Input, Select, Modal, Tag, Typography, InputNumber, Upload, Space, App, Empty, Switch, Segmented } from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UploadOutlined,
  ShopOutlined,
  AppstoreOutlined,
  PictureOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

type CategoryFormState = {
  name: string;
  isActive: boolean;
};

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  name: '',
  isActive: true,
};

export default function ProductsCategoriesPage() {
  const store = useDataStore((state) => state.store);
  const products = useDataStore((state) => state.products);
  const categories = useDataStore((state) => state.categories);
  const transactionDetails = useDataStore((state) => state.transactionDetails);
  
  // Actions
  const addProduct = useDataStore((state) => state.addProduct);
  const updateProduct = useDataStore((state) => state.updateProduct);
  const removeProduct = useDataStore((state) => state.removeProduct);
  const addCategory = useDataStore((state) => state.addCategory);
  const updateCategory = useDataStore((state) => state.updateCategory);
  const removeCategory = useDataStore((state) => state.removeCategory);
  
  const user = useCurrentUser();
  const { message: messageApi, modal } = App.useApp();

  // Tab State
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  
  // Search State
  const [search, setSearch] = useState('');

  // Product Form State
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    sellingPrice: 0,
    status: 'available' as const,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Category Form State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [savingCategory, setSavingCategory] = useState(false);

  // Effects for Image Preview
  useEffect(() => {
    if (!imageFile) {
      // If editing, use existing image
      if (editingProductId) {
        const prod = products.find(p => p.id === editingProductId);
        setImagePreview(prod?.imageUrl ? getMediaUrl(prod.imageUrl) : null);
      } else {
        setImagePreview(null);
      }
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile, editingProductId, products]);

  // Filters & Memos
  const filteredProducts = useMemo(() => {
    const keyword = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(keyword));
  }, [products, search]);

  const usageMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      if (!p.categoryId) return;
      map.set(p.categoryId, (map.get(p.categoryId) || 0) + 1);
    });
    return map;
  }, [products]);

  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return [...categories]
      .filter((c) => {
        if (!keyword) return true;
        return c.name.toLowerCase().includes(keyword);
      });
  }, [categories, search]);

  const usedProductIds = useMemo(
    () => new Set(transactionDetails.map((detail) => detail.productId).filter(Boolean)),
    [transactionDetails],
  );

  // --- Product Handlers ---
  const openCreateProduct = () => {
    setEditingProductId(null);
    setImageFile(null);
    setImagePreview(null);
    setProductForm({
      name: '',
      description: '',
      categoryId: categories[0]?.id || '',
      sellingPrice: 0,
      status: 'available',
    });
    setProductModalOpen(true);
  };

  const openEditProduct = (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setEditingProductId(id);
    setImageFile(null);
    setImagePreview(product.imageUrl ? getMediaUrl(product.imageUrl) : null);
    setProductForm({
      name: product.name,
      description: product.description || '',
      categoryId: product.categoryId || '',
      sellingPrice: product.sellingPrice,
      status: (product as any).status || 'available',
    });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async () => {
    // Validation
    if (!productForm.name.trim()) return messageApi.error('Nama produk wajib diisi');
    if (!productForm.categoryId) return messageApi.error('Kategori wajib dipilih');
    if (productForm.sellingPrice <= 0) return messageApi.error('Harga jual harus lebih dari 0');
    if (!editingProductId && !imageFile) return messageApi.error('Gambar produk wajib diunggah');
    if (!productForm.description?.trim()) return messageApi.error('Deskripsi produk wajib diisi');

    try {
      let imageUrl = '';
      const existing = editingProductId ? products.find((item) => item.id === editingProductId) : null;
      if (existing?.imageUrl) imageUrl = existing.imageUrl;
      
      if (imageFile) {
        const upload = await uploadMedia(imageFile, 'products');
        imageUrl = upload.publicUrl;
      }

      if (editingProductId) {
        await updateProduct(editingProductId, {
          ...productForm,
          categoryId: productForm.categoryId || null,
          imageUrl,
        } as any);
        messageApi.success('Produk berhasil diperbarui');
      } else {
        await addProduct({
          ...productForm,
          categoryId: productForm.categoryId || null,
          imageUrl,
          createdBy: user?.id || undefined,
        } as any);
        messageApi.success('Produk berhasil ditambahkan');
      }
      setProductModalOpen(false);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal menyimpan produk');
    }
  };

  const handleRemoveProduct = (id: string) => {
    if (usedProductIds.has(id)) {
      messageApi.warning('Produk yang sudah pernah dipakai transaksi tidak bisa dihapus.');
      return;
    }
    modal.confirm({
      title: 'Hapus Produk',
      content: 'Apakah Anda yakin ingin menghapus produk ini?',
      okText: 'Hapus',
      okType: 'danger',
      onOk: async () => {
        try {
          await removeProduct(id);
          messageApi.success('Produk berhasil dihapus');
        } catch (error) {
          messageApi.error('Gagal menghapus produk');
        }
      }
    });
  };

  // --- Category Handlers ---
  const openCreateCategory = () => {
    setEditingCategoryId(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setCategoryModalOpen(true);
  };

  const openEditCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    setEditingCategoryId(id);
    setCategoryForm({
      name: cat.name,
      isActive: Boolean(cat.isActive),
    });
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return messageApi.error('Nama kategori wajib diisi');
    setSavingCategory(true);
    try {
      const payload = { ...categoryForm, name: categoryForm.name.trim() };
      if (editingCategoryId) {
        await updateCategory(editingCategoryId, payload);
        messageApi.success('Kategori diperbarui');
      } else {
        await addCategory(payload);
        messageApi.success('Kategori ditambahkan');
      }
      setCategoryModalOpen(false);
    } catch (error) {
      messageApi.error('Gagal menyimpan kategori');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleRemoveCategory = (id: string) => {
    if (usageMap.get(id) || 0 > 0) return messageApi.warning('Kategori masih memiliki produk.');
    modal.confirm({
      title: 'Hapus Kategori',
      content: 'Hapus kategori ini?',
      okType: 'danger',
      onOk: async () => {
        try {
          await removeCategory(id);
          messageApi.success('Kategori dihapus');
        } catch (error) {
          messageApi.error('Gagal menghapus');
        }
      }
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Manajemen Produk & Kategori"
        subtitle="Kelola menu, kategori, dan stok produk restoran Anda dalam satu tempat"
        actions={
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={activeTab === 'products' ? openCreateProduct : openCreateCategory}
            className="bg-[#10b981] hover:bg-[#059669]"
          >
            Tambah {activeTab === 'products' ? 'Produk' : 'Kategori'}
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Segmented
          size="large"
          value={activeTab}
          onChange={(v) => { setActiveTab(v as any); setSearch(''); }}
          options={[
            { label: 'Daftar Produk', value: 'products', icon: <ShopOutlined /> },
            { label: 'Kategori Menu', value: 'categories', icon: <AppstoreOutlined /> },
          ]}
          className="p-1 bg-slate-100 dark:bg-[#1f1f1f] rounded-xl"
        />
        
        <Input
          size="large"
          prefix={<SearchOutlined className="text-slate-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Cari ${activeTab === 'products' ? 'produk' : 'kategori'}...`}
          className="w-full sm:max-w-xs rounded-xl shadow-sm"
        />
      </div>

      {activeTab === 'products' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((p) => {
              const hasHistory = usedProductIds.has(p.id);
              return (
                <Card 
                  key={p.id} 
                  className="group relative overflow-hidden rounded-2xl border-slate-200 hover:shadow-xl transition-all duration-300 dark:border-[#303030] dark:bg-[#141414]"
                  styles={{ body: { padding: 0 } }}
                >
                  <div className="aspect-video relative bg-slate-50 dark:bg-[#1f1f1f] overflow-hidden">
                    {p.imageUrl ? (
                      <img src={getMediaUrl(p.imageUrl)} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300 font-black text-xl uppercase select-none sm:text-2xl">
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      <Tag color="blue" className="m-0 max-w-[calc(100%-0.5rem)] truncate rounded-md border-none text-[9px] font-bold uppercase sm:text-[10px]">
                        {categories.find(c => c.id === p.categoryId)?.name || 'Umum'}
                      </Tag>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4">
                    <Title level={5} className="!mb-1 truncate !text-sm sm:!text-base">{p.name}</Title>
                    <div className="mt-2 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between">
                      <div className="flex flex-col">
                        <Text type="secondary" className="text-[10px] font-bold uppercase">Harga</Text>
                        <Text className="text-base font-black text-[#10b981] sm:text-lg">{formatCurrency(p.sellingPrice, store.currency)}</Text>
                      </div>
                      <Tag color={p.status === 'available' ? 'success' : 'warning'} className="m-0 w-fit border-none text-[9px] font-bold uppercase">
                        {p.status}
                      </Tag>
                    </div>
                    <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-3 dark:border-[#303030] sm:mt-4 sm:gap-2 sm:pt-4">
                      <Button block size="small" icon={<EditOutlined />} onClick={() => openEditProduct(p.id)}>Ubah</Button>
                      <Button block danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveProduct(p.id)} disabled={hasHistory} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCategories.map((c) => {
              const count = usageMap.get(c.id) || 0;
              return (
                <Card 
                  key={c.id} 
                  className="shadow-sm border-slate-200 hover:border-[#10b981]/50 transition-all dark:border-[#303030]"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <Title level={5} className="!mb-0">{c.name}</Title>
                    </div>
                    <Tag color={c.isActive ? 'green' : 'default'} className="m-0">{c.isActive ? 'Aktif' : 'Nonaktif'}</Tag>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{count} Produk Terdaftar</Text>
                    <Space>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditCategory(c.id)} />
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveCategory(c.id)} disabled={count > 0} />
                    </Space>
                  </div>
                </Card>
              );
            })}
            {filteredCategories.length === 0 && <div className="col-span-full py-10"><Empty description="Kategori tidak ditemukan" /></div>}
          </div>
        </div>
      )}

      {/* Product Modal */}
      <Modal
        open={productModalOpen}
        title={editingProductId ? 'Ubah Produk' : 'Tambah Produk Baru'}
        onCancel={() => setProductModalOpen(false)}
        onOk={handleSaveProduct}
        centered
        destroyOnHidden
        width={600}
      >
        <div className="space-y-4 pt-4">
          <div>
            <Text strong className="text-xs mb-1 block">Nama Menu/Produk *</Text>
            <Input value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="e.g. Es Teh Manis" />
          </div>
          <div>
            <Text strong className="text-xs mb-1 block">Deskripsi Produk *</Text>
            <TextArea rows={3} value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} placeholder="Masukkan deskripsi produk..." />
          </div>
          <div>
            <Text strong className="text-xs mb-1 block">Kategori *</Text>
            <Select
              style={{ width: '100%' }}
              value={productForm.categoryId}
              onChange={v => setProductForm({ ...productForm, categoryId: v })}
              placeholder="Pilih Kategori"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categories.map(c => ({ label: c.name, value: c.id }))}
            />
          </div>
          <div>
            <Text strong className="text-xs mb-1 block">Harga *</Text>
            <InputNumber
              style={{ width: '100%' }}
              value={productForm.sellingPrice}
              onChange={v => setProductForm({ ...productForm, sellingPrice: v || 0 })}
              formatter={v => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={v => v?.replace(/[^\d]/g, '') as any}
              size="large"
            />
          </div>
          <div>
            <Text strong className="text-xs mb-1 block">Status *</Text>
            <Select
              style={{ width: '100%' }}
              value={productForm.status}
              onChange={v => setProductForm({ ...productForm, status: v })}
              size="large"
              options={[
                { label: 'Tersedia', value: 'available' },
                { label: 'Habis', value: 'sold_out' },
                { label: 'Tidak Dijual', value: 'discontinued' },
              ]}
            />
          </div>
          <div>
            <Text strong className="text-xs mb-1 block">Foto Produk *</Text>
            <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed border-slate-200 dark:border-[#303030] rounded-xl bg-slate-50 dark:bg-[#1f1f1f]">
              {imagePreview ? (
                <div className="relative group w-full aspect-video rounded-lg overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button type="primary" danger icon={<DeleteOutlined />} onClick={() => { setImageFile(null); setImagePreview(null); }}>Hapus Gambar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                  <PictureOutlined className="text-4xl mb-2" />
                  <Text type="secondary">Seret gambar atau klik tombol di bawah</Text>
                </div>
              )}
              <Upload 
                beforeUpload={f => { setImageFile(f); return false; }} 
                maxCount={1} 
                showUploadList={false}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />} block type="dashed">Pilih File Gambar</Button>
              </Upload>
            </div>
          </div>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal
        open={categoryModalOpen}
        title={editingCategoryId ? 'Ubah Kategori' : 'Tambah Kategori Baru'}
        onCancel={() => setCategoryModalOpen(false)}
        onOk={handleSaveCategory}
        confirmLoading={savingCategory}
        centered
        destroyOnHidden
        width={600}
      >
        <div className="space-y-4 pt-4">
          <div>
            <Text strong className="text-xs mb-1 block">Nama Kategori</Text>
            <Input value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="e.g. Minuman Dingin" />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#1f1f1f] rounded-lg">
            <Text strong>Tampilkan di Menu</Text>
            <Switch checked={categoryForm.isActive} onChange={v => setCategoryForm({ ...categoryForm, isActive: v })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
