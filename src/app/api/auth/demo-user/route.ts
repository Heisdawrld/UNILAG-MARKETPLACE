import { db, isDatabaseAvailable } from '@/lib/db';
import { NextResponse } from 'next/server';

// Demo user endpoint for development/testing without Clerk.
// Returns a sanitized user object (no PII like phone/email/whatsapp/GPS).
//
// SAFETY: This endpoint is DEV-ONLY. When Clerk is configured (pk_test_ or
// pk_live_), it refuses to run. Previously, the live deploy (pk_live_) fell
// into the demo-user branch because page.tsx only checked for pk_test_, which
// auto-signed-in every visitor as the first seeded user ("chidi"). This guard
// ensures that can never happen again, regardless of the client-side check.
export async function GET() {
  // Block in production / whenever Clerk is configured.
  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  const clerkSecKey = process.env.CLERK_SECRET_KEY || '';
  const isClerkConfigured = !!(
    clerkPubKey && clerkSecKey &&
    (clerkPubKey.startsWith('pk_test_') || clerkPubKey.startsWith('pk_live_')) &&
    clerkSecKey.startsWith('sk_')
  );
  if (isClerkConfigured) {
    return NextResponse.json(
      { error: 'Demo user disabled — Clerk is configured. Sign in via /sign-in.' },
      { status: 403 }
    );
  }

  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }

  try {
    // Find the first user with a clerkId of 'demo', or create one if none exists
    let demoUser = await db.user.findFirst({ where: { clerkId: 'demo' } });

    if (!demoUser) {
      // Use the first user in the DB as the demo user (seed data)
      const firstUser = await db.user.findFirst({ orderBy: { createdAt: 'asc' } });

      if (firstUser) {
        // Tag them as the demo user
        demoUser = await db.user.update({
          where: { id: firstUser.id },
          data: { clerkId: 'demo' },
        });
      } else {
        // No users at all — create a minimal demo user
        demoUser = await db.user.create({
          data: {
            clerkId: 'demo',
            username: 'demo_user',
            email: 'demo@unilagmarket.ng',
            verificationStatus: 'email_verified',
            ratingAverage: 4.5,
            role: 'user',
          },
        });
      }
    }

    // Return sanitized user (strip PII)
    const { phone, whatsapp, runnerCurrentLat, runnerCurrentLng, runnerLocationUpdatedAt, ...safeUser } = demoUser;

    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Demo user error:', error);
    return NextResponse.json({ error: 'Failed to load demo user' }, { status: 500 });
  }
}
