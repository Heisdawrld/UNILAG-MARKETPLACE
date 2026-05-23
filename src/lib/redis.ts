/**
 * redis.ts — Upstash Redis Client
 *
 * Graceful degradation pattern (same as db.ts):
 * - If UPSTASH_REDIS_REST_URL is set, connect to Upstash
 * - If not, the app still starts but Redis features are disabled
 * - All Redis helpers check isRedisAvailable() before calling
 */

import { Redis } from '@upstash/redis'
import { logger } from './utils'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token || url.trim() === '' || token.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[redis] No Upstash Redis credentials found — real-time features disabled')
    } else {
      logger.log('[redis] No Upstash credentials — running without real-time features')
    }
    return null
  }

  try {
    const client = new Redis({ url, token })
    logger.log('[redis] Connected to Upstash Redis')
    return client
  } catch (err) {
    console.error('[redis] Failed to create Upstash client:', err)
    return null
  }
}

let _redis: Redis | null | undefined = undefined

function getRedis(): Redis | null {
  if (_redis === undefined) {
    _redis = globalForRedis.redis ?? createRedisClient()
    if (process.env.NODE_ENV !== 'production' && _redis) {
      globalForRedis.redis = _redis
    }
  }
  return _redis
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop: string | symbol) {
    const client = getRedis()
    if (!client) {
      return (..._args: unknown[]) => {
        // Silently fail — Redis is optional
        return null
      }
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})

export function isRedisAvailable(): boolean {
  return getRedis() !== null
}
