import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

/**
 * Get the current authenticated user from Clerk and sync with our database.
 * Returns null if not authenticated.
 * Auto-creates a user in our DB if they exist in Clerk but not in our database.
 */
export async function getCurrentUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  // Find user in our DB by clerkId
  let user = await db.user.findUnique({
    where: { clerkId: clerkUser.id },
  });

  if (!user) {
    // Auto-create user if they exist in Clerk but not our DB
    const email = clerkUser.emailAddresses[0]?.emailAddress || '';

    // Check if a user with this email already exists
    const existingByEmail = await db.user.findUnique({
      where: { email },
    });

    if (existingByEmail) {
      // Link existing user to Clerk
      user = await db.user.update({
        where: { email },
        data: {
          clerkId: clerkUser.id,
          avatar: clerkUser.imageUrl || existingByEmail.avatar,
          verificationStatus: 'email_verified',
        },
      });
    } else {
      // Create new user
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

      user = await db.user.create({
        data: {
          clerkId: clerkUser.id,
          username: uniqueUsername,
          email,
          avatar: clerkUser.imageUrl,
          verificationStatus: 'email_verified', // Clerk verifies email
          trustScore: 0,
          ratingAverage: 0,
          totalReviews: 0,
          role: 'user',
        },
      });
    }
  }

  return user;
}

/**
 * Require authentication. Returns the Clerk user ID if authenticated.
 * Throws an error if not authenticated.
 */
export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

/**
 * Get the Clerk user ID if authenticated, or null if not.
 */
export async function getOptionalAuth() {
  const { userId } = await auth();
  return userId;
}
