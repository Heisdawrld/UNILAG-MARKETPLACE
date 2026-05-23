import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimits } from '@/lib/rate-limit';
import { sanitizeUrl, sanitizeText } from '@/lib/sanitize';

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

async function getAuthenticatedUserId(request?: NextRequest): Promise<string | null> {
  // If Clerk is configured, use proper auth
  if (isClerkConfigured) {
    try {
      const { userId: clerkId } = await auth();
      if (!clerkId) return null;

      if (isDatabaseAvailable()) {
        const authUser = await db.user.findUnique({
          where: { clerkId },
          select: { id: true },
        });
        return authUser?.id || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Fallback: accept userId from request body (demo/dev mode only)
  // This is only used when Clerk is not configured
  if (request) {
    try {
      const body = await request.clone().json();
      if (body?.userId && typeof body.userId === 'string') {
        return sanitizeText(body.userId, 50);
      }
    } catch {}
  }
  return null;
}

// POST /api/push/subscribe - Save push subscription
export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  // Rate limit
  const rl = await rateLimits.auth(request);
  if (!rl.success) return rl.response!;

  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'subscription required' }, { status: 400 });
    }

    // Sanitize endpoint URL
    const endpoint = sanitizeUrl(subscription.endpoint);
    if (!endpoint) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    // Validate keys structure
    if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription keys' }, { status: 400 });
    }

    // Upsert subscription (update if endpoint exists, create if not)
    await db.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
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

  // Rate limit
  const rl = await rateLimits.auth(request);
  if (!rl.success) return rl.response!;

  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
    }

    const sanitizedEndpoint = sanitizeUrl(endpoint);
    if (!sanitizedEndpoint) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    // Only allow deleting own subscriptions
    await db.pushSubscription.deleteMany({ where: { endpoint: sanitizedEndpoint, userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
