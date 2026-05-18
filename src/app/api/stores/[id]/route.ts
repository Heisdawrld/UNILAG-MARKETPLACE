import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { sendPushToUser } from '@/lib/push';
import { NextRequest, NextResponse } from 'next/server';

async function getAuthUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, username: true, role: true },
  });
}

// GET /api/stores/[id] - Get store by ID or slug
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const { id } = await params;
    const viewer = await getAuthUser();

    const storeById = await db.store.findUnique({ where: { id } });
    const targetStore = storeById || await db.store.findUnique({ where: { slug: id } });

    if (!targetStore) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const canManage = viewer && (viewer.role === 'admin' || viewer.id === targetStore.ownerId);

    const store = await db.store.findUnique({
      where: { id: targetStore.id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true,
            bio: true,
            verificationStatus: true,
            ratingAverage: true,
            totalReviews: true,
            phone: true,
            whatsapp: true,
            createdAt: true,
          },
        },
        listings: {
          where: canManage ? { status: { not: 'removed' } } : { status: 'active' },
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
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser.role === 'banned') {
      return NextResponse.json({ error: 'Banned users cannot follow stores' }, { status: 403 });
    }

    const { id: storeId } = await params;
    const { userId, action } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    if (userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only follow stores as yourself' }, { status: 403 });
    }

    const store = await db.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (action === 'unfollow') {
      const deleted = await db.storeFollow.deleteMany({ where: { userId, storeId } });
      if (deleted.count > 0) {
        await db.store.update({
          where: { id: storeId },
          data: { followCount: { decrement: 1 } },
        });
      }
      return NextResponse.json({ followed: false });
    }

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

    await db.notification.create({
      data: {
        userId: store.ownerId,
        type: 'new_follower',
        title: 'New Follower! 🎉',
        message: `${authUser.username || 'Someone'} started following your store`,
        data: JSON.stringify({ storeId }),
      },
    }).catch(() => {});

    sendPushToUser(store.ownerId, {
      title: '🎉 New Follower!',
      body: `${authUser.username || 'Someone'} is now following ${store.name}`,
      type: 'new_follower',
      tag: 'follower',
      data: { storeId },
    }).catch(() => {});

    return NextResponse.json({ followed: true });
  } catch (error) {
    console.error('Error following store:', error);
    return NextResponse.json({ error: 'Failed to follow store' }, { status: 500 });
  }
}
