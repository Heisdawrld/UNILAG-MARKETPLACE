import { db, isDatabaseAvailable } from '@/lib/db';
import {
  generateTxRef,
  initializePayment,
  VALID_PAYMENT_TYPES,
  BOOST_PRICING,
  VENDOR_SUBSCRIPTION_PRICING,
  type PaymentType,
} from '@/lib/flutterwave';
import { NextRequest, NextResponse } from 'next/server';

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
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const { userId, listingId, type, amount, currency = 'NGN' } = body;

    // ── Validate required fields ──
    if (!userId || !type || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, amount' },
        { status: 400 }
      );
    }

    // ── Validate payment type ──
    if (!VALID_PAYMENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid payment type. Must be one of: ${VALID_PAYMENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // ── Validate amount ──
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

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

    // ── Fetch user details ──
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.email) {
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
        userId,
        listingId: listingId || null,
        type,
        amount,
        currency,
        flutterwaveTxRef: txRef,
        status: 'pending',
        metadata: JSON.stringify({
          listingId: listingId || null,
          type,
          userId,
        }),
      },
    });

    // ── Initialize Flutterwave payment ──
    const result = await initializePayment({
      tx_ref: txRef,
      amount,
      currency,
      customer: {
        email: user.email,
        name: user.username,
      },
      meta: {
        userId,
        listingId: listingId || undefined,
        type,
      },
    });

    return NextResponse.json({
      paymentId: payment.id,
      txRef: result.tx_ref,
      link: result.link,
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to initialize payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
