'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Card, Input, InputNumber, Modal, Tag, App } from 'antd';
import { useDataStore } from '@/store/dataStore';
import { PageHeader } from '@/components/widgets/PageHeader';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { printReceipt, type ReceiptData } from '@/lib/utils/print';

export default function TransactionsPage() {
  const store = useDataStore((state) => state.store);
  const transactions = useDataStore((state) => state.transactions);
  const details = useDataStore((state) => state.transactionDetails);
  const users = useDataStore((state) => state.users);
  const orders = useDataStore((state) => state.orders);
  const tables = useDataStore((state) => state.tables);
  const editTransaction = useDataStore((state) => state.editTransaction);
  const refundTransaction = useDataStore((state) => state.refundTransaction);
  const user = useCurrentUser();
  const { message: messageApi } = App.useApp();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<Array<{ productId: string; name: string; price: number; quantity: number }>>([]);
  const [editDiscount, setEditDiscount] = useState<number | null>(0);
  const [editReason, setEditReason] = useState('');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  const orderByTransactionId = useMemo(
    () =>
      new Map(
        orders
          .filter((order) => order.transactionId)
          .map((order) => [order.transactionId as string, order])
      ),
    [orders]
  );

  const tableById = useMemo(
    () => new Map(tables.map((table) => [table.id, table])),
    [tables]
  );

  const selected = transactions.find((transaction) => transaction.id === selectedId) || null;
  const selectedOrder = selected ? orderByTransactionId.get(selected.id) ?? null : null;
  const selectedTable = selectedOrder?.tableId ? tableById.get(selectedOrder.tableId) ?? null : null;
  const selectedDetails = details.filter((item) => item.transactionId === selectedId);
  const receiptTransaction = transactions.find((transaction) => transaction.id === receiptId) || null;
  const receiptOrder = receiptTransaction ? orderByTransactionId.get(receiptTransaction.id) ?? null : null;
  const receiptTable = receiptOrder?.tableId ? tableById.get(receiptOrder.tableId) ?? null : null;
  const receiptDetails = details.filter((item) => item.transactionId === receiptId);

  const formatStatus = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Selesai';
      case 'refunded':
        return 'Refund';
      case 'cancelled':
        return 'Dibatalkan';
      case 'pending_payment':
        return 'Menunggu Bayar';
      case 'paid':
        return 'Sudah Bayar';
      case 'processing':
        return 'Dimasak';
      case 'ready':
        return 'Siap Antar';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'paid':
        return 'processing';
      case 'processing':
        return 'warning';
      case 'ready':
        return 'cyan';
      case 'pending_payment':
        return 'default';
      case 'cancelled':
        return 'error';
      case 'refunded':
        return 'volcano';
      default:
        return 'default';
    }
  };

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort(
        (left, right) => new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime()
      ),
    [transactions]
  );

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Tunai';
      case 'card':
      case 'xendit':
        return 'QRIS';
      case 'cashless_other':
        return 'Cashless Lain';
      default:
        return method;
    }
  };

  const subtotal = useMemo(
    () => editItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [editItems]
  );

  const openDetail = (id: string) => {
    setSelectedId(id);
    const transaction = transactions.find((item) => item.id === id);
    if (transaction) {
      setEditDiscount(transaction.discountAmount);
      setEditItems(
        details
          .filter((item) => item.transactionId === id)
          .map((item) => ({
            productId: item.productId || '',
            name: item.productName,
            price: item.unitPrice,
            quantity: item.quantity,
          }))
      );
    }
    setEditReason('');
    setEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedId || !selected) return;
    if (!editReason) {
      messageApi.error('Alasan edit wajib diisi.');
      return;
    }
    try {
      await editTransaction(selectedId, {
        items: editItems,
        discountAmount: editDiscount || 0,
        paymentMethod: selected.paymentMethod,
        amountPaid: selected.amountPaid || subtotal,
        notes: selected.notes || '',
        reason: editReason,
      });
      setEditMode(false);
      messageApi.success('Transaksi berhasil diubah');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal mengubah transaksi');
    }
  };

  const handleRefund = async () => {
    if (!selectedId) return;
    if (!refundReason) {
      messageApi.error('Alasan pengembalian wajib diisi.');
      return;
    }
    try {
      await refundTransaction(selectedId, refundReason);
      setIsRefundModalOpen(false);
      setSelectedId(null);
      setRefundReason('');
      messageApi.success('Transaksi berhasil direfund');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal melakukan refund');
    }
  };

  const buildReceiptData = (transaction: (typeof transactions)[number]): ReceiptData => {
    const cashier = users.find((item) => item.id === transaction.createdBy);
    const transactionDetails = details.filter((item) => item.transactionId === transaction.id);

    return {
      storeName: store.name || 'Toko',
      storeAddress: store.address || undefined,
      storePhone: store.phone || undefined,
      invoiceNumber: transaction.invoiceNumber,
      date: new Date(transaction.transactionDate),
      cashierName: cashier?.fullName || 'Kasir',
      customerName: transaction.customerName || undefined,
      items: transactionDetails.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        price: item.unitPrice,
        subtotal: item.subtotal,
      })),
      subtotal: transaction.subtotal,
      discountAmount: transaction.discountAmount,
      serviceCharge: transaction.serviceCharge,
      taxAmount: transaction.taxAmount,
      totalAmount: transaction.totalAmount,
      amountPaid: transaction.amountPaid,
      changeAmount: transaction.changeAmount,
      paymentMethod: transaction.paymentMethod,
      notes: transaction.notes || undefined,
    };
  };

  const handlePrintReceipt = async (transaction: (typeof transactions)[number]) => {
    try {
      await printReceipt(buildReceiptData(transaction));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Gagal mencetak nota');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader title="Transaksi" subtitle="Monitor transaksi manual dan order QR yang sudah tersinkron dengan operasional restoran" />

      <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sortedTransactions.map((transaction) => {
          const linkedOrder = orderByTransactionId.get(transaction.id) ?? null;
          const linkedTable = linkedOrder?.tableId ? tableById.get(linkedOrder.tableId) ?? null : null;
          const displayStatus = linkedOrder?.status ?? transaction.status;

          return (
            <div
              key={transaction.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-[#303030] dark:bg-[#141414]"
            >
              <div className="absolute right-0 top-0 p-3 opacity-[0.03] transition-opacity group-hover:opacity-[0.08]">
                <div className="text-4xl font-black">#</div>
              </div>

              <div className="relative z-10 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="m-0 text-sm font-black tracking-tight transition-colors group-hover:text-[#10b981]">
                      {transaction.invoiceNumber}
                    </h3>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {formatDateTime(transaction.transactionDate)}
                    </p>
                  </div>
                  <Tag color={getStatusColor(displayStatus)} className="m-0 border-none font-bold uppercase tracking-wide">
                    {formatStatus(displayStatus)}
                  </Tag>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Tag color={linkedOrder ? 'processing' : 'default'} className="m-0 border-none">
                    {linkedOrder ? 'QR / Self Order' : 'POS Manual'}
                  </Tag>
                  {linkedTable ? (
                    <Tag color="warning" className="m-0 border-none">
                      {linkedTable.name}
                    </Tag>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-[#303030]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-[#1f1f1f]">
                    {transaction.customerName?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-bold">{transaction.customerName || 'Pelanggan Umum'}</p>
                    <p className="m-0 text-[10px] font-medium uppercase tracking-tighter text-slate-500">
                      {linkedOrder ? linkedOrder.orderNumber : 'Transaksi Kasir'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-6 flex items-end justify-between">
                <div>
                  <p className="m-0 mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 opacity-70">
                    Total Bayar
                  </p>
                  <p className="m-0 text-lg font-black">{formatCurrency(transaction.totalAmount, store.currency)}</p>
                </div>
                <Button
                  size="small"
                  type="dashed"
                  onClick={() => openDetail(transaction.id)}
                  className="h-9 rounded-xl px-4 text-xs font-bold hover:border-[#10b981] hover:text-[#10b981]"
                >
                  Buka Detail
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!selected}
        title={`Detail ${selected?.invoiceNumber || ''}`}
        onCancel={() => {
          setSelectedId(null);
          setEditMode(false);
        }}
        width="min(760px, calc(100vw - 1rem))"
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  setReceiptId(selected.id);
                  setSelectedId(null);
                }}
              >
                Lihat Nota
              </Button>
              {!selectedOrder && user?.role === 'owner' ? (
                <Button className="w-full sm:w-auto" onClick={() => setEditMode((prev) => !prev)}>
                  {editMode ? 'Batalkan Ubah' : 'Ubah'}
                </Button>
              ) : null}
              {!selectedOrder && (user?.role === 'owner' || user?.role === 'manager') ? (
                <Button className="w-full sm:w-auto" danger onClick={() => setIsRefundModalOpen(true)}>
                  Refund
                </Button>
              ) : null}
              {editMode ? (
                <Button className="w-full bg-[#10b981] sm:w-auto" type="primary" onClick={handleSaveEdit}>
                  Simpan
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4 pt-4">
            {selectedOrder ? (
              <Alert
                type="info"
                showIcon
                title="Transaksi ini berasal dari order restoran"
                description={`Status operasionalnya mengikuti order ${selectedOrder.orderNumber}${selectedTable ? ` di ${selectedTable.name}` : ''}. Edit dan refund manual dinonaktifkan agar status kasir, pembayaran, dan dapur tidak bercabang.`}
              />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-4">
              <Card className="border-slate-200 shadow-sm dark:border-[#303030]" styles={{ body: { padding: 12 } }}>
                <p className="m-0 mb-1 text-xs uppercase text-slate-500">Pelanggan</p>
                <p className="m-0 text-sm font-semibold">{selected.customerName || 'Umum'}</p>
              </Card>
              <Card className="border-slate-200 shadow-sm dark:border-[#303030]" styles={{ body: { padding: 12 } }}>
                <p className="m-0 mb-1 text-xs uppercase text-slate-500">Sumber</p>
                <p className="m-0 text-sm font-semibold">{selectedOrder ? 'QR / Self Order' : 'POS Manual'}</p>
              </Card>
              <Card className="border-slate-200 shadow-sm dark:border-[#303030]" styles={{ body: { padding: 12 } }}>
                <p className="m-0 mb-1 text-xs uppercase text-slate-500">Meja</p>
                <p className="m-0 text-sm font-semibold">{selectedTable?.name || '-'}</p>
              </Card>
              <Card className="border-slate-200 shadow-sm dark:border-[#303030]" styles={{ body: { padding: 12 } }}>
                <p className="m-0 mb-1 text-xs uppercase text-slate-500">Metode</p>
                <p className="m-0 text-sm font-semibold">{formatPaymentMethod(selected.paymentMethod)}</p>
              </Card>
            </div>

            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-[#303030]">
                <table className="min-w-[36rem] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-[#1f1f1f]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Produk</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Harga</th>
                      <th className="px-3 py-2 font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#303030]">
                    {editMode
                      ? editItems.map((item, index) => (
                          <tr key={`${item.productId}-${index}`}>
                            <td className="px-3 py-2">{item.name}</td>
                            <td className="px-3 py-2">
                              <InputNumber
                                className="w-full min-w-[5rem] sm:w-20"
                                style={{ width: '100%' }}
                                min={1}
                                value={editItems[index].quantity}
                                onChange={(value) => {
                                  const next = [...editItems];
                                  next[index] = {
                                    ...next[index],
                                    quantity: Number(value),
                                  };
                                  setEditItems(next);
                                }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <InputNumber
                                className="w-full min-w-[7rem] sm:w-32"
                                style={{ width: '100%' }}
                                value={editItems[index].price}
                                min={0}
                                formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                parser={(value) => Number(value?.replace(/[^\d]/g, '') || 0)}
                                onChange={(value) => {
                                  const next = [...editItems];
                                  next[index] = {
                                    ...next[index],
                                    price: Number(value),
                                  };
                                  setEditItems(next);
                                }}
                              />
                            </td>
                            <td className="px-3 py-2">{formatCurrency(item.price * item.quantity, store.currency)}</td>
                          </tr>
                        ))
                      : selectedDetails.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">{item.productName}</td>
                            <td className="px-3 py-2">{item.quantity}</td>
                            <td className="px-3 py-2">{formatCurrency(item.unitPrice, store.currency)}</td>
                            <td className="px-3 py-2 font-medium">{formatCurrency(item.unitPrice * item.quantity, store.currency)}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>

            {editMode ? (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Diskon</label>
                  <InputNumber
                    className="w-full"
                    style={{ width: '100%' }}
                    min={0}
                    value={editDiscount}
                    formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(value) => Number(value?.replace(/[^\d]/g, '') || 0)}
                    onChange={(value) => setEditDiscount(value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Alasan Perubahan</label>
                  <Input value={editReason} onChange={(event) => setEditReason(event.target.value)} />
                </div>
                <div className="pt-2 text-sm font-medium">Subtotal: {formatCurrency(subtotal, store.currency)}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Refund Transaksi"
        open={isRefundModalOpen}
        onCancel={() => {
          setIsRefundModalOpen(false);
          setRefundReason('');
        }}
        onOk={handleRefund}
        okText="Konfirmasi"
        cancelText="Batal"
        okButtonProps={{ danger: true }}
        width="min(480px, calc(100vw - 1rem))"
      >
        <div className="pt-4">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Alasan Refund</label>
          <Input.TextArea
            rows={3}
            value={refundReason}
            onChange={(event) => setRefundReason(event.target.value)}
            placeholder="Masukkan alasan refund"
          />
        </div>
      </Modal>

      <Modal
        open={!!receiptTransaction}
        title={`Nota ${receiptTransaction?.invoiceNumber || ''}`}
        onCancel={() => setReceiptId(null)}
        footer={
          receiptTransaction ? (
            <Button type="primary" className="bg-[#10b981]" onClick={() => handlePrintReceipt(receiptTransaction)}>
              Cetak Nota
            </Button>
          ) : null
        }
        width="min(400px, calc(100vw - 1rem))"
      >
        {receiptTransaction ? (
          <div className="space-y-4 pt-4 font-mono text-sm">
            <div className="space-y-1 text-center">
              <p className="m-0 text-lg font-bold">{store.name || 'Toko'}</p>
              {store.address ? <p className="m-0 text-xs text-slate-500">{store.address}</p> : null}
              {store.phone ? <p className="m-0 text-xs text-slate-500">Telp: {store.phone}</p> : null}
            </div>

            <div className="space-y-1 pt-4 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>No</span>
                <span className="text-slate-900 dark:text-slate-100">{receiptTransaction.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Tgl</span>
                <span className="text-slate-900 dark:text-slate-100">{formatDateTime(receiptTransaction.transactionDate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {users.find((item) => item.id === receiptTransaction.createdBy)?.fullName || 'Kasir'}
                </span>
              </div>
              {receiptOrder ? (
                <div className="flex justify-between">
                  <span>Order</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {receiptOrder.orderNumber}
                    {receiptTable ? ` - ${receiptTable.name}` : ''}
                  </span>
                </div>
              ) : null}
              {receiptTransaction.customerName ? (
                <div className="flex justify-between">
                  <span>Pelanggan</span>
                  <span className="text-slate-900 dark:text-slate-100">{receiptTransaction.customerName}</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 border-t border-dashed border-slate-300 pt-3 dark:border-slate-700">
              {receiptDetails.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{item.productName}</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.subtotal, store.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>
                      {item.quantity} x {formatCurrency(item.unitPrice, store.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1 border-t border-dashed border-slate-300 pt-3 text-xs text-slate-500 dark:border-slate-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-slate-900 dark:text-slate-100">{formatCurrency(receiptTransaction.subtotal, store.currency)}</span>
              </div>
              {receiptTransaction.discountAmount > 0 ? (
                <div className="flex justify-between">
                  <span>Diskon</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    -{formatCurrency(receiptTransaction.discountAmount, store.currency)}
                  </span>
                </div>
              ) : null}
              {receiptTransaction.taxAmount > 0 ? (
                <div className="flex justify-between">
                  <span>Pajak</span>
                  <span className="text-slate-900 dark:text-slate-100">{formatCurrency(receiptTransaction.taxAmount, store.currency)}</span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-bold text-slate-900 dark:border-[#303030] dark:text-slate-100">
                <span>Total</span>
                <span>{formatCurrency(receiptTransaction.totalAmount, store.currency)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span>Bayar ({formatPaymentMethod(receiptTransaction.paymentMethod)})</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {formatCurrency(receiptTransaction.amountPaid, store.currency)}
                </span>
              </div>
              {receiptTransaction.paymentMethod === 'cash' && receiptTransaction.changeAmount > 0 ? (
                <div className="flex justify-between">
                  <span>Kembali</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {formatCurrency(receiptTransaction.changeAmount, store.currency)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="pt-6 text-center text-xs text-slate-500">Terima kasih atas kunjungan Anda</div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
