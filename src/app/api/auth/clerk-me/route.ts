import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Check if Clerk is configured
const isClerkConfigured = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'undefined' &&
  process.env.CLERK_SECRET_KEY !== 'undefined'
);

export async function GET() {
  if (!isClerkConfigured) {
    return NextResponse.json(
      { error: 'Clerk authentication is not configured', configured: false },
      { status: 503 }
    );
  }

  try {
    const { auth, currentUser } = await import('@clerk/nextjs/server');
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Find user in our database by clerkId
    let user = await db.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        faculty: true,
        department: true,
        level: true,
        bio: true,
        phone: true,
        whatsapp: true,
        hostel: true,
        verificationStatus: true,
        trustScore: true,
        ratingAverage: true,
        totalReviews: true,
        role: true,
        clerkId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If user doesn't exist in our DB yet, auto-create them
    if (!user) {
      const clerkUser = await currentUser();

      if (!clerkUser) {
        return NextResponse.json(
          { error: 'Clerk user not found' },
          { status: 404 }
        );
      }

      const email = clerkUser.emailAddresses[0]?.emailAddress || '';
      const username = (
        clerkUser.username ||
        clerkUser.firstName ||
        email.split('@')[0] ||
        'user'
      ).replace(/[^a-zA-Z0-9_]/g, '_');

      // Ensure unique username
      let uniqueUsername = username;
      let counter = 1;
      while (await db.user.findUnique({ where: { username: uniqueUsername } })) {
        uniqueUsername = `${username}_${counter}`;
        counter++;
      }

      // Ensure unique email
      const existingByEmail = await db.user.findUnique({ where: { email } });
      if (existingByEmail) {
        // Link existing user to Clerk
        user = await db.user.update({
          where: { email },
          data: { clerkId: userId },
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            faculty: true,
            department: true,
            level: true,
            bio: true,
            phone: true,
            whatsapp: true,
            hostel: true,
            verificationStatus: true,
            trustScore: true,
            ratingAverage: true,
            totalReviews: true,
            role: true,
            clerkId: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      } else {
        user = await db.user.create({
          data: {
            clerkId: userId,
            username: uniqueUsername,
            email,
            avatar: clerkUser.imageUrl,
            verificationStatus: 'email_verified',
            trustScore: 0,
            ratingAverage: 0,
            totalReviews: 0,
            role: 'user',
          },
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            faculty: true,
            department: true,
            level: true,
            bio: true,
            phone: true,
            whatsapp: true,
            hostel: true,
            verificationStatus: true,
            trustScore: true,
            ratingAverage: true,
            totalReviews: true,
            role: true,
            clerkId: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching Clerk user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
