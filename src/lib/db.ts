import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Check if Turso credentials are valid and present.
 */
function isValidTursoConfig(): boolean {
  const url = process.env.TURSO_DATABASE_URL
  const token = process.env.TURSO_AUTH_TOKEN
  return !!(
    url &&
    token &&
    url !== 'undefined' &&
    token !== 'undefined' &&
    url.trim() !== '' &&
    token.trim() !== '' &&
    url.startsWith('libsql://')
  )
}

/**
 * Check if any valid DATABASE_URL is available (for SQLite fallback).
 */
function isValidDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL
  return !!(
    url &&
    url !== 'undefined' &&
    url.trim() !== '' &&
    (url.startsWith('file:') || url.startsWith('libsql://'))
  )
}

/**
 * Create a PrismaClient connected to Turso (production) or local SQLite (dev).
 * Returns null if no database is configured — the app will still start but
 * API routes will return graceful errors.
 */
function createPrismaClient(): PrismaClient | null {
  // ── Try Turso first (works in both production and development) ──
  if (isValidTursoConfig()) {
    try {
      const adapter = new PrismaLibSQL({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      })

      console.log('[db] Connected to Turso database')
      return new PrismaClient({ adapter })
    } catch (err) {
      console.error('[db] Failed to connect to Turso:', err)
      // Don't throw — fall through to SQLite or null
    }
  }

  // ── Fallback: local SQLite (development only) ──
  if (isValidDatabaseUrl()) {
    try {
      console.log('[db] Using database at:', process.env.DATABASE_URL!.substring(0, 30) + '...')
      return new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
      })
    } catch (err) {
      console.error('[db] Failed to create PrismaClient with DATABASE_URL:', err)
    }
  }

  // ── No database configured at all ──
  if (process.env.NODE_ENV === 'production') {
    console.error('[db] CRITICAL: No database configured in production!')
    console.error('[db] Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your Render dashboard')
  } else {
    console.log('[db] No database configured — app will start but API routes will return errors')
  }

  return null
}

// Lazy initialization: don't create the client until first access
let _db: PrismaClient | null | undefined = undefined

function getDb(): PrismaClient | null {
  if (_db === undefined) {
    _db = globalForPrisma.prisma ?? createPrismaClient()
    if (process.env.NODE_ENV !== 'production' && _db) {
      globalForPrisma.prisma = _db
    }
  }
  return _db
}

/**
 * The database client. Returns null if no database is configured.
 * API routes should check for null and return a graceful error.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getDb()
    if (!client) {
      // Return a function that throws a helpful error when called
      return (..._args: unknown[]) => {
        throw new Error(
          'Database not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.'
        )
      }
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})

/**
 * Check if the database is available and connected.
 */
export function isDatabaseAvailable(): boolean {
  return getDb() !== null
}
