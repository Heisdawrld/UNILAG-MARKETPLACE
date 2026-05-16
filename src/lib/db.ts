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
 * Create a PrismaClient connected to Turso (production) or local SQLite (dev).
 */
function createPrismaClient(): PrismaClient {
  // ── Try Turso first (works in both production and development) ──
  if (isValidTursoConfig()) {
    try {
      // IMPORTANT: Pass config object to PrismaLibSQL, NOT a createClient() instance.
      // The adapter creates its own libsql client internally.
      // Also set DATABASE_URL to the Turso URL for Prisma's internal validation.
      const originalDbUrl = process.env.DATABASE_URL
      process.env.DATABASE_URL = process.env.TURSO_DATABASE_URL

      const adapter = new PrismaLibSQL({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      })

      // Restore original DATABASE_URL after adapter creation
      if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl

      console.log('[db] ✅ Connected to Turso database')
      return new PrismaClient({ adapter })
    } catch (err) {
      console.error('[db] ❌ Failed to connect to Turso:', err)
      if (process.env.NODE_ENV === 'production') {
        console.error('[db] ⚠️  Database unavailable — API routes will return errors')
      } else {
        console.log('[db] Falling back to local SQLite for development')
      }
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.error('[db] ❌ CRITICAL: Turso credentials not configured in production!')
      console.error('[db] ⚠️  API routes will return errors until TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set')
    } else {
      console.log('[db] ℹ️  Turso not configured, using local SQLite')
    }
  }

  // ── Fallback: local SQLite (development only) ──
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })
}

// Create the client — using the global cache to prevent connection leaks in dev
export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
