import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { clerkId, username, email, avatar } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user already exists by email
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      // Link Clerk ID if not already linked
      if (clerkId && !existing.clerkId) {
        const updated = await db.user.update({
          where: { email },
          data: { clerkId },
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json(existing);
    }

    // Ensure unique username
    let uniqueUsername = (username || email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_');
    let counter = 1;
    while (await db.user.findUnique({ where: { username: uniqueUsername } })) {
      uniqueUsername = `${username}_${counter}`;
      counter++;
    }

    // Create new user
    const user = await db.user.create({
      data: {
        clerkId: clerkId || null,
        username: uniqueUsername,
        email,
        avatar: avatar || null,
        verificationStatus: 'email_verified',
        trustScore: 0,
        ratingAverage: 0,
        totalReviews: 0,
        role: 'user',
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
  }
}
