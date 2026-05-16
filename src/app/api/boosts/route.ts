import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, paymentReference, flutterwaveTxRef, amount, durationDays = 7 } = body;

    // ── Validate required fields ──
    if (!listingId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: listingId, amount' },
        { status: 400 }
      );
    }

    // ── Verify listing exists ──
    const listing = await db.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        sellerId: true,
        title: true,
        boosted: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // ── Calculate expiry date ──
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // ── Create Boost record ──
    const boost = await db.boost.create({
      data: {
        listingId,
        paymentReference: paymentReference || null,
        flutterwaveTxRef: flutterwaveTxRef || null,
        amount,
        expiresAt,
      },
    });

    // ── Update Listing ──
    await db.listing.update({
      where: { id: listingId },
      data: {
        boosted: true,
        boostedUntil: expiresAt,
      },
    });

    // ── Create notification for the seller ──
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
