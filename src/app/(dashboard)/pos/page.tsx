'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDataStore } from '@/store/dataStore';
import { useCartStore } from '@/store/cartStore';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { ShoppingCart, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useCurrentShiftState } from '@/lib/hooks/useCurrentShiftState';
import { formatCurrency } from '@/lib/utils/format';
import { Alert, Button, Input, Result, Select, Spin, Typography } from 'antd';

const { Title, Text } = Typography;

export default function POSPage() {
  const { currentSession, isInitialized } = useCurrentShiftState();
  const { items, clear: clearCart, total: totalFn } = useCartStore();
  const store = useDataStore((state) => state.store);
  const tables = useDataStore((state) => state.tables);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'platform'>('dine_in');
  const [isPaymentOpen, setPaymentOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [platformSource, setPlatformSource] = useState('');

  const taxRate = Number(store.taxPercentage) || 0;
  const serviceChargeRate = Number(store.serviceChargePercentage) || 0;
  const cartTotal = totalFn(taxRate, serviceChargeRate);
  const selectableTables = useMemo(
    () =>
      tables.filter((table) => table.status !== 'inactive' && table.status !== 'maintenance'),
    [tables],
  );
  const selectedTable = selectableTables.find((table) => table.id === selectedTableId) ?? null;
  const isPaymentBlocked =
    orderType === 'dine_in'
      ? !selectedTableId
      : orderType === 'platform'
        ? !platformSource.trim()
        : false;

  useEffect(() => {
    if (orderType !== 'dine_in') {
      return;
    }

    if (selectedTableId && selectableTables.some((table) => table.id === selectedTableId)) {
      return;
    }

    setSelectedTableId(selectableTables[0]?.id || '');
  }, [orderType, selectableTables, selectedTableId]);

  useEffect(() => {
    if (orderType !== 'platform' && platformSource) {
      setPlatformSource('');
    }
  }, [orderType, platformSource]);

  // Show loading only if not initialized AND no current session
  if (!isInitialized) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-2">
        <Spin size="large" />
        <Text type="secondary" className="mt-2">Memuat data shift...</Text>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
        <Result
            status="warning"
            title="Shift Belum Dibuka"
            subTitle="Anda perlu membuka shift baru sebelum dapat melakukan transaksi penjualan."
            extra={
                <Link href="/shifts">
                    <Button type="primary" size="large" className="bg-[#10b981] hover:bg-[#059669]">
                        Buka Shift Sekarang
                    </Button>
                </Link>
            }
        />
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-col overflow-hidden bg-slate-50 dark:bg-[#141414] md:flex-row h-[calc(100svh-theme(spacing.16))] md:h-[calc(100vh-theme(spacing.16))] pb-[env(safe-area-inset-bottom)]">

      {/* Left Column: Product Grid */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${activeTab === 'cart' ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b border-slate-200 dark:border-[#303030] bg-white dark:bg-[#141414] flex items-center gap-3">
          <Select
            value={orderType}
            onChange={setOrderType}
            className="w-44"
            options={[
              { value: 'dine_in', label: 'Makan di Tempat' },
              { value: 'takeaway', label: 'Bungkus / Takeaway' },
              { value: 'platform', label: 'Grab / Shopee Food' },
            ]}
          />
          {orderType === 'dine_in' ? (
            <Select
              value={selectedTableId || undefined}
              onChange={setSelectedTableId}
              className="w-48"
              placeholder="Pilih meja"
              options={selectableTables.map((table) => ({
                value: table.id,
                label: `${table.name}${table.status === 'occupied' ? ' • Terisi' : ''}`,
              }))}
            />
          ) : null}
          {orderType === 'platform' ? (
            <Input
              value={platformSource}
              onChange={(event) => setPlatformSource(event.target.value)}
              placeholder="Contoh: GF-12345 / ShopeeFood - Andi"
              className="max-w-md"
            />
          ) : null}
          {orderType === 'takeaway' && (
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2 py-1 rounded-full uppercase">
              Mode Antrian Aktif
            </div>
          )}
        </div>
        {orderType === 'dine_in' && !selectedTableId ? (
          <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 dark:border-amber-900/30 dark:bg-amber-950/20">
            <Alert
              type="warning"
              showIcon
              title="Pilih meja terlebih dahulu agar pesanan kasir bisa masuk ke KDS dengan lokasi yang benar."
            />
          </div>
        ) : null}
        <div className="flex-1 overflow-hidden">
          <ProductGrid className="h-full" />
        </div>
      </div>

      {/* Right Column: Cart */}
      <div className={`w-full md:w-[400px] h-full flex-shrink-0 flex flex-col min-h-0 border-slate-200 dark:border-[#303030] md:border-l bg-white dark:bg-[#1f1f1f] ${activeTab === 'products' ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile Header for Cart - Keep this as it has the back button */}
        <div className="md:hidden flex items-center p-3 border-b border-slate-200 dark:border-[#303030] bg-white dark:bg-[#1f1f1f] sticky top-0 z-20">
          <Button type="text" icon={<ArrowLeft size={20} />} onClick={() => setActiveTab('products')} className="mr-2" />
          <Title level={5} style={{ margin: 0, flex: 1 }}>Keranjang</Title>
          <div className="text-xs font-bold text-slate-500 mr-2">
            {items.length} Item
          </div>
          {items.length > 0 ? (
            <Button
              type="text"
              danger
              icon={<Trash2 size={16} />}
              onClick={clearCart}
            />
          ) : null}
        </div>

        <Cart
          className="flex-1 overflow-hidden"
          orderType={orderType}
          onPayment={() => setPaymentOpen(true)}
        />
      </div>

      {/* Mobile Mini Cart Bar */}
      {activeTab === 'products' && items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 md:hidden pb-[calc(env(safe-area-inset-bottom)+0.75rem)] px-4">
          <Button
            type="primary"
            size="large"
            block
            onClick={() => setActiveTab('cart')}
            className="h-14 flex items-center justify-between px-4 bg-[#10b981] hover:bg-[#059669] border-none shadow-lg shadow-emerald-500/30 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <ShoppingCart className="h-4 w-4 text-white" />
              </span>
              <div className="text-left">
                <div className="text-[10px] font-semibold text-white/80 leading-tight">{items.length} Item</div>
                <div className="text-sm font-bold text-white leading-tight">{formatCurrency(cartTotal)}</div>
              </div>
            </div>
            <span className="text-sm font-semibold text-white">Lihat Keranjang</span>
          </Button>
        </div>
      )}

      {/* Modals */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setPaymentOpen(false)}
        orderType={orderType}
        tableId={orderType === 'dine_in' ? selectedTableId : null}
        tableName={selectedTable?.name ?? null}
        orderSource={orderType === 'platform' ? platformSource.trim() : null}
        isCheckoutBlocked={isPaymentBlocked}
        onSuccess={() => {
          setPaymentOpen(false);
          // Optionally ask to print or new transaction handled in modal
        }}
      />
    </div>
  );
}
