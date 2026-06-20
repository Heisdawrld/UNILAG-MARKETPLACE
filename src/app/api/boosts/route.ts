import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimits } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit
  const rl = await rateLimits.write(request)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }

  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { listingId, paymentReference, flutterwaveTxRef, amount, durationDays = 7, planId } = body;

    if (!listingId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: listingId, amount' },
        { status: 400 }
      );
    }

    // Validate planId if provided
    const validPlanIds = ['basic', 'premium', 'elite'];
    const boostTier = planId && validPlanIds.includes(planId) ? planId : 'basic';

    const listing = await db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, sellerId: true, title: true, boosted: true },
    });

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (listing.sellerId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only boost your own listings' }, { status: 403 });
    }

    // Verify a successful payment exists for this boost
    if (paymentReference) {
      const payment = await db.payment.findUnique({ where: { id: paymentReference } });
      if (!payment || payment.status !== 'successful' || payment.userId !== authUser.id) {
        return NextResponse.json({ error: 'Valid completed payment not found for this boost' }, { status: 400 });
      }
    } else if (!flutterwaveTxRef) {
      return NextResponse.json({ error: 'paymentReference or flutterwaveTxRef is required' }, { status: 400 });
    }

    // Idempotency: prevent duplicate boosts for the same payment
    if (flutterwaveTxRef) {
      const existingBoost = await db.boost.findFirst({ where: { flutterwaveTxRef } });
      if (existingBoost) {
        return NextResponse.json(existingBoost);
      }
    }

    // If a txRef is provided without paymentReference, verify the payment exists and is successful
    if (flutterwaveTxRef && !paymentReference) {
      const existingPayment = await db.payment.findFirst({
        where: { flutterwaveTxRef, status: 'successful' },
      });
      if (!existingPayment) {
        return NextResponse.json(
          { error: 'Payment verification required. No successful payment found for this reference.' },
          { status: 400 }
        );
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const boost = await db.boost.create({
      data: {
        listingId,
        paymentReference: paymentReference || null,
        flutterwaveTxRef: flutterwaveTxRef || null,
        amount,
        planId: boostTier,
        expiresAt,
      },
    });

    await db.listing.update({
      where: { id: listingId },
      data: { boosted: true, boostedUntil: expiresAt, boostTier },
    });

    await db.notification.create({
      data: {
        userId: listing.sellerId,
        type: 'boost_expiry',
        title: 'Listing Boosted!',
        message: `Your listing "${listing.title}" has been boosted for ${durationDays} days. It will be highlighted until ${expiresAt.toLocaleDateString('en-NG')}.`,
      },
    });

    return NextResponse.json(boost, { status: 201 });
  } catch (error) {
    console.error('Error creating boost:', error);
    return NextResponse.json(
      { error: 'Failed to create boost' },
      { status: 500 }
    );
  }
}
