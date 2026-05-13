type GatewayEnvelope<T> = {
  data?: T;
  error?: string;
};

export type PaymentGatewayCreatePayload = {
  storeId: string;
  transactionId: string;
  orderId?: string | null;
  invoiceNumber: string;
  orderNumber?: string | null;
  amount: number;
  currency: string;
  description: string;
  customer?: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  redirectUrls: {
    success: string;
    failure: string;
  };
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentGatewayCreateResponse = {
  gatewayPaymentId: string;
  xenditInvoiceId: string | null;
  xenditSessionId: string | null;
  xenditPaymentRequestId: string | null;
  externalId: string;
  paymentUrl: string | null;
  status: string;
  expiresAt: string | null;
  isReused: boolean;
};

export type PaymentGatewayStatusResponse = {
  gatewayPaymentId: string;
  storeId: string;
  transactionId: string;
  orderId: string | null;
  invoiceNumber: string | null;
  orderNumber: string | null;
  xenditInvoiceId: string | null;
  xenditSessionId: string | null;
  xenditPaymentRequestId: string | null;
  externalId: string;
  status: string;
  amount: number;
  paymentUrl: string | null;
  paymentMethod: string | null;
  paymentChannel: string | null;
  providerProduct: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
};

export type PaymentGatewayStoreBalanceResponse = {
  storeId: string;
  storeCode: string | null;
  storeName: string | null;
  xenditAccountId: string;
  accountType: string;
  currency: string | null;
  atTimestamp: string | null;
  balance: number;
};

function getPaymentGatewayBaseUrl(): string {
  const value = process.env.PAYMENT_GATEWAY_BASE_URL?.trim();

  if (!value) {
    throw new Error('PAYMENT_GATEWAY_BASE_URL is not configured');
  }

  return value.replace(/\/+$/, '');
}

function getPaymentGatewayApiKey(): string {
  const value =
    process.env.PAYMENT_GATEWAY_API_KEY?.trim() ??
    process.env.GATEWAY_INTERNAL_API_KEY?.trim();

  if (!value) {
    throw new Error('PAYMENT_GATEWAY_API_KEY is not configured');
  }

  return value;
}

function buildGatewayUrl(
  path: string,
  query?: Record<string, string | null | undefined>
): string {
  const url = new URL(path, `${getPaymentGatewayBaseUrl()}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && value.trim()) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

async function requestGateway<T>(params: {
  path: string;
  method: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | null | undefined>;
}): Promise<T> {
  const response = await fetch(buildGatewayUrl(params.path, params.query), {
    method: params.method,
    headers: {
      'Content-Type': 'application/json',
      'x-gateway-key': getPaymentGatewayApiKey(),
    },
    cache: 'no-store',
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  });

  let payload: GatewayEnvelope<T> | null = null;

  try {
    payload = (await response.json()) as GatewayEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.data) {
    const message =
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error
        : `Payment gateway request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload.data;
}

export async function createGatewayPayment(
  payload: PaymentGatewayCreatePayload
): Promise<PaymentGatewayCreateResponse> {
  return requestGateway<PaymentGatewayCreateResponse>({
    path: '/api/v1/payments/create',
    method: 'POST',
    body: payload,
  });
}

export async function fetchGatewayPaymentStatus(params: {
  transactionId?: string | null;
  externalId?: string | null;
  xenditInvoiceId?: string | null;
}): Promise<PaymentGatewayStatusResponse> {
  return requestGateway<PaymentGatewayStatusResponse>({
    path: '/api/v1/payments/status',
    method: 'GET',
    query: {
      transactionId: params.transactionId ?? undefined,
      externalId: params.externalId ?? undefined,
      xenditInvoiceId: params.xenditInvoiceId ?? undefined,
    },
  });
}

export async function fetchGatewayStoreBalance(params: {
  storeId: string;
  accountType?: 'CASH' | 'HOLDING' | 'TAX';
  currency?: string | null;
  atTimestamp?: string | null;
}): Promise<PaymentGatewayStoreBalanceResponse> {
  return requestGateway<PaymentGatewayStoreBalanceResponse>({
    path: `/api/v1/stores/${params.storeId}/balance`,
    method: 'GET',
    query: {
      accountType: params.accountType ?? 'CASH',
      currency: params.currency ?? undefined,
      atTimestamp: params.atTimestamp ?? undefined,
    },
  });
}

export type PayoutGatewayCreatePayload = {
  storeId: string;
  shiftSessionId?: string | null;
  requestedBy?: string | null;
  referenceId: string;
  channelCode: string;
  accountNumber: string;
  accountHolderName: string;
  amount: number;
  currency?: string;
  description?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type PayoutGatewayCreateResponse = {
  id: string;
  referenceId: string;
  xenditPayoutId: string | null;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
};

export type PayoutGatewayStatusResponse = {
  id: string;
  referenceId: string;
  xenditPayoutId: string | null;
  status: string;
  amount: number;
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  completedAt: string | null;
};

export async function createGatewayPayout(
  payload: PayoutGatewayCreatePayload
): Promise<PayoutGatewayCreateResponse> {
  return requestGateway<PayoutGatewayCreateResponse>({
    path: '/api/v1/payouts/create',
    method: 'POST',
    body: payload,
  });
}

export async function fetchGatewayPayoutStatus(params: {
  id?: string | null;
  referenceId?: string | null;
  xenditPayoutId?: string | null;
}): Promise<PayoutGatewayStatusResponse> {
  return requestGateway<PayoutGatewayStatusResponse>({
    path: '/api/v1/payouts/status',
    method: 'GET',
    query: {
      id: params.id ?? undefined,
      referenceId: params.referenceId ?? undefined,
      xenditPayoutId: params.xenditPayoutId ?? undefined,
    },
  });
}
