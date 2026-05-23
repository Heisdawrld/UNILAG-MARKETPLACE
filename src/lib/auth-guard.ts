/**
 * auth-guard.ts — Centralized authentication & authorization for API routes
 *
 * Provides reusable guards that combine Clerk auth verification with DB user lookup.
 * Every protected API route should use these instead of calling `auth()` directly.
 *
 * Usage:
 *   const { userId, user } = await requireAuth()
 *   if (!userId) return authResponse!
 *   // ... user is guaranteed to exist and be authenticated
 */

import { auth } from '@clerk/nextjs/server'
import { db, isDatabaseAvailable } from './db'
import { NextResponse } from 'next/server'

// ── Types ──

interface AuthResult {
  /** Clerk user ID (null if not authenticated) */
  clerkId: string | null
  /** Database user ID */
  userId: string | null
  /** Full user record from DB */
  user: {
    id: string
    clerkId: string | null
    email: string
    username: string
    role: string
    isRunner: boolean
    verificationStatus: string
    trustScore: number
  } | null
  /** If auth failed, this is the error response to return */
  errorResponse?: NextResponse
}

/**
 * Require authentication — verifies Clerk session AND loads user from DB
 *
 * Returns { clerkId, userId, user } on success
 * Returns { clerkId: null, userId: null, user: null, errorResponse } on failure
 *
 * Usage:
 *   const { userId, user, errorResponse } = await requireAuth()
 *   if (errorResponse) return errorResponse
 */
export async function requireAuth(): Promise<AuthResult> {
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    return {
      clerkId: null,
      userId: null,
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  if (!isDatabaseAvailable()) {
    return {
      clerkId,
      userId: null,
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      ),
    }
  }

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        username: true,
        role: true,
        isRunner: true,
        verificationStatus: true,
        trustScore: true,
      },
    })

    if (!user) {
      return {
        clerkId,
        userId: null,
        user: null,
        errorResponse: NextResponse.json(
          { error: 'User profile not found. Please complete registration.' },
          { status: 404 }
        ),
      }
    }

    return { clerkId, userId: user.id, user }
  } catch (error) {
    console.error('[auth-guard] DB lookup failed:', error)
    return {
      clerkId,
      userId: null,
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Authentication verification failed' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Require authentication AND ownership — verifies that the authenticated user
 * matches the requested resource owner ID
 *
 * Usage:
 *   const { user, errorResponse } = await requireOwnership(requestedUserId)
 *   if (errorResponse) return errorResponse
 */
export async function requireOwnership(targetUserId: string): Promise<AuthResult> {
  const result = await requireAuth()

  if (result.errorResponse) return result

  // Allow admins to access any user's resources
  if (result.user?.role === 'admin') return result

  if (result.userId !== targetUserId) {
    return {
      clerkId: result.clerkId,
      userId: result.userId,
      user: result.user,
      errorResponse: NextResponse.json(
        { error: 'You can only access your own resources' },
        { status: 403 }
      ),
    }
  }

  return result
}

/**
 * Require runner role — verifies the authenticated user is a registered runner
 *
 * Usage:
 *   const { user, errorResponse } = await requireRunner()
 *   if (errorResponse) return errorResponse
 */
export async function requireRunner(): Promise<AuthResult> {
  const result = await requireAuth()

  if (result.errorResponse) return result

  if (!result.user?.isRunner) {
    return {
      clerkId: result.clerkId,
      userId: result.userId,
      user: result.user,
      errorResponse: NextResponse.json(
        { error: 'Runner access required' },
        { status: 403 }
      ),
    }
  }

  return result
}

/**
 * Optional auth — returns user info if authenticated, null if not
 * Used for public endpoints that behave differently for authenticated users
 *
 * Usage:
 *   const { userId, user } = await optionalAuth()
 *   // userId may be null — that's fine for public endpoints
 */
export async function optionalAuth(): Promise<Omit<AuthResult, 'errorResponse'>> {
  const { userId: clerkId } = await auth()

  if (!clerkId || !isDatabaseAvailable()) {
    return { clerkId, userId: null, user: null }
  }

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        username: true,
        role: true,
        isRunner: true,
        verificationStatus: true,
        trustScore: true,
      },
    })

    return { clerkId, userId: user?.id ?? null, user }
  } catch {
    return { clerkId, userId: null, user: null }
  }
}
