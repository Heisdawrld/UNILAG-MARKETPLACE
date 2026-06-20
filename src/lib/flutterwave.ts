import crypto from 'crypto';

// ──────────────────────────────────────────────
// Flutterwave API Configuration
// ──────────────────────────────────────────────

/**
 * PAYMENT MODE:
 * - 'live'   → Real Flutterwave API (production, real money)
 * - 'sandbox' → Flutterwave sandbox/test API (test mode, no real money)
 * - 'locked'  → Payments completely disabled (returns mock responses)
 *
 * Set FLUTTERWAVE_MODE in .env:
 * - Until you get the official UNILAG Marketplace Flutterwave account,
 *   keep this as 'locked' or 'sandbox'.
 * - Switch to 'live' only when the official account is ready.
 */
export type PaymentMode = 'live' | 'sandbox' | 'locked';

export function getPaymentMode(): PaymentMode {
  const mode = process.env.FLUTTERWAVE_MODE as PaymentMode
  if (mode === 'live' || mode === 'sandbox' || mode === 'locked') return mode
  // Default to locked if not configured — SAFETY FIRST
  return 'locked'
}

export function isPaymentsEnabled(): boolean {
  return getPaymentMode() !== 'locked'
}

export function isSandboxMode(): boolean {
  return getPaymentMode() === 'sandbox'
}

// Flutterwave sandbox base URL
export const FLUTTERWAVE_SANDBOX_URL = 'https://api.flutterwave.com/v3';
export const FLUTTERWAVE_LIVE_URL = 'https://api.flutterwave.com/v3';

function getBaseUrl(): string {
  return isSandboxMode() ? FLUTTERWAVE_SANDBOX_URL : FLUTTERWAVE_LIVE_URL
}

function getSecretKey(): string {
  // In locked mode, we don't need a real key
  if (getPaymentMode() === 'locked') {
    return 'LOCKED_MODE_NO_KEY_NEEDED'
  }

  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) {
    throw new Error('FLUTTERWAVE_SECRET_KEY is not configured. Set FLUTTERWAVE_MODE=locked if payments are disabled.');
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
  basic:    { name: 'BASIC BOOST',    price: 300,  durationHours: 6   },
  standard: { name: 'STANDARD BOOST', price: 700,  durationHours: 24  },
  premium:  { name: 'PREMIUM BOOST',  price: 1500, durationHours: 72  },
  ultra:    { name: 'ULTRA BOOST',    price: 3000, durationHours: 168 },
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
  const prefix = isSandboxMode() ? 'ULM_TEST' : 'ULM'
  return `${prefix}_${type}_${Date.now()}_${randomString}`;
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
    orderId?: string;
    type: string;
  };
}

export interface InitializePaymentResult {
  link: string;
  tx_ref: string;
  /** When true, this is a mock/sandbox payment — not real money */
  isSandbox: boolean;
  /** When true, payment was blocked — no Flutterwave call made */
  isLocked: boolean;
}

