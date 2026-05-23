/**
 * rate-limit.ts — Lightweight rate limiting using Upstash Redis
 * 
 * Sliding window rate limiter with graceful degradation:
 * - If Redis is available → proper distributed rate limiting
 * - If Redis is unavailable → in-memory fallback (single-instance only)
 * 
 * Usage in API routes:
 *   const rateLimitResult = await rateLimit(request, { window: 60, max: 30 })
 *   if (!rateLimitResult.success) return rateLimitResult.response!
 */

import { NextRequest, NextResponse } from 'next/server'
import { isRedisAvailable, redis } from './redis'

// ── In-memory fallback ──
const memoryStore = new Map<string, { count: number; resetAt: number }>()

// Cleanup old entries every 60s
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of memoryStore) {
    if (now > val.resetAt) memoryStore.delete(key)
  }
}, 60000)

// ── Config ──
interface RateLimitOptions {
  /** Time window in seconds (default: 60) */
  window?: number
  /** Max requests per window (default: 30) */
  max?: number
  /** Custom key prefix (default: 'rl') */
  prefix?: string
  /** Key extraction function (default: IP from request) */
  keyFn?: (req: NextRequest) => string
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  response?: NextResponse
}

function getClientKey(req: NextRequest): string {
  // Try various headers for the real IP
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const cfIp = req.headers.get('cf-connecting-ip')
  
  if (cfIp) return cfIp
  if (realIp) return realIp
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const {
    window: windowSeconds = 60,
    max = 30,
    prefix = 'rl',
    keyFn = getClientKey,
  } = options

  const clientKey = keyFn(req)
  const key = `${prefix}:${clientKey}`
  const now = Date.now()
  const resetAt = now + windowSeconds * 1000

  // ── Redis-based rate limiting ──
  if (isRedisAvailable() && redis) {
    try {
      const current = await redis.incr(key)
      if (current === 1) {
        await redis.expire(key, windowSeconds)
      }
      const ttl = await redis.ttl(key)
      const remaining = Math.max(0, max - current)

      if (current > max) {
        return {
          success: false,
          remaining: 0,
          resetAt: now + (ttl > 0 ? ttl : windowSeconds) * 1000,
          response: NextResponse.json(
            { error: 'Too many requests. Please try again later.', retryAfter: ttl > 0 ? ttl : windowSeconds },
            { status: 429, headers: { 'Retry-After': String(ttl > 0 ? ttl : windowSeconds) } }
          ),
        }
      }

      return { success: true, remaining, resetAt: now + (ttl > 0 ? ttl : windowSeconds) * 1000 }
    } catch {
      // Fall through to in-memory
    }
  }

  // ── In-memory fallback ──
  const entry = memoryStore.get(key)
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt })
    return { success: true, remaining: max - 1, resetAt }
  }

  entry.count++
  const remaining = Math.max(0, max - entry.count)

  if (entry.count > max) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      response: NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: Math.ceil((entry.resetAt - now) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } }
      ),
    }
  }

  return { success: true, remaining, resetAt: entry.resetAt }
}

// ── Preset rate limiters ──
export const rateLimits = {
  /** General API: 30 req/min */
  standard: (req: NextRequest) => rateLimit(req, { window: 60, max: 30, prefix: 'std' }),
  
  /** Auth endpoints: 5 req/min */
  auth: (req: NextRequest) => rateLimit(req, { window: 60, max: 5, prefix: 'auth' }),
  
  /** Write operations: 10 req/min */
  write: (req: NextRequest) => rateLimit(req, { window: 60, max: 10, prefix: 'write' }),
  
  /** Delivery creation: 5 req/min */
  delivery: (req: NextRequest) => rateLimit(req, { window: 60, max: 5, prefix: 'delivery' }),
  
  /** Search: 20 req/min */
  search: (req: NextRequest) => rateLimit(req, { window: 60, max: 20, prefix: 'search' }),
}
