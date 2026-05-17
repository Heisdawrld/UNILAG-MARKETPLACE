import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/stores/[id] - Get store by ID or slug
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const { id } = await params;

    // Try by ID first, then by slug
    let store = await db.store.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true, username: true, avatar: true, bio: true,
            verificationStatus: true, ratingAverage: true, totalReviews: true,
            phone: true, whatsapp: true, createdAt: true,
          },
        },
        listings: {
          where: { status: 'active' },
          include: {
            seller: {
              select: { id: true, username: true, avatar: true, verificationStatus: true, ratingAverage: true },
            },
          },
          orderBy: [{ boosted: 'desc' }, { createdAt: 'desc' }],
          take: 50,
        },
        _count: { select: { listings: true, followers: true } },
      },
    });

    if (!store) {
      store = await db.store.findUnique({
        where: { slug: id },
        include: {
          owner: {
            select: {
              id: true, username: true, avatar: true, bio: true,
              verificationStatus: true, ratingAverage: true, totalReviews: true,
              phone: true, whatsapp: true, createdAt: true,
            },
          },
          listings: {
            where: { status: 'active' },
            include: {
              seller: {
                select: { id: true, username: true, avatar: true, verificationStatus: true, ratingAverage: true },
              },
            },
            orderBy: [{ boosted: 'desc' }, { createdAt: 'desc' }],
            take: 50,
          },
          _count: { select: { listings: true, followers: true } },
        },
      });
    }

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json(store);
  } catch (error) {
    console.error('Error fetching store:', error);
    return NextResponse.json({ error: 'Failed to fetch store' }, { status: 500 });
  }
}

// POST /api/stores/[id] - Follow/unfollow store
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const { id: storeId } = await params;
    const { userId, action } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    if (action === 'unfollow') {
      await db.storeFollow.deleteMany({ where: { userId, storeId } });
      await db.store.update({
        where: { id: storeId },
        data: { followCount: { decrement: 1 } },
      });
      return NextResponse.json({ followed: false });
    }

    // Follow
    const existing = await db.storeFollow.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });

    if (existing) {
      return NextResponse.json({ followed: true, message: 'Already following' });
    }

    await db.storeFollow.create({ data: { userId, storeId } });
    await db.store.update({
      where: { id: storeId },
      data: { followCount: { increment: 1 } },
    });

    // Notify store owner
    const store = await db.store.findUnique({ where: { id: storeId } });
    if (store) {
      const follower = await db.user.findUnique({ where: { id: userId } });
      await db.notification.create({
        data: {
          userId: store.ownerId,
          type: 'new_follower',
          title: 'New Follower! 🎉',
          message: `${follower?.username || 'Someone'} started following your store`,
          data: JSON.stringify({ storeId }),
        },
      });
    }

    return NextResponse.json({ followed: true });
  } catch (error) {
    console.error('Error following store:', error);
    return NextResponse.json({ error: 'Failed to follow store' }, { status: 500 });
  }
}
