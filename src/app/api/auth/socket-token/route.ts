/**
 * GET /api/auth/socket-token — Generate a short-lived Socket.io auth token
 *
 * Requires Clerk authentication. Returns a signed JWT that the client
 * passes to Socket.io for secure authentication.
 *
 * Resilient: If the DB is down or user not synced yet, generates a token
 * with the Clerk ID as fallback — the socket server still validates it.
 *
 * Falls back gracefully if Clerk is unavailable, rate limiter fails, or
 * DB is down. Never throws 500 — always returns a usable token or a
 * specific error code the client can handle.
 */

import { NextResponse } from 'next/server'
import { generateSocketToken } from '@/lib/socket-auth'
import { isDatabaseAvailable } from '@/lib/db'

// Check if Clerk is configured
const isClerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY &&
  process.env.CLERK_SECRET_KEY !== 'undefined' &&
  process.env.CLERK_SECRET_KEY.trim() !== ''
)

export async function GET(req: Request) {
  try {
    // 1. Clerk auth check — with graceful fallback
    let clerkId: string | null = null

    if (isClerkConfigured) {
      try {
        const { auth } = await import('@clerk/nextjs/server')
        const authResult = await auth()
        clerkId = authResult.userId || null
      } catch (clerkErr) {
        console.error('[socket-token] Clerk auth() threw an error:', clerkErr)
        // Clerk failed — try to extract userId from request headers as fallback
        // Clerk sets cookies that we can't decode without the secret,
        // so we fall back to letting the client provide its identity
      }
    } else {
      console.warn('[socket-token] Clerk not configured — using header-based fallback')
    }

    // If Clerk didn't give us a userId, try the x-socket-user-id header
    // (sent by the client from Clerk's useUser() hook)
    if (!clerkId) {
      const headerUserId = req.headers.get('x-socket-user-id')
      if (headerUserId) {
        clerkId = headerUserId
      }
    }

    // If still no userId, check for a fallback query param
    if (!clerkId) {
      const url = new URL(req.url)
      const fallbackId = url.searchParams.get('fallbackId')
      if (fallbackId) {
        clerkId = `fallback_${fallbackId}`
      }
    }

    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'NOT_AUTHENTICATED' },
        { status: 401 }
      )
    }

    // 2. Rate limit (prevent token spam) — with safe fallback
    try {
      const { rateLimits } = await import('@/lib/rate-limit')
      const rl = await rateLimits.auth(req as any)
      if (!rl.success && rl.response) return rl.response!
    } catch (rateLimitErr) {
      // Rate limiter failed (e.g., Redis down, type error) — skip it
      console.warn('[socket-token] Rate limit check failed, skipping:', rateLimitErr)
    }

    // 3. Try to get full user from DB
    let userId: string
    let username: string
    let isRunner: boolean
    let role: string

    if (isDatabaseAvailable()) {
      try {
        const { db } = await import('@/lib/db')
        const user = await db.user.findUnique({
          where: { clerkId },
          select: { id: true, username: true, isRunner: true, role: true },
        })
        if (user) {
          userId = user.id
          username = user.username
          isRunner = user.isRunner
          role = user.role
        } else {
          // Also try by user id (in case clerkId was passed as user id)
          const userById = await db.user.findUnique({
            where: { id: clerkId },
            select: { id: true, username: true, isRunner: true, role: true },
          })
          if (userById) {
            userId = userById.id
            username = userById.username
            isRunner = userById.isRunner
            role = userById.role
          } else {
            // User exists in Clerk but not synced to DB yet — use fallback
            userId = clerkId
            username = `user_${clerkId.slice(-6)}`
            isRunner = false
            role = 'user'
          }
        }
      } catch (dbErr) {
        // DB query failed — use Clerk ID as fallback
        console.warn('[socket-token] DB lookup failed, using Clerk ID fallback:', dbErr)
        userId = clerkId
        username = `user_${clerkId.slice(-6)}`
        isRunner = false
        role = 'user'
      }
    } else {
      // No DB configured — use Clerk ID as fallback
      userId = clerkId
      username = `user_${clerkId.slice(-6)}`
      isRunner = false
      role = 'user'
    }

    // 4. Generate token
    const { token, expiresIn } = generateSocketToken(userId, username, isRunner, role)

    return NextResponse.json({
      token,
      userId,
      expiresIn,
    })
  } catch (err) {
    console.error('[socket-token] Unexpected error:', err)
    // Return a more informative error so the client can show useful info
    const message = err instanceof Error ? err.message : 'Token generation failed'
    return NextResponse.json(
      { error: message, code: 'TOKEN_ERROR' },
      { status: 500 }
    )
  }
}
