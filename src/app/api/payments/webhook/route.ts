import { db } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/flutterwave';
import { NextRequest, NextResponse } from 'next/server';

// Boost durations mapping (amount → days)
const BOOST_DURATION_MAP: Record<number, number> = {
  500: 3,
  1000: 7,
  1800: 14,
  3000: 30,
};

export async function POST(request: NextRequest) {
  try {
    // ── Get signature header ──
    const signature = request.headers.get('verif-hash');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing verification signature' },
        { status: 401 }
      );
    }

    // ── Read raw body for signature verification ──
    const rawBody = await request.text();

    // ── Verify webhook signature ──
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // ── Parse the payload ──
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    if (!data || !data.tx_ref) {
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    // ── Find the payment record ──
    const payment = await db.payment.findUnique({
      where: { flutterwaveTxRef: data.tx_ref },
    });

    if (!payment) {
      // Payment not found in our system — acknowledge but don't process
      return NextResponse.json({ received: true });
    }

    // ── Process event ──
    switch (event) {
      case 'charge.completed': {
        if (data.status === 'successful' && data.chargecode === '00') {
          // Only process if payment was previously pending
          if (payment.status === 'pending') {
            await db.payment.update({
              where: { id: payment.id },
              data: {
                status: 'successful',
                flutterwaveId: data.id?.toString() || null,
              },
            });

            // Parse metadata
            let metadata: { userId?: string; listingId?: string; type?: string } = {};
            try {
              metadata = JSON.parse(payment.metadata);
            } catch {
              // fallback
            }

            const paymentType = metadata.type || payment.type;
            const listingId = metadata.listingId || payment.listingId;
            const userId = metadata.userId || payment.userId;

            // ── Handle boost payment ──
            if (paymentType === 'boost' && listingId) {
              const durationDays = BOOST_DURATION_MAP[payment.amount] || 7;
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + durationDays);

              await db.boost.create({
                data: {
                  listingId,
                  paymentReference: payment.id,
                  flutterwaveTxRef: data.tx_ref,
                  amount: payment.amount,
                  expiresAt,
                },
              });

              await db.listing.update({
                where: { id: listingId },
                data: {
                  boosted: true,
                  boostedUntil: expiresAt,
                },
              });

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
              await db.user.update({
                where: { id: userId },
                data: { role: 'vendor' },
              });

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

              await db.notification.create({
                data: {
                  userId,
                  type: 'new_follower',
                  title: 'Vendor Subscription Active!',
                  message: 'Your vendor subscription is now active.',
                },
              });
            }

            // ── Handle sponsored ad payment ──
            if (paymentType === 'sponsored_ad' && userId) {
              await db.notification.create({
                data: {
                  userId,
                  type: 'new_follower',
                  title: 'Sponsored Ad Confirmed',
                  message: `Your sponsored ad payment of ₦${payment.amount.toLocaleString()} has been confirmed.`,
                },
              });
            }
          }
        } else if (data.status === 'failed') {
          // Update payment status to failed
          if (payment.status === 'pending') {
            await db.payment.update({
              where: { id: payment.id },
              data: {
                status: 'failed',
                flutterwaveId: data.id?.toString() || null,
              },
            });
          }
        }
        break;
      }

      case 'transfer.completed': {
        // Handle transfer completed events if needed
        if (payment.status === 'pending') {
          await db.payment.update({
            where: { id: payment.id },
            data: {
              status: data.status === 'successful' ? 'successful' : 'failed',
              flutterwaveId: data.id?.toString() || null,
            },
          });
        }
        break;
      }

      default: {
        // Acknowledge unhandled events
        console.log(`Unhandled Flutterwave event: ${event}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Always return 200 for webhooks so Flutterwave doesn't retry unnecessarily
    return NextResponse.json({ received: true });
  }
}