export async function initializePayment(
  params: InitializePaymentParams
): Promise<InitializePaymentResult> {
  // ── LOCKED MODE: Return mock response, no API call ──
  if (getPaymentMode() === 'locked') {
    console.warn('[flutterwave] Payments are LOCKED. Set FLUTTERWAVE_MODE=sandbox|live to enable.')
    return {
      link: `${getAppUrl()}/payment-locked?ref=${params.tx_ref}`,
      tx_ref: params.tx_ref,
      isSandbox: true,
      isLocked: true,
    }
  }

  // ── SANDBOX/LIVE MODE: Call Flutterwave API ──
  const secretKey = getSecretKey();
  const baseUrl = getBaseUrl();
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
      title: isSandboxMode() ? 'UNILAG Marketplace (TEST)' : 'UNILAG Marketplace',
      logo: 'https://unilag.edu.ng/wp-content/uploads/2019/06/unilag-logo.png',
    },
    meta: params.meta,
  };

  const response = await fetch(`${baseUrl}/payments`, {
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
    isSandbox: isSandboxMode(),
    isLocked: false,
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
  isSandbox: boolean;
}

export async function verifyPayment(
  transactionId: string
): Promise<VerifyPaymentResult> {
  // ── LOCKED MODE: Auto-approve for testing ──
  if (getPaymentMode() === 'locked') {
    return {
      status: 'successful',
      chargecode: '00',
      tx_ref: `LOCKED_${transactionId}`,
      transaction_id: parseInt(transactionId) || 0,
      amount: 0,
      currency: 'NGN',
      customer: { email: 'test@unilag.edu.ng', name: 'Test User' },
      meta: { type: 'locked_mode_test' },
      isSandbox: true,
    }
  }

  // ── SANDBOX/LIVE MODE ──
  const secretKey = getSecretKey();
  const baseUrl = getBaseUrl();

  const response = await fetch(
    `${baseUrl}/transactions/${transactionId}/verify`,
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
    isSandbox: isSandboxMode(),
  };
}

// ──────────────────────────────────────────────
// Webhook Signature Verification
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// Initiate Refund
// ──────────────────────────────────────────────
export interface RefundResult {
  success: boolean;
  refundId?: number;         // Flutterwave refund ID
  transactionId?: number;    // Flutterwave transaction ID
  amountRefunded?: number;   // Amount refunded
  status?: string;           // Refund status from Flutterwave
  txRef?: string;            // Our internal reference
  isSandbox: boolean;
  isLocked: boolean;
  error?: string;
}

export async function initiateRefund(params: {
  transactionId: string;  // Flutterwave transaction ID
  amount?: number;        // Partial refund amount (optional, full refund if omitted)
  txRef?: string;         // Internal reference for logging
}): Promise<RefundResult> {
  const mode = getPaymentMode();

  // ── LOCKED MODE: Return mock success ──
  if (mode === 'locked') {
    console.warn('[flutterwave] Payments LOCKED — returning mock refund response')
    return {
      success: true,
      refundId: Date.now(),
      transactionId: parseInt(params.transactionId) || 0,
      amountRefunded: params.amount || 0,
      status: 'completed',
      txRef: params.txRef || `LOCKED_REFUND_${Date.now()}`,
      isSandbox: true,
      isLocked: true,
    }
  }

  // ── SANDBOX/LIVE MODE: Call Flutterwave API ──
  try {
    const secretKey = getSecretKey();
    const baseUrl = getBaseUrl();

    const requestBody: Record<string, unknown> = {
      id: params.transactionId,
    };

    // Include amount only for partial refunds
    if (params.amount) {
      requestBody.amount = params.amount;
    }

    const response = await fetch(`${baseUrl}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      console.error('[flutterwave] Refund API error:', data.message || 'Unknown error')
      return {
        success: false,
        isSandbox: isSandboxMode(),
        isLocked: false,
        error: data.message || 'Refund request failed',
      }
    }

    return {
      success: true,
      refundId: data.data?.id,
      transactionId: data.data?.transaction_id,
      amountRefunded: data.data?.amount,
      status: data.data?.status,
      txRef: params.txRef || data.data?.tx_ref,
      isSandbox: isSandboxMode(),
      isLocked: false,
    }
  } catch (error) {
    console.error('[flutterwave] Refund request exception:', error)
    return {
      success: false,
      isSandbox: isSandboxMode(),
      isLocked: false,
      error: error instanceof Error ? error.message : 'Refund request failed',
    }
  }
}

// ──────────────────────────────────────────────
// Initiate Transfer (Payout to Runner)
// ──────────────────────────────────────────────
export interface TransferResult {
  success: boolean;
  transferId?: number;       // Flutterwave transfer ID
  reference?: string;        // Unique transfer reference
  status?: string;           // Transfer status: 'queued', 'processing', 'success', 'failed'
  amount?: number;           // Amount transferred
  currency?: string;
  flutterwaveRef?: string;   // Flutterwave's reference for the transfer
  isSandbox: boolean;
  isLocked: boolean;
  error?: string;
}

export async function initiateTransfer(params: {
  accountBank: string;     // Bank code (e.g. '044' for Access Bank)
  accountNumber: string;   // Account number
  amount: number;          // Amount in naira (not kobo)
  narration: string;       // Transfer description
  reference: string;       // Unique reference
  currency?: string;       // Default 'NGN'
  beneficiaryName: string; // Account holder name
}): Promise<TransferResult> {
  const mode = getPaymentMode();

  // ── LOCKED MODE: Return mock success ──
  if (mode === 'locked') {
    console.warn('[flutterwave] Payments LOCKED — returning mock transfer response')
    return {
      success: true,
      transferId: Date.now(),
      reference: params.reference,
      status: 'queued',
      amount: params.amount,
      currency: params.currency || 'NGN',
      flutterwaveRef: `LOCKED_XFR_${Date.now()}`,
      isSandbox: true,
      isLocked: true,
    }
  }

  // ── SANDBOX/LIVE MODE: Call Flutterwave API ──
  try {
    const secretKey = getSecretKey();
    const baseUrl = getBaseUrl();

    const requestBody = {
      account_bank: params.accountBank,
      account_number: params.accountNumber,
      amount: params.amount,
      narration: params.narration,
      reference: params.reference,
      currency: params.currency || 'NGN',
      beneficiary_name: params.beneficiaryName,
      callback_url: `${getAppUrl()}/api/payments/transfer-webhook`,
      debit_currency: params.currency || 'NGN',
    };

    const response = await fetch(`${baseUrl}/transfers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      console.error('[flutterwave] Transfer API error:', data.message || 'Unknown error')
      return {
        success: false,
        isSandbox: isSandboxMode(),
        isLocked: false,
        error: data.message || 'Transfer request failed',
      }
    }

    return {
      success: true,
      transferId: data.data?.id,
      reference: data.data?.reference,
      status: data.data?.status,
      amount: data.data?.amount,
      currency: data.data?.currency,
      flutterwaveRef: data.data?.flutterwave_ref || data.data?.reference,
      isSandbox: isSandboxMode(),
      isLocked: false,
    }
  } catch (error) {
    console.error('[flutterwave] Transfer request exception:', error)
    return {
      success: false,
      isSandbox: isSandboxMode(),
      isLocked: false,
      error: error instanceof Error ? error.message : 'Transfer request failed',
    }
  }
}

// ──────────────────────────────────────────────
// Fetch Supported Banks (for payout bank codes)
// ──────────────────────────────────────────────
export interface BankInfo {
  id: string;       // Bank code (e.g. '044')
  name: string;     // Bank name (e.g. 'Access Bank')
  code: string;     // Same as id
}

export async function fetchBanks(currency: string = 'NGN'): Promise<BankInfo[]> {
  const mode = getPaymentMode();

  // ── LOCKED MODE: Return common Nigerian banks ──
  if (mode === 'locked') {
    return [
      { id: '044', name: 'Access Bank', code: '044' },
      { id: '023', name: 'Citibank Nigeria', code: '023' },
      { id: '063', name: 'Diamond Bank', code: '063' },
      { id: '050', name: 'EcoBank Nigeria', code: '050' },
      { id: '084', name: 'Enterprise Bank', code: '084' },
      { id: '070', name: 'Fidelity Bank', code: '070' },
      { id: '011', name: 'First Bank of Nigeria', code: '011' },
      { id: '214', name: 'First City Monument Bank', code: '214' },
      { id: '058', name: 'Guaranty Trust Bank', code: '058' },
      { id: '030', name: 'Heritage Bank', code: '030' },
      { id: '301', name: 'Jaiz Bank', code: '301' },
      { id: '082', name: 'Keystone Bank', code: '082' },
      { id: '526', name: 'Parallex Bank', code: '526' },
      { id: '076', name: 'Polaris Bank', code: '076' },
      { id: '101', name: 'Providus Bank', code: '101' },
      { id: '221', name: 'Stanbic IBTC Bank', code: '221' },
      { id: '068', name: 'Standard Chartered Bank', code: '068' },
      { id: '232', name: 'Sterling Bank', code: '232' },
      { id: '100', name: 'SunTrust Bank', code: '100' },
      { id: '032', name: 'Union Bank of Nigeria', code: '032' },
      { id: '033', name: 'United Bank for Africa', code: '033' },
      { id: '215', name: 'Unity Bank', code: '215' },
      { id: '035', name: 'Wema Bank', code: '035' },
      { id: '057', name: 'Zenith Bank', code: '057' },
    ]
  }

  // ── SANDBOX/LIVE MODE ──
  try {
    const secretKey = getSecretKey();
    const baseUrl = getBaseUrl();

    const response = await fetch(`${baseUrl}/banks?currency=${currency}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.status !== 'success') {
      console.error('[flutterwave] Fetch banks error:', data.message || 'Unknown error')
      return []
    }

    return (data.data || []).map((bank: { id: string; name: string; code: string }) => ({
      id: bank.id,
      name: bank.name,
      code: bank.code,
    }))
  } catch (error) {
    console.error('[flutterwave] Fetch banks exception:', error)
    return []
  }
}

// ──────────────────────────────────────────────
// Verify Transfer Status
// ──────────────────────────────────────────────
export interface TransferStatusResult {
  success: boolean;
  status?: string;     // 'queued', 'processing', 'success', 'failed', 'reversed'
  transferId?: number;
  reference?: string;
  error?: string;
}

export async function verifyTransfer(transferId: string): Promise<TransferStatusResult> {
  const mode = getPaymentMode();

  // ── LOCKED MODE ──
  if (mode === 'locked') {
    return {
      success: true,
      status: 'success',
      transferId: parseInt(transferId) || 0,
      reference: `LOCKED_XFR_${transferId}`,
    }
  }

  // ── SANDBOX/LIVE MODE ──
  try {
    const secretKey = getSecretKey();
    const baseUrl = getBaseUrl();

    const response = await fetch(`${baseUrl}/transfers/${transferId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.status !== 'success') {
      return {
        success: false,
        error: data.message || 'Failed to verify transfer',
      }
    }

    return {
      success: true,
      status: data.data?.status,
      transferId: data.data?.id,
      reference: data.data?.reference,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transfer verification failed',
    }
  }
}

// ──────────────────────────────────────────────
// Webhook Signature Verification
// ──────────────────────────────────────────────
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  // In sandbox mode without hash configured, require at least a signature presence check
  if (isSandboxMode() && !process.env.FLUTTERWAVE_WEBHOOK_HASH) {
    console.error('[flutterwave] CRITICAL: FLUTTERWAVE_WEBHOOK_HASH not set in sandbox mode. Webhook verification is DISABLED. Set the webhook hash immediately.')
    // In sandbox without hash, require at least a basic signature check
    if (!signature) {
      console.error('[flutterwave] No webhook signature provided — rejecting')
      return false
    }
    // Allow in sandbox if any signature is present (better than nothing)
    console.warn('[flutterwave] Accepting sandbox webhook with unverified signature — SET FLUTTERWAVE_WEBHOOK_HASH!')
    return true
  }

  const webhookHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!webhookHash) {
    console.error('FLUTTERWAVE_WEBHOOK_HASH is not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookHash)
    .update(payload)
    .digest('hex');

  // Constant-time comparison prevents timing attacks
  try {
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const sigBuf = Buffer.from(signature, 'hex');
    return expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}
