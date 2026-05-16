import crypto from 'crypto';

// ──────────────────────────────────────────────
// Flutterwave API Configuration
// ──────────────────────────────────────────────
export const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

function getSecretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) {
    throw new Error('FLUTTERWAVE_SECRET_KEY is not configured');
  }
  return key;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// ──────────────────────────────────────────────
// Boost Pricing Constants
// ──────────────────────────────────────────────
export const BOOST_PRICING = {
  3: 500,    // 3-day boost: ₦500
  7: 1000,   // 7-day boost: ₦1,000
  14: 1800,  // 14-day boost: ₦1,800
  30: 3000,  // 30-day boost: ₦3,000
} as const;

export type BoostDuration = keyof typeof BOOST_PRICING;

// ──────────────────────────────────────────────
// Vendor Subscription Pricing Constants
// ──────────────────────────────────────────────
export const VENDOR_SUBSCRIPTION_PRICING = {
  monthly: 2000,    // Monthly: ₦2,000
  quarterly: 5000,  // Quarterly: ₦5,000
  annually: 15000,  // Annually: ₦15,000
} as const;

export type VendorSubscriptionPlan = keyof typeof VENDOR_SUBSCRIPTION_PRICING;

// ──────────────────────────────────────────────
// Payment Types
// ──────────────────────────────────────────────
export type PaymentType = 'boost' | 'vendor_subscription' | 'sponsored_ad';

export const VALID_PAYMENT_TYPES: PaymentType[] = [
  'boost',
  'vendor_subscription',
  'sponsored_ad',
];

// ──────────────────────────────────────────────
// Transaction Reference Generator
// ──────────────────────────────────────────────
export function generateTxRef(type: string): string {
  const randomString = crypto.randomBytes(8).toString('hex');
  return `ULM_${type}_${Date.now()}_${randomString}`;
}

// ──────────────────────────────────────────────
// Initialize Payment
// ──────────────────────────────────────────────
export interface InitializePaymentParams {
  tx_ref: string;
  amount: number;
  currency: string;
  customer: {
    email: string;
    name: string;
  };
  meta: {
    userId: string;
    listingId?: string;
    type: string;
  };
}

export interface InitializePaymentResult {
  link: string;
  tx_ref: string;
}

export async function initializePayment(
  params: InitializePaymentParams
): Promise<InitializePaymentResult> {
  const secretKey = getSecretKey();
  const appUrl = getAppUrl();

  const requestBody = {
    tx_ref: params.tx_ref,
    amount: params.amount,
    currency: params.currency,
    redirect_url: `${appUrl}/api/payments/verify`,
    customer: {
      email: params.customer.email,
      name: params.customer.name,
    },
    customizations: {
      title: 'UNILAG Marketplace',
      logo: 'https://unilag.edu.ng/wp-content/uploads/2019/06/unilag-logo.png',
    },
    meta: params.meta,
  };

  const response = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (data.status !== 'success' || !data.data?.link) {
    throw new Error(
      `Flutterwave payment initialization failed: ${data.message || 'Unknown error'}`
    );
  }

  return {
    link: data.data.link,
    tx_ref: params.tx_ref,
  };
}

// ──────────────────────────────────────────────
// Verify Payment
// ──────────────────────────────────────────────
export interface VerifyPaymentResult {
  status: 'successful' | 'failed' | 'pending';
  chargecode: string;
  tx_ref: string;
  transaction_id: number;
  amount: number;
  currency: string;
  customer: {
    email: string;
    name: string;
  };
  meta?: {
    userId?: string;
    listingId?: string;
    type?: string;
  };
}

export async function verifyPayment(
  transactionId: string
): Promise<VerifyPaymentResult> {
  const secretKey = getSecretKey();

  const response = await fetch(
    `${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/verify`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();

  if (data.status !== 'success') {
    throw new Error(
      `Flutterwave payment verification failed: ${data.message || 'Unknown error'}`
    );
  }

  const txData = data.data;

  return {
    status: txData.status,
    chargecode: txData.chargecode || '',
    tx_ref: txData.tx_ref,
    transaction_id: txData.id,
    amount: txData.amount,
    currency: txData.currency,
    customer: {
      email: txData.customer?.email || '',
      name: txData.customer?.name || '',
    },
    meta: txData.meta,
  };
}

// ──────────────────────────────────────────────
// Webhook Signature Verification
// ──────────────────────────────────────────────
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const webhookHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!webhookHash) {
    console.error('FLUTTERWAVE_WEBHOOK_HASH is not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookHash)
    .update(payload)
    .digest('hex');

  return expectedSignature === signature;
}
