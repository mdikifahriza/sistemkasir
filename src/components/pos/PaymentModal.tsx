'use client';

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Divider, Input, Modal, Result, Row, Space, Typography } from 'antd';
import {
  AlertCircle,
  Banknote,
  ExternalLink,
  Loader2,
  Printer,
  RefreshCw,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useCurrentShiftState } from '@/lib/hooks/useCurrentShiftState';
import { type Order, type PaymentMethod, type Transaction, type TransactionDetail } from '@/lib/data/types';
import { printReceipt, type ReceiptData } from '@/lib/utils/print';
import { formatCurrency } from '@/lib/utils/format';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useDataStore } from '@/store/dataStore';
import { useSettingsStore } from '@/store/settingsStore';

const { Text, Title } = Typography;
const { TextArea } = Input;

const paymentMethods: Array<{
  id: PaymentMethod;
  name: string;
  icon: ComponentType<{ size?: number; color?: string; className?: string }>;
  color: string;
}> = [
  { id: 'cash', name: 'Tunai', icon: Banknote, color: '#10b981' },
  { id: 'xendit', name: 'Xendit', icon: Smartphone, color: '#3b82f6' },
  { id: 'cashless_other', name: 'Cashless Lain', icon: Wallet, color: '#a855f7' },
];

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderType: 'dine_in' | 'takeaway' | 'platform';
  tableId?: string | null;
  tableName?: string | null;
  orderSource?: string | null;
  isCheckoutBlocked?: boolean;
  onSuccess?: () => void;
}

type PosCheckoutResponse = {
  transaction: Transaction;
  transactionDetails: TransactionDetail[];
  order?: {
    id: string;
    orderNumber: string;
    orderType: 'dine_in' | 'takeaway' | 'platform';
    queueNumber?: string | null;
  } | null;
};

type PaymentCreateResponse = {
  gatewayPaymentId: string;
  paymentUrl: string | null;
  externalId: string;
  status: string;
  xenditSessionId?: string | null;
  xenditPaymentRequestId?: string | null;
  expiryDate: string | null;
};

type PaymentStatusResponse = {
  transaction: Transaction;
  order?: Pick<Order, 'id' | 'orderNumber' | 'orderType' | 'queueNumber' | 'status' | 'paidAt' | 'updatedAt'> | null;
  payment?: {
    gatewayPaymentId: string;
    externalId: string;
    status: string;
    paymentUrl: string | null;
    paymentMethod: string | null;
    paymentChannel: string | null;
    providerProduct: string | null;
    xenditSessionId: string | null;
    xenditPaymentRequestId: string | null;
    paidAt: string | null;
    expiresAt: string | null;
  } | null;
};

