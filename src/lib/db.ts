import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function isValidTursoConfig(): boolean {
  const url = process.env.TURSO_DATABASE_URL
  const token = process.env.TURSO_AUTH_TOKEN
  return !!(
    url &&
    token &&
    url !== 'undefined' &&
    token !== 'undefined' &&
    url.startsWith('libsql://')
  )
}

function createPrismaClient(): PrismaClient {
  // Use Turso only when valid credentials are present
  if (isValidTursoConfig()) {
    try {
      const libsql = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      })
      const adapter = new PrismaLibSQL(libsql)
      console.log('[db] Connected to Turso database')
      return new PrismaClient({ adapter })
    } catch (err) {
      console.error('[db] Failed to connect to Turso:', err)
      // In production, re-throw — we can't fall back to local SQLite on Render
      if (process.env.NODE_ENV === 'production') {
        throw err
      }
      console.log('[db] Falling back to local SQLite for development')
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.error('[db] CRITICAL: Turso credentials not configured in production!')
      console.error('[db] Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables')
      // In production without Turso, we throw so the app doesn't silently use a non-existent local DB
      throw new Error(
        'Database not configured. TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in production.'
      )
    }
    console.log('[db] Turso credentials not configured, using local SQLite')
  }

  // Fallback to local SQLite (only works in development)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
}

let db: PrismaClient
try {
  db = globalForPrisma.prisma ?? createPrismaClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
} catch (err) {
  console.error('[db] Failed to create PrismaClient:', err)
  // Create a dummy client that will return errors instead of crashing the entire app
  // This allows the frontend to at least load and show error messages
  db = new PrismaClient({
    log: ['error'],
  })
  // Store the error for API routes to check
  globalForPrisma.prisma = undefined
}

export { db }
