import { db, isDatabaseAvailable } from '@/lib/db';
import { NextResponse } from 'next/server';
import { findUserProfileByClerkId, findUserProfileByEmail, findUserProfileById } from '@/lib/user-profile';

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const clerkSecKey = process.env.CLERK_SECRET_KEY || '';
const isClerkConfigured = !!(
  clerkPubKey && clerkSecKey &&
  clerkPubKey !== 'undefined' && clerkSecKey !== 'undefined' &&
  !clerkPubKey.includes('your_key') && !clerkSecKey.includes('your_key') &&
  clerkPubKey.startsWith('pk_')
);

export async function GET() {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  if (!isClerkConfigured) {
    return NextResponse.json({ error: 'Clerk not configured' }, { status: 503 });
  }

  try {
    const { auth, currentUser } = await import('@clerk/nextjs/server');
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find user by clerkId
    let user = await findUserProfileByClerkId(userId);

    if (user) return NextResponse.json(user);

    // Auto-create: get Clerk profile
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Clerk user not found' }, { status: 404 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress || '';
    const baseUsername = (
      clerkUser.username || clerkUser.firstName || email.split('@')[0] || 'user'
    ).replace(/[^a-zA-Z0-9_]/g, '_');

    // Check if email already exists (link existing user)
    const existingByEmail = email ? await db.user.findUnique({ where: { email } }) : null;
    if (existingByEmail) {
      await db.user.update({
        where: { email },
        data: { clerkId: userId, avatar: clerkUser.imageUrl || existingByEmail.avatar },
      });
      user = await findUserProfileByEmail(email);
      return NextResponse.json(user);
    }

    // Ensure unique username
    let uniqueUsername = baseUsername;
    let counter = 1;
    while (await db.user.findUnique({ where: { username: uniqueUsername } })) {
      uniqueUsername = `${baseUsername}_${counter}`;
      counter++;
    }

    // Create new user
    const createdUser = await db.user.create({
      data: {
        clerkId: userId,
        username: uniqueUsername,
        email,
        avatar: clerkUser.imageUrl || null,
        verificationStatus: 'email_verified',
        trustScore: 0, ratingAverage: 0, totalReviews: 0, role: 'user',
      },
    });
    user = await findUserProfileById(createdUser.id);

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error in clerk-me:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
