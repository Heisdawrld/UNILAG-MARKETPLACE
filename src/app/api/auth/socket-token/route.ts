/**
 * GET /api/auth/socket-token — Generate a short-lived Socket.io auth token
 *
 * Requires Clerk authentication. Returns a signed JWT that the client
 * passes to Socket.io for secure authentication.
 *
 * Resilient: If the DB is down or user not synced yet, generates a token
 * with the Clerk ID as fallback — the socket server still validates it.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { generateSocketToken } from '@/lib/socket-auth'
import { isDatabaseAvailable } from '@/lib/db'
import { rateLimits } from '@/lib/rate-limit'

export async function GET(req: Request) {
  try {
    // 1. Clerk auth check
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'NOT_AUTHENTICATED' },
        { status: 401 }
      )
    }

    // 2. Rate limit (prevent token spam)
    const rl = await rateLimits.auth(req as any)
    if (!rl.success) return rl.response!

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
          // User exists in Clerk but not synced to DB yet — use fallback
          userId = clerkId
          username = `user_${clerkId.slice(-6)}`
          isRunner = false
          role = 'user'
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
    return NextResponse.json(
      { error: 'Token generation failed', code: 'TOKEN_ERROR' },
      { status: 500 }
    )
  }
}
