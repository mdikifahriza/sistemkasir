'use client';

import { useState, useEffect } from 'react';
import { useDataStore } from '@/store/dataStore';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { uploadMedia } from '@/lib/upload';
import { PageHeader } from '@/components/widgets/PageHeader';
import { formatCurrency, formatDateOnly } from '@/lib/utils/format';
import { getMediaUrl } from '@/lib/utils/media';
import { Card, Input, InputNumber, Select, Button, message, Typography, Upload, Checkbox, Tag, App } from 'antd';
import { SaveOutlined, UploadOutlined, FileTextOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Title, Text } = Typography;

export default function ExpensesPage() {
  const expenses = useDataStore((state) => state.expenses);
  const expenseCategories = useDataStore((state) => state.expenseCategories);
  const addExpense = useDataStore((state) => state.addExpense);
  const currentShiftId = useDataStore((state) => state.currentShiftId);
  const store = useDataStore((state) => state.store);
  const user = useCurrentUser();
  const { message: messageApi } = App.useApp();

  const [form, setForm] = useState({
    amount: 0,
    categoryId: expenseCategories[0]?.id || '',
    vendorName: '',
    description: '',
    isForHpp: false,
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Auto-set HPP based on category
  useEffect(() => {
    const category = expenseCategories.find(c => c.id === form.categoryId);
    if (category) {
      setForm(prev => ({ ...prev, isForHpp: category.isForHpp }));
    }
  }, [form.categoryId, expenseCategories]);

  const handleAdd = async () => {
    if (!user) return;
    const amt = Number(form.amount);
    if (!amt) {
      messageApi.error('Nominal wajib diisi');
      return;
    }
    try {
      let receiptImageUrl = '';
      if (receiptFile) {
        const upload = await uploadMedia(receiptFile, 'expenses');
        receiptImageUrl = upload.publicUrl;
      }

      await addExpense({
        shiftSessionId: currentShiftId,
        expenseCategoryId: form.categoryId || null,
        amount: amt,
        description: form.description,
        vendorName: form.vendorName || undefined,
        isForHpp: form.isForHpp,
        receiptImageUrl,
        recordedBy: user.id,
        expenseDate: new Date().toISOString(),
        status: 'recorded',
      } as any);

      messageApi.success('Pengeluaran berhasil dicatat');
      setForm({ amount: 0, categoryId: expenseCategories[0]?.id || '', vendorName: '', description: '', isForHpp: false });
      setReceiptFile(null);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal menyimpan pengeluaran');
    }
  };

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      setReceiptFile(file);
      return false;
    },
    onRemove: () => setReceiptFile(null),
    maxCount: 1,
    accept: "image/*"
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader title="Keuangan" subtitle="Catat pengeluaran dan operasional" />

      <Card className="shadow-sm border-slate-200 dark:border-[#303030] overflow-hidden">
        <div className="bg-slate-50 dark:bg-[#141414] p-4 border-b border-slate-200 dark:border-[#303030] flex items-center justify-between">
            <Title level={5} style={{ margin: 0 }}>Input Pengeluaran</Title>
            {!currentShiftId && <Tag color="error">Shift Belum Dibuka</Tag>}
        </div>
        <div className="p-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div>
                <Text strong className="block mb-2 text-xs uppercase tracking-wider text-slate-500">Nominal</Text>
                <InputNumber
                className="w-full h-12 text-lg font-black"
                style={{ width: '100%' }}
                min={0}
                value={form.amount}
                onChange={(value) => setForm({ ...form, amount: value || 0 })}
                formatter={value => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={value => value?.replace(/[^\d]/g, '') as unknown as number}
                />
            </div>
            <div>
                <Text strong className="block mb-2 text-xs uppercase tracking-wider text-slate-500">Kategori</Text>
                <Select
                className="w-full h-12"
                value={form.categoryId || undefined}
                onChange={(value) => setForm({ ...form, categoryId: value })}
                options={expenseCategories.map((category) => ({ value: category.id, label: category.name }))}
                placeholder="Pilih kategori"
                />
            </div>
            <div className="lg:col-span-2">
                <Text strong className="block mb-2 text-xs uppercase tracking-wider text-slate-500">Vendor / Toko</Text>
                <Input
                className="h-12"
                value={form.vendorName}
                onChange={(event) => setForm({ ...form, vendorName: event.target.value })}
                placeholder="Contoh: Pasar Induk, Toko Berkah, Agen Gas"
                />
            </div>
            <div className="lg:col-span-4">
                <Text strong className="block mb-2 text-xs uppercase tracking-wider text-slate-500">Deskripsi</Text>
                <Input
                className="h-12"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Contoh: beli daging 5kg, isi ulang gas, beli tisu"
                />
            </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 mb-6">
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <Checkbox 
                        checked={form.isForHpp} 
                        onChange={e => setForm({ ...form, isForHpp: e.target.checked })}
                        className="font-bold text-amber-700 dark:text-amber-400"
                    >
                        Tandai sebagai Bahan Baku (HPP)
                    </Checkbox>
                    <p className="text-[10px] text-amber-600/70 mt-1 m-0 ml-6">Akan dihitung dalam Food Cost di laporan laba rugi.</p>
                </div>

                <Upload {...uploadProps}>
                    <Button icon={<UploadOutlined />} className="h-12 px-6 rounded-xl">Lampirkan Nota</Button>
                </Upload>
            </div>

            <Button 
                type="primary" 
                size="large" 
                icon={<SaveOutlined />} 
                onClick={handleAdd} 
                className="bg-[#10b981] hover:bg-[#059669] h-14 px-8 font-black rounded-xl shadow-lg shadow-emerald-500/20"
            >
                SIMPAN PENGELUARAN
            </Button>
        </div>
      </Card>

      <div className="pt-4">
        <Title level={5} className="mb-4">Daftar Pengeluaran Terakhir</Title>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {expenses.map((expense) => (
            <div key={expense.id} className="relative group bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#303030] rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between overflow-hidden">
                <div className="space-y-4 relative z-10">
                <div className="flex items-start justify-between">
                    <div>
                    <h3 className="text-sm font-black tracking-tight group-hover:text-[#10b981] transition-colors m-0">{formatDateOnly(expense.expenseDate)}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 m-0">
                        {expenseCategories.find((cat) => cat.id === expense.expenseCategoryId)?.name || 'Lainnya'}
                    </p>
                    {expense.vendorName ? (
                      <p className="text-[11px] text-slate-500 mt-1 m-0">{expense.vendorName}</p>
                    ) : null}
                    </div>
                    <div className="flex gap-2">
                        {expense.isForHpp && (
                            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                                <ShoppingCartOutlined />
                            </div>
                        )}
                        {expense.receiptImageUrl && (
                            <a href={getMediaUrl(expense.receiptImageUrl)} target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-[#10b981] hover:text-white transition-all shadow-sm">
                                <FileTextOutlined />
                            </a>
                        )}
                    </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#303030]">
                    <p className="text-xs font-medium line-clamp-2 italic opacity-80 m-0">&quot;{expense.description || 'Tidak ada deskripsi'}&quot;</p>
                </div>
                </div>

                <div className="mt-6 flex items-end justify-between relative z-10">
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 opacity-70 m-0">Nominal</p>
                    <p className="text-lg font-black text-red-500 m-0">{formatCurrency(expense.amount, store.currency)}</p>
                </div>
                {expense.isForHpp && <Tag color="orange" className="m-0 text-[9px] font-bold uppercase border-none px-2 rounded-full">Bahan Baku</Tag>}
                </div>
            </div>
            ))}
        </div>
      </div>
    </div>
  );
}
