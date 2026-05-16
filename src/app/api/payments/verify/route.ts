import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyPayment } from '@/lib/flutterwave';
import { NextRequest, NextResponse } from 'next/server';

// Boost durations mapping (amount → days)
const BOOST_DURATION_MAP: Record<number, number> = {
  500: 3,
  1000: 7,
  1800: 14,
  3000: 30,
};

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const { searchParams } = new URL(request.url);
    const tx_ref = searchParams.get('tx_ref');
    const transaction_id = searchParams.get('transaction_id');

    if (!tx_ref || !transaction_id) {
      return NextResponse.redirect(
        new URL('/?payment=error&message=Missing+parameters', request.url)
      );
    }

    // ── Find the payment record ──
    const payment = await db.payment.findUnique({
      where: { flutterwaveTxRef: tx_ref },
    });

    if (!payment) {
      return NextResponse.redirect(
        new URL('/?payment=error&message=Payment+not+found', request.url)
      );
    }

    // ── Verify payment with Flutterwave ──
    const verification = await verifyPayment(transaction_id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // ── Check if payment is successful ──
    if (verification.status === 'successful' && verification.chargecode === '00') {
      // Update Payment record
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'successful',
          flutterwaveId: transaction_id,
        },
      });

      // Parse metadata to get type and listingId
      let metadata: { userId?: string; listingId?: string; type?: string } = {};
      try {
        metadata = JSON.parse(payment.metadata);
      } catch {
        // fallback to empty
      }

      const paymentType = metadata.type || payment.type;
      const listingId = metadata.listingId || payment.listingId;
      const userId = metadata.userId || payment.userId;

      // ── Handle boost payment ──
      if (paymentType === 'boost' && listingId) {
        const durationDays = BOOST_DURATION_MAP[payment.amount] || 7;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        // Create Boost record
        await db.boost.create({
          data: {
            listingId,
            paymentReference: payment.id,
            flutterwaveTxRef: tx_ref,
            amount: payment.amount,
            expiresAt,
          },
        });

        // Update Listing: boosted = true, boostedUntil = expiresAt
        await db.listing.update({
          where: { id: listingId },
          data: {
            boosted: true,
            boostedUntil: expiresAt,
          },
        });

        // Create notification for the seller
        const listing = await db.listing.findUnique({
          where: { id: listingId },
          select: { sellerId: true, title: true },
        });

        if (listing) {
          await db.notification.create({
            data: {
              userId: listing.sellerId,
              type: 'boost_expiry',
              title: 'Listing Boosted!',
              message: `Your listing "${listing.title}" has been boosted for ${durationDays} days.`,
            },
          });
        }
      }

      // ── Handle vendor subscription payment ──
      if (paymentType === 'vendor_subscription' && userId) {
        // Update User role to "vendor"
        await db.user.update({
          where: { id: userId },
          data: { role: 'vendor' },
        });

        // Create Vendor record if it doesn't exist
        const existingVendor = await db.vendor.findUnique({
          where: { ownerId: userId },
        });

        if (!existingVendor) {
          const user = await db.user.findUnique({ where: { id: userId } });
          await db.vendor.create({
            data: {
              ownerId: userId,
              businessName: `${user?.username || 'New'}'s Store`,
              description: 'Vendor on UNILAG Marketplace',
              verified: false,
            },
          });
        }

        // Create notification
        await db.notification.create({
          data: {
            userId,
            type: 'new_follower',
            title: 'Vendor Subscription Active!',
            message: 'Your vendor subscription is now active. You can start selling as a verified vendor!',
          },
        });
      }

      // ── Handle sponsored ad payment ──
      if (paymentType === 'sponsored_ad' && userId) {
        await db.notification.create({
          data: {
            userId,
            type: 'new_follower',
            title: 'Sponsored Ad Payment Received',
            message: `Your sponsored ad payment of ₦${payment.amount.toLocaleString()} has been confirmed. Your ad will be live soon.`,
          },
        });
      }

      return NextResponse.redirect(
        new URL('/?payment=success&tx_ref=' + tx_ref, appUrl)
      );
    }

    // ── Payment failed ──
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: 'failed',
        flutterwaveId: transaction_id,
      },
    });

    return NextResponse.redirect(
      new URL('/?payment=failed&tx_ref=' + tx_ref, appUrl)
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.redirect(
      new URL('/?payment=error&message=Verification+failed', request.url)
    );
  }
}
