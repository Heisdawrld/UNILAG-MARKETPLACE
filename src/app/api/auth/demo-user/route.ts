import { db, isDatabaseAvailable } from '@/lib/db';
import { NextResponse } from 'next/server';

// Demo user endpoint for development/testing without Clerk.
// Returns a sanitized user object (no PII like phone/email/whatsapp/GPS).
export async function GET() {
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
