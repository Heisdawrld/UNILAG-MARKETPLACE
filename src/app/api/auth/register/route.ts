import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { findUserProfileByEmail, findUserProfileById } from '@/lib/user-profile';

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
        const profile = await findUserProfileById(updated.id);
        return NextResponse.json(profile ?? updated);
      }
      const profile = await findUserProfileByEmail(email);
      return NextResponse.json(profile ?? existing);
    }

    // Ensure unique username
    let uniqueUsername = (username || email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_');
    let counter = 1;
    while (await db.user.findUnique({ where: { username: uniqueUsername } })) {
      uniqueUsername = `${(username || email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g, '_')}_${counter}`;
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

    const profile = await findUserProfileById(user.id);
    return NextResponse.json(profile ?? user, { status: 201 });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
  }
}
