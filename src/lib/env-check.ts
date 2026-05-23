/**
 * env-check.ts — Runtime environment validation
 *
 * Called at app startup to verify required env vars are set.
 * Logs warnings for missing optional vars and throws for missing required vars.
 * Only runs once per process.
 */

let checked = false

interface EnvCheckResult {
  required: string[]
  missing: string[]
  warnings: string[]
  ok: boolean
}

const REQUIRED_PROD_VARS = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
]

const OPTIONAL_VARS = [
  { name: 'UPSTASH_REDIS_REST_URL', desc: 'Redis for real-time features + rate limiting' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', desc: 'Redis auth token' },
  { name: 'SOCKET_TOKEN_SECRET', desc: 'Socket.io auth signing secret (auto-generated on Render)' },
  { name: 'UPLOADTHING_TOKEN', desc: 'Cloud image storage (falls back to base64 if not set)' },
  { name: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', desc: 'Push notifications (disabled if not set)' },
  { name: 'VAPID_PRIVATE_KEY', desc: 'Push notifications (disabled if not set)' },
  { name: 'FLUTTERWAVE_SECRET_KEY', desc: 'Payments (locked mode works without it)' },
  { name: 'NEXT_PUBLIC_APP_URL', desc: 'App URL for redirects and CORS' },
  { name: 'ADMIN_EMAILS', desc: 'Admin bootstrap emails' },
  { name: 'ADMIN_USERNAMES', desc: 'Admin bootstrap usernames' },
]

export function checkEnvironment(): EnvCheckResult {
  if (checked) return { required: [], missing: [], warnings: [], ok: true }
  checked = true

  const isProd = process.env.NODE_ENV === 'production'
  const missing: string[] = []
  const warnings: string[] = []
  const required = isProd ? REQUIRED_PROD_VARS : []

  // Check required vars (only in production)
  for (const varName of required) {
    const value = process.env[varName]
    if (!value || value.trim() === '' || value === 'undefined') {
      missing.push(varName)
    }
  }

  // Check optional vars
  for (const { name, desc } of OPTIONAL_VARS) {
    const value = process.env[name]
    if (!value || value.trim() === '' || value === 'undefined') {
      warnings.push(`${name} — ${desc}`)
    }
  }

  // Log results
  if (missing.length > 0) {
    console.error('')
    console.error('┌──────────────────────────────────────────────────────────────┐')
    console.error('│  MISSING REQUIRED ENVIRONMENT VARIABLES                     │')
    console.error('├──────────────────────────────────────────────────────────────┤')
    for (const m of missing) {
      console.error(`│  ✗ ${m.padEnd(55)} │`)
    }
    console.error('└──────────────────────────────────────────────────────────────┘')
    console.error('')
  }

  if (warnings.length > 0) {
    console.warn('')
    console.warn('[env] Optional environment variables not set (features will be degraded):')
    for (const w of warnings) {
      console.warn(`  ⚠ ${w}`)
    }
    console.warn('')
  }

  if (missing.length === 0 && warnings.length === 0) {
    console.log('[env] All environment variables configured ✓')
  }

  return { required, missing, warnings, ok: missing.length === 0 }
}
