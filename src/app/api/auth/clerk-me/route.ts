import { db, isDatabaseAvailable } from '@/lib/db';
import { NextResponse } from 'next/server';

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const clerkSecKey = process.env.CLERK_SECRET_KEY || '';
const isClerkConfigured = !!(
  clerkPubKey && clerkSecKey &&
  clerkPubKey !== 'undefined' && clerkSecKey !== 'undefined' &&
  !clerkPubKey.includes('your_key') && !clerkSecKey.includes('your_key') &&
  clerkPubKey.startsWith('pk_')
);

const USER_SELECT = {
  id: true, username: true, email: true, avatar: true,
  faculty: true, department: true, level: true, bio: true,
  phone: true, whatsapp: true, hostel: true,
  verificationStatus: true, trustScore: true,
  ratingAverage: true, totalReviews: true, role: true,
  isRunner: true, runnerRating: true, tasksCompleted: true,
  clerkId: true, createdAt: true, updatedAt: true,
} as const;

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
    let user = await db.user.findUnique({
      where: { clerkId: userId },
      select: USER_SELECT,
    });

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
      user = await db.user.update({
        where: { email },
        data: { clerkId: userId, avatar: clerkUser.imageUrl || existingByEmail.avatar },
        select: USER_SELECT,
      });
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
    user = await db.user.create({
      data: {
        clerkId: userId,
        username: uniqueUsername,
        email,
        avatar: clerkUser.imageUrl || null,
        verificationStatus: 'email_verified',
        trustScore: 0, ratingAverage: 0, totalReviews: 0, role: 'user',
      },
      select: USER_SELECT,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error in clerk-me:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
