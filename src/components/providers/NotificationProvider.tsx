'use client';

import { useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { useDataStore } from '@/store/dataStore';
import { useAuthStore } from '@/store/authStore';
import { useConnectivity } from './ConnectivityProvider';

const ACTIVE_ORDER_STATUSES = new Set(['pending_payment', 'paid', 'processing', 'ready']);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { notification } = App.useApp();
  const { isOnline } = useConnectivity();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const orders = useDataStore((state) => state.orders);
  const tables = useDataStore((state) => state.tables);
  const bootstrap = useDataStore((state) => state.bootstrap);
  
  const lastOrderIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Poll for data updates
  useEffect(() => {
    if (!isOnline || !isAuthenticated) return;

    const interval = setInterval(() => {
      void bootstrap();
    }, 10000); // 10 seconds polling

    return () => clearInterval(interval);
  }, [isOnline, isAuthenticated, bootstrap]);

  // Detect new orders
  useEffect(() => {
    if (isInitialLoad.current) {
      // First load, just record existing IDs
      const currentIds = new Set(orders.map(o => `${o.id}-${o.status}`));
      lastOrderIds.current = currentIds;
      isInitialLoad.current = false;
      return;
    }

    const currentActiveOrders = orders.filter(o => 
      o.orderSource === 'self_order_qr' && ACTIVE_ORDER_STATUSES.has(o.status)
    );

    for (const order of currentActiveOrders) {
      const uniqueKey = `${order.id}-${order.status}`;
      
      // If we haven't seen this order in this status before
      if (!lastOrderIds.current.has(uniqueKey)) {
        // Find table name
        const table = tables.find(t => t.id === order.tableId);
        const tableName = table?.name || 'Area Umum';
        
        const statusLabel = order.status === 'pending_payment' ? 'menunggu pembayaran' : 'telah memesan';
        
        notification.info({
          message: `Pesanan Baru: ${tableName}`,
          description: `Pesanan #${order.orderNumber.slice(-4)} ${statusLabel}.`,
          placement: 'bottomRight',
          duration: 5,
        });
      }
    }

    // Update last seen IDs
    const nextIds = new Set(orders.map(o => `${o.id}-${o.status}`));
    lastOrderIds.current = nextIds;
  }, [orders, tables, notification]);

  return <>{children}</>;
}
