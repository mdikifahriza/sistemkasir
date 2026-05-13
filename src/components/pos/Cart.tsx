'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, Divider, Empty, Input, InputNumber, Typography, Space } from 'antd';
import { CreditCard, Minus, Plus, Trash2, User, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { useCartStore } from '@/store/cartStore';
import { useDataStore } from '@/store/dataStore';

const { Text, Title } = Typography;

interface CartProps {
  className?: string;
  orderType: 'dine_in' | 'takeaway' | 'platform';
  onPayment: () => void;
}

export function Cart({ className, onPayment }: CartProps) {
  const {
    items,
    subtotal,
    discount,
    customerName,
    serviceCharge: scFn,
    tax: taxFn,
    total: totalFn,
    removeItem,
    updateQuantity,
    setDiscount,
    setCustomerName,
    clear: clearCart,
  } = useCartStore();

  const store = useDataStore((state) => state.store);
  const taxRate = store.taxPercentage || 0;
  const serviceChargeRate = store.serviceChargePercentage || 0;

  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);

  const serviceCharge = scFn(serviceChargeRate);
  const tax = taxFn(taxRate, serviceChargeRate);
  const total = totalFn(taxRate, serviceChargeRate);

  const handleQuantityChange = (productId: string, currentQty: number, delta: number) => {
    const nextQty = currentQty + delta;
    if (nextQty > 0) {
      updateQuantity(productId, nextQty);
    }
  };

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const updateHeight = () => setFooterHeight(footer.offsetHeight || 0);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`flex h-full min-h-0 flex-col border-slate-200 bg-white dark:border-[#303030] dark:bg-[#1f1f1f] md:border-l ${className || ''}`}
      style={{ '--cart-footer-height': `${footerHeight}px` } as CSSProperties}
    >
      <div className="hidden items-center justify-between border-b border-slate-200 p-4 dark:border-[#303030] md:flex">
        <div className="flex items-center gap-2">
          <Title level={4} style={{ margin: 0 }}>Keranjang</Title>
          <div className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
            {items.length}
          </div>
        </div>
        <Button
          type="text"
          danger
          icon={<Trash2 className="h-4 w-4" />}
          onClick={clearCart}
          disabled={items.length === 0}
        />
      </div>

      <div className="custom-scrollbar cart-scroll-area flex-1 min-h-0 space-y-4 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center opacity-40">
            <Empty
              image={<Wallet className="mx-auto mb-2 h-16 w-16 text-slate-300" />}
              description={<Text strong className="text-slate-400">Pilih menu untuk memulai</Text>}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-[#303030] dark:bg-[#141414]/50"
              >
                <div className="mb-2 flex w-full justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <Text strong className="block truncate text-sm">
                      {item.name}
                    </Text>
                  </div>
                  <Text strong className="text-sm">{formatCurrency(item.subtotal)}</Text>
                </div>

                <div className="mt-2 flex w-full items-center justify-between">
                  <Space.Compact className="scale-90 origin-left">
                    <Button
                      icon={<Minus className="h-3 w-3" />}
                      onClick={() => handleQuantityChange(item.productId, item.quantity, -1)}
                    />
                    <Input style={{ width: 45, textAlign: 'center' }} value={item.quantity} readOnly />
                    <Button
                      icon={<Plus className="h-3 w-3" />}
                      onClick={() => handleQuantityChange(item.productId, item.quantity, 1)}
                    />
                  </Space.Compact>

                  <Button
                    type="text"
                    danger
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => removeItem(item.productId)}
                    className="hover:bg-red-50 dark:hover:bg-red-900/20"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 z-30 space-y-4 border-t border-slate-200 bg-slate-50 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-12px_20px_-16px_rgba(15,23,42,0.35)] dark:border-[#303030] dark:bg-[#141414] md:static md:z-auto md:shadow-none"
      >
        <div className="space-y-3">
          <Input
            prefix={<User size={14} className="text-slate-400" />}
            placeholder="Nama Pelanggan (Opsional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="rounded-xl bg-white dark:bg-[#1f1f1f]"
          />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <Text type="secondary">Subtotal</Text>
              <Text strong>{formatCurrency(subtotal)}</Text>
            </div>
            <div className="flex items-center justify-between">
              <Text type="secondary">Diskon (Rp)</Text>
              <div className="w-40 sm:w-44">
                <InputNumber
                  min={0}
                  value={discount}
                  onChange={(value) => setDiscount(value || 0)}
                  className="w-full rounded-lg"
                  style={{ width: '100%' }}
                  size="small"
                  formatter={value => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={value => value?.replace(/[^\d]/g, '') as unknown as number}
                />
              </div>
            </div>
            {serviceChargeRate > 0 && (
              <div className="flex justify-between">
                <Text type="secondary">Service Charge ({serviceChargeRate}%)</Text>
                <Text strong>{formatCurrency(serviceCharge)}</Text>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between">
                <Text type="secondary">Pajak ({taxRate}%)</Text>
                <Text strong>{formatCurrency(tax)}</Text>
              </div>
            )}
            <Divider style={{ margin: '8px 0' }} />
            <div className="flex items-center justify-between">
              <Title level={4} style={{ margin: 0 }}>Total</Title>
              <Title level={2} style={{ margin: 0, color: '#10b981' }}>
                {formatCurrency(total)}
              </Title>
            </div>
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          className="h-14 w-full border-none bg-[#10b981] text-lg font-black shadow-lg shadow-emerald-500/30 hover:bg-[#059669] rounded-2xl flex items-center justify-between px-6"
          disabled={items.length === 0}
          onClick={onPayment}
        >
          <CreditCard className="h-6 w-6" />
          <span>BAYAR PESANAN</span>
          <div className="w-6" />
        </Button>
      </div>
    </div>
  );
}
