import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/flutterwave';
import { NextRequest, NextResponse } from 'next/server';

function getBoostPlan(amount: number) {
  if (amount === 300) return { planId: 'basic', durationHours: 6 };
  if (amount === 700) return { planId: 'standard', durationHours: 24 };
  if (amount === 1500) return { planId: 'premium', durationHours: 72 };
  return { planId: 'ultra', durationHours: 168 };
}

function buildStoreSlug(username: string) {
  const base = `${username}-store`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return `${base || 'vendor-store'}-${Date.now().toString().slice(-6)}`;
}

async function ensureVendorStore(userId: string) {
  const existingStore = await db.store.findUnique({
    where: { ownerId: userId },
  });

  if (existingStore) {
    return existingStore;
  }

  const user = await db.user.findUnique({ where: { id: userId } });

  return db.store.create({
    data: {
      ownerId: userId,
      name: `${user?.username || 'New'}'s Store`,
      slug: buildStoreSlug(user?.username || 'new'),
      category: 'Others',
      description: 'Vendor on UNILAG Marketplace',
      phone: user?.phone,
      whatsapp: user?.whatsapp,
      address: user?.hostel ? `${user.hostel}, UNILAG` : 'UNILAG Campus',
      isVerified: false,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }

  try {
    const signature = request.headers.get('verif-hash');
    if (!signature) {
      return NextResponse.json({ error: 'Missing verification signature' }, { status: 401 });
    }

    const rawBody = await request.text();

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    if (!data || !data.tx_ref) {
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
    }

    const payment = await db.payment.findUnique({
      where: { flutterwaveTxRef: data.tx_ref },
    });

    if (!payment) {
      return NextResponse.json({ received: true });
    }

    switch (event) {
      case 'charge.completed': {
        if (data.status === 'successful' && data.chargecode === '00' && payment.status === 'pending') {
          // Verify the amount matches — reject underpayments
          if (typeof data.amount === 'number' && data.amount < payment.amount) {
            await db.payment.update({
              where: { id: payment.id },
              data: { status: 'failed', flutterwaveId: data.id?.toString() || null },
            });
            break;
          }

          await db.payment.update({
            where: { id: payment.id },
            data: {
              status: 'successful',
              flutterwaveId: data.id?.toString() || null,
            },
          });

          let metadata: { userId?: string; listingId?: string; type?: string } = {};
          try {
            metadata = JSON.parse(payment.metadata);
          } catch {
            metadata = {};
          }

          const paymentType = metadata.type || payment.type;
          const listingId = metadata.listingId || payment.listingId;
          const userId = metadata.userId || payment.userId;

          if (paymentType === 'boost' && listingId) {
            // Idempotency: skip if a boost already exists for this transaction
            const existingBoost = await db.boost.findFirst({ where: { flutterwaveTxRef: data.tx_ref } });
            if (!existingBoost) {
              const plan = getBoostPlan(payment.amount);
              const expiresAt = new Date();
              expiresAt.setHours(expiresAt.getHours() + plan.durationHours);

              await db.boost.create({
                data: {
                  listingId,
                  paymentReference: payment.id,
                  flutterwaveTxRef: data.tx_ref,
                  amount: payment.amount,
                  planId: plan.planId,
                  expiresAt,
                },
              });

              await db.listing.update({
                where: { id: listingId },
                data: { boosted: true, boostedUntil: expiresAt },
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
                    message: `Your listing "${listing.title}" has been boosted for ${plan.durationHours} hours.`,
                  },
                });
              }
            }
          }

          if (paymentType === 'vendor_subscription' && userId) {
            await db.user.update({
              where: { id: userId },
              data: { role: 'vendor' },
            });

            await ensureVendorStore(userId);

            await db.notification.create({
              data: {
                userId,
                type: 'new_follower',
                title: 'Vendor Subscription Active!',
                message: 'Your vendor subscription is now active.',
              },
            });
          }

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
        } else if (data.status === 'failed' && payment.status === 'pending') {
          await db.payment.update({
            where: { id: payment.id },
            data: {
              status: 'failed',
              flutterwaveId: data.id?.toString() || null,
            },
          });
        }
        break;
      }

      case 'transfer.completed': {
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
        console.log(`Unhandled Flutterwave event: ${event}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ received: true });
  }
}
