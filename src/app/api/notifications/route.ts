import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const clerkSecKey = process.env.CLERK_SECRET_KEY || '';
const isClerkConfigured = !!(
  clerkPubKey &&
  clerkSecKey &&
  clerkPubKey !== 'undefined' &&
  clerkSecKey !== 'undefined' &&
  clerkPubKey.startsWith('pk_')
);

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
    }

    let authUser: { id: string } | null = null;

    if (isClerkConfigured) {
      const { userId: clerkId } = await auth();
      if (!clerkId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      authUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
      if (!authUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    if (authUser && userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — cannot read another user\'s notifications' }, { status: 403 });
    }

    const notifications = await db.notification.findMany({
      where: {
        userId,
        type: { not: 'runner_application' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const unreadCount = notifications.filter((notification) => !notification.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
