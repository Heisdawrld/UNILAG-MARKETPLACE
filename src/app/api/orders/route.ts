import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { generateTxRef, isPaymentsEnabled, initializePayment } from '@/lib/flutterwave';
import { calculateCommission } from '@/lib/escrow';
import { rateLimits } from '@/lib/rate-limit';

async function getAuthUser() {
  const { auth } = await import('@clerk/nextjs/server');
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, email: true, username: true, role: true },
  });
}

// POST /api/orders — Create a marketplace order (Buy Now)
export async function POST(request: NextRequest) {
  // Rate limit
  const rl = await rateLimits.write(request);
  if (!rl.success) return rl.response!;

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    }

    const body = await request.json();
    const { listingId, paymentMethod = 'flutterwave' } = body;

    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }

    // Find the listing
    const listing = await db.listing.findUnique({
      where: { id: listingId },
      include: { seller: { select: { id: true, clerkId: true } } },
    });
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    if (listing.status !== 'active') return NextResponse.json({ error: 'Listing not available' }, { status: 400 });

    // Buyer cannot buy their own item
    if (authUser.id === listing.seller.id) {
      return NextResponse.json({ error: 'Cannot buy your own item' }, { status: 400 });
    }

    // Calculate fees
    const amount = listing.price;
    const { runnerPayout: sellerPayout, platformFee } = calculateCommission(amount);

    // Create order
    const order = await db.marketplaceOrder.create({
      data: {
        buyerId: authUser.id,
        sellerId: listing.seller.id,
        listingId,
        storeId: listing.storeId || null,
        amount,
        platformFee,
        sellerPayout,
        status: 'pending',
        paymentMethod,
        paymentStatus: 'unpaid',
      },
    });

    // If Flutterwave payment, initialize it
    if (paymentMethod === 'flutterwave' && isPaymentsEnabled()) {
      const txRef = generateTxRef('order');
      await db.marketplaceOrder.update({
        where: { id: order.id },
        data: { paymentReference: txRef },
      });

      const result = await initializePayment({
        tx_ref: txRef,
        amount,
        currency: 'NGN',
        customer: {
          email: authUser.email || `${authUser.id}@placeholder.com`,
          name: authUser.username,
        },
        meta: {
          userId: authUser.id,
          type: 'marketplace_order',
          orderId: order.id,
          listingId,
        },
      });

      return NextResponse.json({ order, paymentLink: result.link, txRef });
    }

    // Locked/cash mode — mark as escrow
    if (paymentMethod === 'cash' || !isPaymentsEnabled()) {
      await db.marketplaceOrder.update({
        where: { id: order.id },
        data: {
          paymentMethod: isPaymentsEnabled() ? paymentMethod : 'locked',
          paymentStatus: 'escrow',
        },
      });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('[orders] Create error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

// GET /api/orders — List user's orders
export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'buyer'; // 'buyer' or 'seller'
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    const where = role === 'seller' ? { sellerId: authUser.id } : { buyerId: authUser.id };

    const [orders, total] = await Promise.all([
      db.marketplaceOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              images: true,
              condition: true,
            },
          },
          buyer: {
            select: { id: true, username: true, avatar: true },
          },
          seller: {
            select: { id: true, username: true, avatar: true },
          },
        },
      }),
      db.marketplaceOrder.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[orders] List error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