export function PaymentModal({
  isOpen,
  onClose,
  orderType,
  tableId,
  tableName,
  orderSource,
  isCheckoutBlocked = false,
  onSuccess,
}: PaymentModalProps) {
  const {
    items,
    total: getTotal,
    discount,
    customerName,
    clear: clearCart,
    setWaitingXenditPayment,
  } = useCartStore();
  const { currentSession } = useCurrentShiftState();
  const { userId } = useAuthStore();
  const { app } = useSettingsStore();
  const currentUser = useCurrentUser();
  const store = useDataStore((state) => state.store);
  const bootstrap = useDataStore((state) => state.bootstrap);

  const [step, setStep] = useState<'payment' | 'processing' | 'xendit_pending' | 'success'>('payment');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [completedDetails, setCompletedDetails] = useState<TransactionDetail[]>([]);
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const isPollingRef = useRef(false);

  const taxRate = Number(store.taxPercentage) || 0;
  const serviceChargeRate = Number(store.serviceChargePercentage) || 0;

  const totalAmount = useMemo(() => getTotal(taxRate, serviceChargeRate), [getTotal, taxRate, serviceChargeRate]);
  const quickAmounts = [50000, 100000, 200000, 500000];

  const changeAmount = useMemo(() => {
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, paid - totalAmount);
  }, [amountPaid, totalAmount]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setStep('payment');
    setPaymentMethod((app.defaultPaymentMethod as PaymentMethod) || 'cash');
    setAmountPaid('');
    setNotes('');
    setError(null);
    setCompletedTransaction(null);
    setCompletedDetails([]);
    setShowPrintPrompt(false);
    setPaymentUrl(null);
    setIsPolling(false);
    setIsCreatingPaymentLink(false);
    isPollingRef.current = false;
  }, [app.defaultPaymentMethod, isOpen]);

  useEffect(() => {
    if (paymentMethod !== 'cash') {
      setAmountPaid(String(totalAmount));
    }
  }, [paymentMethod, totalAmount]);

  const refreshSnapshot = useCallback(async () => {
    try {
      await bootstrap();
    } catch (bootstrapError) {
      console.warn('Failed to refresh POS snapshot after payment update', bootstrapError);
    }
  }, [bootstrap]);

  const openPaymentWindow = useCallback((url: string) => {
    const popup = window.open(url, '_blank', 'noopener,noreferrer');

    if (!popup) {
      setError('Popup pembayaran diblokir browser. Gunakan tombol buka pembayaran untuk mencoba lagi.');
      return false;
    }

    return true;
  }, []);

  const createOrReuseXenditPayment = useCallback(
    async (transaction: Transaction, fallbackCustomerName?: string | null) => {
      setIsCreatingPaymentLink(true);
      setError(null);

      try {
        const response = await fetch('/api/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: transaction.id,
            customerName: fallbackCustomerName || transaction.customerName || undefined,
          }),
        });

        const result = (await response.json()) as { data?: PaymentCreateResponse; error?: string };

        if (!response.ok || !result.data?.paymentUrl) {
          throw new Error(result.error || 'Gagal membuat link pembayaran Xendit.');
        }

        setPaymentUrl(result.data.paymentUrl);
        setWaitingXenditPayment(true, transaction.createdAt ?? transaction.updatedAt ?? new Date().toISOString());
        openPaymentWindow(result.data.paymentUrl);
        return true;
      } catch (paymentError) {
        setPaymentUrl(null);
        setWaitingXenditPayment(false);
        setError(
          paymentError instanceof Error
            ? paymentError.message
            : 'Gagal membuat link pembayaran Xendit.'
        );
        return false;
      } finally {
        setIsCreatingPaymentLink(false);
      }
    },
    [openPaymentWindow, setWaitingXenditPayment]
  );

  const pollPaymentStatus = useCallback(
    async (transactionId: string) => {
      if (isPollingRef.current) {
        return false;
      }

      isPollingRef.current = true;
      setIsPolling(true);

      try {
        const response = await fetch(`/api/payments/status?id=${transactionId}`, {
          cache: 'no-store',
        });
        const result = (await response.json()) as { data?: PaymentStatusResponse; error?: string };

        if (!response.ok || !result.data?.transaction) {
          if (result.error) {
            setError(result.error);
          }
          return false;
        }

        const latestTransaction = result.data.transaction;

        if (result.data.payment?.paymentUrl) {
          setPaymentUrl(result.data.payment.paymentUrl);
        }

        setCompletedTransaction((current) =>
          current ? { ...current, ...latestTransaction } : latestTransaction
        );

        if (latestTransaction.status === 'completed') {
          setWaitingXenditPayment(false);
          await refreshSnapshot();
          setStep('success');
          setShowPrintPrompt(true);
          setError(null);
          return true;
        }

        if (['failed', 'void', 'expired', 'refunded'].includes(latestTransaction.status)) {
          setWaitingXenditPayment(false);
          setPaymentUrl(null);
          setError(
            latestTransaction.status === 'expired'
              ? 'Pembayaran kedaluwarsa. Buat link pembayaran baru untuk mencoba lagi.'
              : latestTransaction.status === 'refunded'
                ? 'Pembayaran direfund. Buat transaksi baru bila diperlukan.'
                : 'Pembayaran gagal atau dibatalkan. Buat link pembayaran baru untuk mencoba lagi.'
          );
          return true;
        }
      } catch (pollError) {
        console.error('Polling error:', pollError);
      } finally {
        setIsPolling(false);
        isPollingRef.current = false;
      }

      return false;
    },
    [refreshSnapshot, setWaitingXenditPayment]
  );

  useEffect(() => {
    if (step !== 'xendit_pending' || !completedTransaction?.id) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollPaymentStatus(completedTransaction.id);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [completedTransaction?.id, pollPaymentStatus, step]);

  const handlePayment = async () => {
    const paid = parseFloat(amountPaid) || 0;

    if (paymentMethod === 'cash' && paid < totalAmount) {
      setError('Jumlah pembayaran kurang');
      return;
    }

    if (!currentSession) {
      setError('Tidak ada shift aktif. Silakan buka shift terlebih dahulu.');
      return;
    }

    if (!userId) {
      setError('User tidak terautentikasi');
      return;
    }

    if (isCheckoutBlocked) {
      setError(orderType === 'dine_in' ? 'Pilih meja terlebih dahulu sebelum checkout' : 'Lengkapi identitas order terlebih dahulu');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStep('processing');

    try {
      const response = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          discountAmount: discount,
          paymentMethod,
          amountPaid: paid,
          shiftSessionId: currentSession.id,
          cashierId: userId,
          customerName: customerName || undefined,
          notes: notes || undefined,
          orderType,
          tableId: orderType === 'dine_in' ? tableId ?? null : null,
          orderSource: orderType === 'platform' ? orderSource ?? null : null,
        }),
      });

      const result = (await response.json()) as { data?: PosCheckoutResponse; error?: string };

      if (!response.ok || !result.data) {
        throw new Error(result.error || 'Transaksi gagal disimpan.');
      }

      const { transaction, transactionDetails } = result.data;

      if (paymentMethod === 'xendit') {
        setCompletedTransaction(transaction);
        setCompletedDetails(transactionDetails);
        setStep('xendit_pending');
        await refreshSnapshot();
        await createOrReuseXenditPayment(
          transaction,
          customerName || transaction.customerName || null
        );
        return;
      }

      setCompletedTransaction(transaction);
      setCompletedDetails(transactionDetails);
      await refreshSnapshot();
      setStep('success');
      setShowPrintPrompt(true);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Terjadi kesalahan saat memproses pembayaran');
      setStep('payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = async (
    transaction: Transaction | null = completedTransaction,
    receiptDetails: TransactionDetail[] = completedDetails
  ) => {
    if (!transaction) {
      return;
    }

    const details = receiptDetails.length
      ? receiptDetails
      : useDataStore.getState().transactionDetails.filter((detail) => detail.transactionId === transaction.id);

    const receiptData: ReceiptData = {
      storeName: store.name || 'Toko',
      storeAddress: store.address || undefined,
      storePhone: store.phone || undefined,
      invoiceNumber: transaction.invoiceNumber,
      date: new Date(transaction.transactionDate),
      cashierName: currentUser?.fullName || 'Kasir',
      customerName: transaction.customerName || undefined,
      items: details.map((detail) => ({
        name: detail.productName,
        quantity: detail.quantity,
        price: detail.unitPrice,
        subtotal: detail.subtotal,
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

    try {
      await printReceipt(receiptData);
    } catch (printError) {
      console.error('Print error:', printError);
    }
  };

  const handleClosePendingPayment = () => {
    if (!completedTransaction) {
      return;
    }

    const createdAt = completedTransaction.createdAt ?? completedTransaction.updatedAt ?? new Date().toISOString();
    const keepWaitingForNotification = Boolean(paymentUrl);

    clearCart();
    if (keepWaitingForNotification) {
      setWaitingXenditPayment(true, createdAt);
    } else {
      setWaitingXenditPayment(false);
    }

    setShowPrintPrompt(false);
    setStep('payment');
    setPaymentUrl(null);
    setCompletedTransaction(null);
    setCompletedDetails([]);
    setError(null);
    onClose();
    onSuccess?.();
  };

  const handleComplete = () => {
    setWaitingXenditPayment(false);
    clearCart();
    setShowPrintPrompt(false);
    onClose();
    onSuccess?.();
  };

  const handleNewTransaction = () => {
    setWaitingXenditPayment(false);
    clearCart();
    setStep('payment');
    setCompletedTransaction(null);
    setCompletedDetails([]);
    setShowPrintPrompt(false);
    setPaymentUrl(null);
    setError(null);
  };

  return (
    <Modal
      open={isOpen}
      title={
        step === 'payment'
          ? 'Pembayaran'
          : step === 'processing'
            ? 'Memproses...'
            : step === 'xendit_pending'
              ? 'Menunggu Pembayaran'
              : 'Transaksi Berhasil'
      }
      onCancel={step === 'processing' || step === 'xendit_pending' ? undefined : onClose}
      footer={null}
      width="min(480px, calc(100vw - 1rem))"
      centered
      closable={step !== 'processing' && step !== 'xendit_pending'}
      mask={{ closable: step !== 'processing' && step !== 'xendit_pending' }}
    >
      {step === 'payment' ? (
        <div className="space-y-6 pt-4">
          <div className="mb-6 text-center">
            <Text type="secondary" className="mb-1 block">
              Total Pembayaran
            </Text>
            <Title level={2} style={{ color: '#10b981', margin: 0 }}>
              {formatCurrency(totalAmount)}
            </Title>
          </div>

          <div className="mb-6">
            <Text strong className="mb-2 block">
              Metode Pembayaran
            </Text>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.id;

                return (
                  <div
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border p-2 transition-all ${
                      isSelected
                        ? 'border-[#10b981] bg-[#10b981]/10'
                        : 'border-slate-200 hover:border-[#10b981] dark:border-[#303030]'
                    }`}
                  >
                    <Icon size={20} color={isSelected ? '#10b981' : method.color} className="mb-1" />
                    <Text style={{ fontSize: 10, color: isSelected ? '#10b981' : undefined }} className="text-center font-medium">
                      {method.name}
                    </Text>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <Text strong className="mb-2 block">
              {paymentMethod === 'cash' ? 'Jumlah Diterima' : 'Jumlah Pembayaran'}
            </Text>
            <Input
              type="number"
              value={amountPaid}
              onChange={(event) => setAmountPaid(event.target.value)}
              placeholder="0"
              size="large"
              className="h-14 text-center text-xl font-semibold"
              readOnly={paymentMethod !== 'cash'}
            />
          </div>

          {paymentMethod === 'cash' ? (
            <div className="mb-6 flex flex-wrap gap-2">
              <Button
                onClick={() => setAmountPaid(String(totalAmount))}
                className={`border-[#10b981] ${
                  amountPaid === String(totalAmount) ? 'bg-[#10b981] text-white' : 'bg-[#10b981]/10 text-[#10b981]'
                }`}
              >
                Uang Pas
              </Button>
              {quickAmounts
                .filter((amount) => amount > totalAmount)
                .slice(0, 4)
                .map((amount) => (
                  <Button
                    key={amount}
                    onClick={() => setAmountPaid(String(amount))}
                    type={Number(amountPaid) === amount ? 'primary' : 'default'}
                    className={Number(amountPaid) === amount ? 'bg-[#10b981]' : ''}
                  >
                    {formatCurrency(amount)}
                  </Button>
                ))}
            </div>
          ) : null}

          {paymentMethod === 'cash' && changeAmount > 0 ? (
            <Card className="mb-6 border-emerald-200 bg-emerald-50 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
              <Text className="mb-1 block text-emerald-600">Kembalian</Text>
              <Title level={3} className="m-0 text-emerald-600">
                {formatCurrency(changeAmount)}
              </Title>
            </Card>
          ) : null}

          <div className="mb-6">
            <Text strong className="mb-2 block">
              Catatan (Opsional)
            </Text>
            <TextArea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                orderType === 'platform'
                  ? 'Catatan order, nama driver, atau catatan dapur...'
                  : 'Tambahkan catatan transaksi...'
              }
            />
          </div>

          {orderType === 'dine_in' && tableName ? (
            <Alert
              type="info"
              showIcon
              title={`Pesanan akan masuk ke dapur sebagai order meja ${tableName}.`}
              className="mb-4"
            />
          ) : null}

          {orderType === 'takeaway' ? (
            <Alert
              type="info"
              showIcon
              title="Pesanan akan otomatis mendapat nomor antrean takeaway dan langsung muncul di KDS."
              className="mb-4"
            />
          ) : null}

          {orderType === 'platform' ? (
            <Alert
              type="info"
              showIcon
              title={`Pesanan platform${orderSource ? ` (${orderSource})` : ''} akan langsung masuk ke KDS dengan badge platform.`}
              className="mb-4"
            />
          ) : null}

          {error ? (
            <Alert
              title={error}
              type="error"
              showIcon
              icon={<AlertCircle className="mt-1" />}
              className="mb-6"
            />
          ) : null}

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <Button size="large" block onClick={onClose}>
                Batal
              </Button>
            </Col>
            <Col xs={24} sm={12}>
              <Button
                type="primary"
                size="large"
                block
                onClick={() => void handlePayment()}
                loading={isProcessing}
                disabled={isCheckoutBlocked || (paymentMethod === 'cash' && (parseFloat(amountPaid) || 0) < totalAmount)}
                className="bg-[#10b981] hover:bg-[#059669]"
              >
                Bayar
              </Button>
            </Col>
          </Row>
        </div>
      ) : null}

      {step === 'processing' ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-4 h-12 w-12 animate-spin text-[#10b981]" />
          <Text type="secondary">Memproses transaksi...</Text>
        </div>
      ) : null}

      {step === 'xendit_pending' ? (
        <div className="space-y-6 py-8">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-500" />
            <Title level={4}>Menunggu Pembayaran Xendit</Title>
            <Text type="secondary">
              Silakan selesaikan pembayaran pada halaman Xendit yang baru dibuka.
            </Text>
          </div>

          <Card className="border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-950/20">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Text type="secondary">Invoice</Text>
                <Text strong>{completedTransaction?.invoiceNumber}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">Total</Text>
                <Text strong className="text-blue-600">
                  {formatCurrency(totalAmount)}
                </Text>
              </div>
            </div>
          </Card>

          {error ? (
            <Alert
              type="warning"
              showIcon
              title={error}
            />
          ) : null}

          <div className="space-y-3">
            <Button
              type="primary"
              block
              size="large"
              icon={<ExternalLink size={18} />}
              onClick={() => {
                if (paymentUrl) {
                  openPaymentWindow(paymentUrl);
                  return;
                }

                if (completedTransaction) {
                  void createOrReuseXenditPayment(
                    completedTransaction,
                    customerName || completedTransaction.customerName || null
                  );
                }
              }}
              loading={isCreatingPaymentLink}
              disabled={!completedTransaction}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {paymentUrl ? 'Buka Pembayaran Xendit' : 'Buat Ulang Link Pembayaran'}
            </Button>

            <Button
              block
              size="large"
              icon={<RefreshCw size={18} className={isPolling ? 'animate-spin' : ''} />}
              onClick={() => completedTransaction?.id && void pollPaymentStatus(completedTransaction.id)}
              loading={isPolling}
              disabled={!completedTransaction}
            >
              Cek Status Pembayaran
            </Button>

            <Divider>Atau</Divider>

            <Button
              block
              danger
              size="large"
              onClick={handleClosePendingPayment}
            >
              Tutup & Simpan Pending
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'success' && completedTransaction ? (
        <div className="space-y-6 pt-4">
          {showPrintPrompt ? (
            <Alert
              title="Cetak struk sekarang?"
              description="Anda bisa mencetak struk untuk pelanggan."
              type="info"
              showIcon
              action={
                <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                  <Button
                    size="small"
                    type="primary"
                    onClick={async () => {
                      await handlePrint();
                      setShowPrintPrompt(false);
                    }}
                    block
                  >
                    Cetak
                  </Button>
                  <Button size="small" onClick={() => setShowPrintPrompt(false)} block>
                    Tidak
                  </Button>
                </Space>
              }
              className="mb-6"
            />
          ) : null}

          <Result status="success" title="Transaksi Berhasil!" subTitle={completedTransaction.invoiceNumber} className="py-0" />

          <Card className="border-slate-200 bg-slate-50 dark:border-[#303030] dark:bg-[#141414]">
            <div className="mb-2 flex justify-between">
              <Text type="secondary">Total</Text>
              <Text strong>{formatCurrency(completedTransaction.totalAmount)}</Text>
            </div>
            <div className="mb-2 flex justify-between">
              <Text type="secondary">Dibayar</Text>
              <Text>{formatCurrency(completedTransaction.amountPaid)}</Text>
            </div>
            {completedTransaction.changeAmount > 0 ? (
              <>
                <Divider style={{ margin: '8px 0' }} />
                <div className="flex justify-between">
                  <Text type="secondary">Kembalian</Text>
                  <Text className="font-bold text-[#10b981]">
                    {formatCurrency(completedTransaction.changeAmount)}
                  </Text>
                </div>
              </>
            ) : null}
          </Card>

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <Button block icon={<Printer size={16} />} onClick={() => void handlePrint()} size="large">
                Cetak
              </Button>
            </Col>
            <Col xs={24} sm={12}>
              <Button block onClick={handleNewTransaction} size="large">
                Transaksi Baru
              </Button>
            </Col>
            <Col span={24}>
              <Button type="primary" block onClick={handleComplete} size="large" className="bg-[#10b981] hover:bg-[#059669]">
                Selesai
              </Button>
            </Col>
          </Row>
        </div>
      ) : null}
    </Modal>
  );
}
