import { db, isDatabaseAvailable } from '@/lib/db';
import {
  generateTxRef,
  initializePayment,
  isPaymentsEnabled,
  BOOST_PRICING,
  VENDOR_SUBSCRIPTION_PRICING,
  type PaymentType,
} from '@/lib/flutterwave';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { rateLimits } from '@/lib/rate-limit';
import { validateBody, PaymentInitializeSchema } from '@/lib/validation';

// Validate the requested amount against known pricing
function validateAmount(type: PaymentType, amount: number): boolean {
  if (type === 'boost') {
    return Object.values(BOOST_PRICING).some((plan) => plan.price === amount);
  }
  if (type === 'vendor_subscription') {
    return Object.values(VENDOR_SUBSCRIPTION_PRICING).some((price) => price === amount);
  }
  // sponsored_ad — allow any positive amount
  return amount > 0;
}

export async function POST(request: NextRequest) {
  // 1. Auth check
  const { userId, user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // 2. Rate limit
  const rl = await rateLimits.write(request)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }

  // 3. Check if payments are enabled
  if (!isPaymentsEnabled()) {
    return NextResponse.json(
      { error: 'Payments are currently disabled. Please try again later or contact support.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    // 4. Validate input
    const { data, error } = validateBody(PaymentInitializeSchema, body)
    if (error) return error

    const { type, amount, listingId, currency } = data

    // 5. Verify userId from auth matches the userId in the request body (if provided)
    if (body.userId && body.userId !== userId) {
      return NextResponse.json(
        { error: 'Authenticated user does not match the requested userId' },
        { status: 403 }
      );
    }

    // ── Validate amount ──
    if (!validateAmount(type, amount)) {
      return NextResponse.json(
        { error: 'Invalid amount for the specified payment type' },
        { status: 400 }
      );
    }

    // ── Validate listingId for boost type ──
    if (type === 'boost' && !listingId) {
      return NextResponse.json(
        { error: 'listingId is required for boost payments' },
        { status: 400 }
      );
    }

    // ── Fetch user details (use authenticated user) ──
    if (!user!.email) {
      return NextResponse.json(
        { error: 'User must have an email address to make payments' },
        { status: 400 }
      );
    }

    // ── Generate unique transaction reference ──
    const txRef = generateTxRef(type);

    // ── Create Payment record in database ──
    const payment = await db.payment.create({
      data: {
        userId: userId!,
        listingId: listingId || null,
        type,
        amount,
        currency,
        flutterwaveTxRef: txRef,
        status: 'pending',
        metadata: JSON.stringify({
          listingId: listingId || null,
          type,
          userId: userId,
        }),
      },
    });

    // ── Initialize Flutterwave payment ──
    const result = await initializePayment({
      tx_ref: txRef,
      amount,
      currency,
      customer: {
        email: user!.email,
        name: user!.username,
      },
      meta: {
        userId: userId!,
        listingId: listingId || undefined,
        type,
      },
    });

    return NextResponse.json({
      paymentId: payment.id,
      txRef: result.tx_ref,
      link: result.link,
      isSandbox: result.isSandbox,
      isLocked: result.isLocked,
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to initialize payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
