import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyPayment } from '@/lib/flutterwave';
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

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const txRef = searchParams.get('tx_ref');
    const transactionId = searchParams.get('transaction_id');

    if (!txRef || !transactionId) {
      return NextResponse.redirect(new URL('/?payment=error&message=Missing+parameters', request.url));
    }

    const payment = await db.payment.findUnique({
      where: { flutterwaveTxRef: txRef },
    });

    if (!payment) {
      return NextResponse.redirect(new URL('/?payment=error&message=Payment+not+found', request.url));
    }

    const verification = await verifyPayment(transactionId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (verification.status === 'successful' && verification.chargecode === '00') {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'successful',
          flutterwaveId: transactionId,
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
        const plan = getBoostPlan(payment.amount);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + plan.durationHours);

        await db.boost.create({
          data: {
            listingId,
            paymentReference: payment.id,
            flutterwaveTxRef: txRef,
            amount: payment.amount,
            planId: plan.planId,
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
              message: `Your listing "${listing.title}" has been boosted for ${plan.durationHours} hours.`,
            },
          });
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
            message: 'Your vendor subscription is now active. You can start selling as a campus vendor.',
          },
        });
      }

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

      return NextResponse.redirect(new URL(`/?payment=success&tx_ref=${txRef}`, appUrl));
    }

    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: 'failed',
        flutterwaveId: transactionId,
      },
    });

    return NextResponse.redirect(new URL(`/?payment=failed&tx_ref=${txRef}`, appUrl));
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.redirect(new URL('/?payment=error&message=Verification+failed', request.url));
  }
}
