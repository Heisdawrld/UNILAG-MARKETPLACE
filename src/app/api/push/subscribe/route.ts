import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

async function getAuthenticatedUserId() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const authUser = await db.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  return authUser?.id || null;
}

// POST /api/push/subscribe - Save push subscription
export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'subscription required' }, { status: 400 });
    }

    // Upsert subscription (update if endpoint exists, create if not)
    await db.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        keys: JSON.stringify(subscription.keys),
      },
      update: {
        userId,
        keys: JSON.stringify(subscription.keys),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

// DELETE /api/push/subscribe - Remove push subscription
export async function DELETE(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
    }

    await db.pushSubscription.deleteMany({ where: { endpoint, userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
