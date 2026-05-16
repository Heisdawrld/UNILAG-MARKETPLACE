import { db } from '@/lib/db';

// Check if Clerk is configured
const isClerkConfigured = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'undefined' &&
  process.env.CLERK_SECRET_KEY !== 'undefined'
);

/**
 * Get the current authenticated user from Clerk and sync with our database.
 * Returns null if not authenticated or if Clerk is not configured.
 * Auto-creates a user in our DB if they exist in Clerk but not in our database.
 */
export async function getCurrentUser() {
  if (!isClerkConfigured) {
    console.log('[auth] Clerk not configured, skipping getCurrentUser');
    return null;
  }

  try {
    const { auth, currentUser } = await import('@clerk/nextjs/server');
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
  } catch (err) {
    console.error('[auth] Error in getCurrentUser:', err);
    return null;
  }
}

/**
 * Require authentication. Returns the Clerk user ID if authenticated.
 * Throws an error if not authenticated or if Clerk is not configured.
 */
export async function requireAuth() {
  if (!isClerkConfigured) {
    throw new Error('Authentication is not configured. Clerk keys are missing.');
  }

  try {
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');
    return userId;
  } catch (err) {
    console.error('[auth] Error in requireAuth:', err);
    throw err;
  }
}

/**
 * Get the Clerk user ID if authenticated, or null if not.
 */
export async function getOptionalAuth() {
  if (!isClerkConfigured) {
    return null;
  }

  try {
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    return userId;
  } catch (err) {
    console.error('[auth] Error in getOptionalAuth:', err);
    return null;
  }
}

/**
 * Check if Clerk authentication is configured and available.
 */
export function isAuthConfigured(): boolean {
  return isClerkConfigured;
}
