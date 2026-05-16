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

function createPrismaClient() {
  // Use Turso only when valid credentials are present
  if (isValidTursoConfig()) {
    try {
      const libsql = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      })
      const adapter = new PrismaLibSQL(libsql)
      console.log('✅ Connected to Turso database')
      return new PrismaClient({ adapter })
    } catch (err) {
      console.error('❌ Failed to connect to Turso:', err)
      console.log('⚠️ Falling back to local SQLite')
    }
  } else {
    console.log('⚠️ Turso credentials not configured, using local SQLite')
  }

  // Fallback to local SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
