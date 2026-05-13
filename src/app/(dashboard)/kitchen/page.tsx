'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/widgets/PageHeader';
import { Card, Tag, Button, Spin, Empty, Typography, message, App } from 'antd';
import { CheckOutlined, ClockCircleOutlined, FireOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useDataStore } from '@/store/dataStore';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;

type KitchenOrderItem = {
  id: string;
  productName: string;
  quantity: number | string;
  notes: string | null;
};

type KitchenOrder = {
  id: string;
  orderNumber: string;
  orderType: 'dine_in' | 'takeaway' | 'platform';
  queueNumber: string | null;
  status: 'paid' | 'processing' | 'ready' | 'completed' | string;
  createdAt: string;
  table: {
    name: string;
  } | null;
  items: KitchenOrderItem[];
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  paid: { color: 'blue', label: 'MENUNGGU' },
  processing: { color: 'orange', label: 'DIMASAK' },
  ready: { color: 'green', label: 'SIAP' },
};

function formatElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  return `${hours}j ${minutes % 60}m`;
}

export default function KitchenPage() {
  const store = useDataStore((state) => state.store);
  const userId = useAuthStore((state) => state.userId);
  const { message: messageApi } = App.useApp();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!store?.id) return;
    try {
      const res = await fetch(`/api/kitchen`);
      const payload = (await res.json()) as { data?: KitchenOrder[] };
      if (payload.data) setOrders(payload.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, [store?.id]);

  const updateStatus = async (orderId: string, targetStatus: string) => {
    setUpdating(orderId);
    try {
      const res = await fetch('/api/kitchen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: targetStatus, userId: userId ?? undefined }),
      });
      const payload = await res.json();
      if (!res.ok) {
        messageApi.error(payload.error || 'Gagal memperbarui status');
        return;
      }
      messageApi.success(`Status pesanan diperbarui`);
      await fetchOrders();
    } catch (error) {
      messageApi.error('Gagal memperbarui status');
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  if (loading) return <div className="p-8 text-center"><Spin size="large" /></div>;

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-[#141414] min-h-screen">
      <PageHeader 
        title="Kitchen Display System" 
        subtitle="Kelola antrean masakan dapur secara real-time" 
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orders.length === 0 ? (
          <div className="col-span-full">
            <Empty description="Tidak ada antrean masakan" />
          </div>
        ) : (
          orders.map((order) => {
            const config = STATUS_CONFIG[order.status] ?? { color: 'default', label: order.status.toUpperCase() };
            const isTakeaway = order.orderType === 'takeaway' || order.orderType === 'platform';

            return (
              <Card 
                key={order.id}
                className={`shadow-md border-t-4 rounded-2xl overflow-hidden ${isTakeaway ? 'border-t-amber-500' : 'border-t-emerald-500'}`}
                title={
                  <div className="flex justify-between items-center">
                    <Text strong className="text-lg">#{order.orderNumber.slice(-4)}</Text>
                    <div className="flex items-center gap-2">
                      <ClockCircleOutlined className="text-slate-400" />
                      <Text type="secondary" className="text-xs font-bold">
                        {formatElapsed(order.createdAt)}
                      </Text>
                    </div>
                  </div>
                }
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <Text type="secondary" className="text-[10px] uppercase font-bold tracking-wider">Lokasi / Meja</Text>
                    <Title level={4} style={{ margin: 0 }} className={isTakeaway ? 'text-amber-600' : 'text-emerald-600'}>
                      {order.table?.name || 'AREA BUNGKUS'}
                    </Title>
                  </div>
                  {isTakeaway && (
                    <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 p-2 rounded-xl text-center min-w-[60px]">
                      <div className="text-[9px] font-black uppercase leading-none">Antrean</div>
                      <div className="text-xl font-black leading-none mt-1">{order.queueNumber || 'T-?'}</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mb-4">
                   <Tag color={order.orderType === 'dine_in' ? 'emerald' : 'orange'} className="m-0 font-bold uppercase text-[9px] px-2 rounded-full border-none">
                     {order.orderType === 'dine_in' ? 'MAKAN DI TEMPAT' : order.orderType === 'platform' ? 'PLATFORM ONLINE' : 'TAKEAWAY'}
                   </Tag>
                   <Tag color={config.color} className="m-0 font-bold uppercase text-[9px] px-2 rounded-full border-none">
                     {config.label}
                   </Tag>
                </div>

                <div className="space-y-3 mb-6 border-y py-4 dark:border-[#303030]">
                  {order.items.map((item) => (
                    <div key={item.id}>
                      <div className="flex justify-between items-start">
                        <Text className="flex-1 pr-2 text-sm font-bold">
                          <span className={isTakeaway ? 'text-amber-600' : 'text-emerald-600'}>{Number(item.quantity)}x</span> {item.productName}
                        </Text>
                      </div>
                      {item.notes && (
                        <div className="mt-1 bg-slate-50 dark:bg-[#1f1f1f] p-2 rounded-lg border border-slate-100 dark:border-[#303030]">
                          <Text type="secondary" italic className="text-[11px] block text-red-500 font-bold">Note: {item.notes}</Text>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  {order.status === 'paid' && (
                    <Button 
                      block 
                      type="primary" 
                      icon={<FireOutlined />} 
                      onClick={() => updateStatus(order.id, 'processing')}
                      loading={updating === order.id}
                      className="bg-orange-500 hover:bg-orange-600 border-none h-12 rounded-xl font-black"
                    >
                      MASAK
                    </Button>
                  )}
                  {order.status === 'processing' && (
                    <Button 
                      block 
                      type="primary" 
                      icon={<CheckOutlined />} 
                      onClick={() => updateStatus(order.id, 'ready')}
                      loading={updating === order.id}
                      className="bg-emerald-500 hover:bg-emerald-600 border-none h-12 rounded-xl font-black"
                    >
                      SIAP!
                    </Button>
                  )}
                  {order.status === 'ready' && (
                    <Button 
                      block 
                      icon={<ShoppingCartOutlined />} 
                      onClick={() => updateStatus(order.id, 'completed')}
                      loading={updating === order.id}
                      className="h-12 rounded-xl font-black border-2 border-slate-200 dark:border-[#303030]"
                    >
                      DIAMBIL
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
