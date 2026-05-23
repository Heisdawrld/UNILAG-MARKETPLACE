/**
 * socket-auth.ts — Secure Socket.io authentication
 *
 * Problem: The old Socket.io auth trusted a raw `userId` string from the client.
 * Attackers could impersonate any user by setting any userId.
 *
 * Solution: Generate a short-lived, signed token via our API.
 * The client calls `/api/auth/socket-token` (which requires Clerk auth)
 * and gets a signed JWT. Socket.io verifies this JWT instead of trusting
 * a raw userId string.
 *
 * Flow:
 * 1. Client calls GET /api/auth/socket-token (Clerk-authenticated)
 * 2. Server returns { token, userId, expiresIn }
 * 3. Client passes token in socket.auth.token on connect
 * 4. Socket.io middleware verifies the token and extracts userId
 */

import crypto from 'crypto'

// ── Token Configuration ──
const TOKEN_EXPIRY_SECONDS = 300 // 5 minutes
const TOKEN_PREFIX = 'ULM_SKT_'

// ── Get signing secret ──
function getSigningSecret(): string {
  const secret = process.env.SOCKET_TOKEN_SECRET
  if (secret && secret.trim() !== '') return secret

  // Development-only fallback
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[socket-auth] Using dev-fallback-secret. Set SOCKET_TOKEN_SECRET in production.')
    return 'dev-fallback-secret'
  }

  // Production: MUST have SOCKET_TOKEN_SECRET set (auto-generated on Render)
  throw new Error(
    '[socket-auth] FATAL: SOCKET_TOKEN_SECRET is not set in production. ' +
    'Set it in your Render environment variables or use the generateValue feature in render.yaml.'
  )
}

// ── Token Payload ──
interface SocketTokenPayload {
  userId: string
  username: string
  isRunner: boolean
  role: string
  iat: number  // issued at
  exp: number  // expires at
  jti: string  // unique token ID (for revocation if needed)
}

// ── Generate a signed token ──
export function generateSocketToken(
  userId: string,
  username: string,
  isRunner: boolean,
  role: string
): { token: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000)
  const jti = crypto.randomBytes(16).toString('hex')

  const payload: SocketTokenPayload = {
    userId,
    username,
    isRunner,
    role,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
    jti,
  }

  // Encode payload
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')

  // Sign with HMAC-SHA256
  const secret = getSigningSecret()
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url')

  return {
    token: `${TOKEN_PREFIX}${payloadB64}.${signature}`,
    expiresIn: TOKEN_EXPIRY_SECONDS,
  }
}

// ── Verify a signed token ──
export interface VerifyResult {
  valid: boolean
  payload: SocketTokenPayload | null
  error?: string
}

export function verifySocketToken(token: string): VerifyResult {
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    return { valid: false, payload: null, error: 'Invalid token format' }
  }

  const body = token.slice(TOKEN_PREFIX.length)
  const parts = body.split('.')

  if (parts.length !== 2) {
    return { valid: false, payload: null, error: 'Invalid token structure' }
  }

  const [payloadB64, signature] = parts

  // Verify signature
  const secret = getSigningSecret()
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url')

  try {
    const sigBuf = Buffer.from(signature, 'base64url')
    const expectedBuf = Buffer.from(expectedSignature, 'base64url')
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, payload: null, error: 'Invalid token signature' }
    }
  } catch {
    return { valid: false, payload: null, error: 'Signature verification failed' }
  }

  // Decode payload
  try {
    const payload: SocketTokenPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    )

    // Check expiry
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return { valid: false, payload: null, error: 'Token expired' }
    }

    // Validate required fields
    if (!payload.userId || !payload.username) {
      return { valid: false, payload: null, error: 'Invalid token payload' }
    }

    return { valid: true, payload }
  } catch {
    return { valid: false, payload: null, error: 'Token decode failed' }
  }
}
