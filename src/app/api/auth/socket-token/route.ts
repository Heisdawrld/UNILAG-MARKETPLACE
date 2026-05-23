/**
 * GET /api/auth/socket-token — Generate a short-lived Socket.io auth token
 *
 * Requires Clerk authentication. Returns a signed JWT that the client
 * passes to Socket.io for secure authentication.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { generateSocketToken } from '@/lib/socket-auth'
import { rateLimits } from '@/lib/rate-limit'

export async function GET(req: Request) {
  // 1. Auth check
  const { userId, user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // 2. Rate limit (prevent token spam)
  const rl = await rateLimits.auth(req as any)
  if (!rl.success) return rl.response!

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // 3. Generate token
  const { token, expiresIn } = generateSocketToken(
    user.id,
    user.username,
    user.isRunner,
    user.role
  )

  return NextResponse.json({
    token,
    userId: user.id,
    expiresIn,
  })
}
