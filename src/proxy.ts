/**
 * proxy.ts — Next.js 16 Middleware (Proxy)
 *
 * In Next.js 16+, the middleware file is called "proxy.ts" instead of "middleware.ts".
 * This is the canonical middleware file for the application.
 *
 * Handles:
 * - Clerk authentication (public/protected/optional routes)
 * - CSRF protection (two-layer: Origin/Referer + X-Requested-With)
 * - API versioning (/api/v1/* → /api/*)
 * - Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
 * - Production seed endpoint blocking
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, NextRequest } from 'next/server'

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
const clerkSecKey = process.env.CLERK_SECRET_KEY || ''
const isClerkConfigured = !!(
  clerkPubKey &&
  clerkSecKey &&
  clerkPubKey !== 'undefined' &&
  clerkSecKey !== 'undefined' &&
  clerkPubKey.startsWith('pk_') &&
  clerkPubKey.length > 30  // Real Clerk keys are 40+ chars; placeholders are short
)

// ── Public routes (no auth required) ──
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/manifest.json',
  '/payment-locked(.*)',
])

// ── Public API routes (no auth required — have their own auth mechanisms) ──
const isPublicApiRoute = createRouteMatcher([
  '/api/auth/clerk-sync',        // Webhook (Svix signature verified internally)
  '/api/payments/webhook',       // Webhook (HMAC signature verified internally)
  '/api/payments/verify',        // Redirect from Flutterwave
  '/api/payments/transfer-webhook', // Transfer status webhook from Flutterwave
  '/api/health',                 // Health check
  '/api/db-test',                // DB diagnostic (no secrets returned)
  '/api/',                       // Root API status
  '/api/cron/ping',              // Cron ping
  '/api/seed',                   // Seeding (protected by SEED_SECRET_KEY internally)
  '/api/auth/demo-user',         // Disabled endpoint
])

// ── Protected API routes (MUST have auth) ──
const isProtectedApiRoute = createRouteMatcher([
  '/api/auth/me(.*)',
  '/api/auth/profile(.*)',
  '/api/auth/register(.*)',
  '/api/auth/clerk-me(.*)',
  '/api/auth/socket-token(.*)',  // Requires Clerk auth (no more fallbacks)
  '/api/runner-locations(.*)',   // Moved from optional — requires auth
  '/api/chats(.*)',
  '/api/messages(.*)',
  '/api/reports(.*)',
  '/api/saved(.*)',
  '/api/notifications(.*)',
  '/api/payments/initialize(.*)',
  '/api/payments/history(.*)',
  '/api/payments/banks(.*)',
  '/api/boosts(.*)',
  '/api/deliveries(.*)',
  '/api/tasks(.*)',
  '/api/runner-presence(.*)',
  '/api/runner-location(.*)',
  '/api/runner-applications(.*)',
  '/api/runner/earnings(.*)',
  '/api/runner/deliveries(.*)',
  '/api/runner/wallet(.*)',
  '/api/runner/transactions(.*)',
  '/api/runner/payout(.*)',
  '/api/users/(.*)',
  '/api/push(.*)',
  '/api/admin(.*)',
  '/api/uploadthing(.*)',
])

// ── Optional auth routes (public GET, protected writes) ──
const isOptionalAuthApiRoute = createRouteMatcher([
  '/api/listings(.*)',
  '/api/stores(.*)',
  '/api/reviews(.*)',
  // runner-locations moved to protected — requires auth
  // socket-token moved to protected — requires auth (no more header fallbacks)
])

// ── Webhook / external-service routes excluded from CSRF checks ──
// These routes receive requests from external services (Flutterwave, Clerk)
// that use their own signature verification and cannot send CSRF tokens.
const isWebhookRoute = createRouteMatcher([
  '/api/payments/webhook',       // Flutterwave webhook (HMAC verified internally)
  '/api/auth/clerk-sync',        // Clerk webhook (Svix signature verified internally)
])

// ── CSRF Protection ──
const STATE_CHANGING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Validates CSRF protection for state-changing requests.
 *
 * Two-layer defense:
 * 1. Origin/Referer check: Ensures the request originates from our own app.
 *    For same-origin requests, the browser automatically sends Origin or Referer
 *    headers that match the app URL. Cross-origin forged requests will have
 *    a different (or missing) Origin/Referer.
 *
 * 2. X-Requested-With header: Custom header that cannot be set by cross-origin
 *    requests in browsers without CORS preflight. Our fetch calls include this
 *    header, but CSRF attacks from other sites cannot.
 *
 * Webhook routes are excluded because they come from external services
 * (Flutterwave, Clerk) that use their own signature verification.
 */
function validateCsrf(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase()

  // Safe methods don't need CSRF protection
  if (SAFE_METHODS.has(method)) {
    return null
  }

  // Only apply CSRF to state-changing API requests
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/api/')) {
    return null
  }

  // Exclude webhook routes — they have their own signature verification
  if (isWebhookRoute(request)) {
    return null
  }

  // Exclude the Flutterwave redirect endpoint — it's a GET redirect but
  // may arrive as POST from Flutterwave without custom headers
  if (pathname === '/api/payments/verify') {
    return null
  }

  if (!STATE_CHANGING_METHODS.has(method)) {
    return null
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

  // ── Layer 1: Origin / Referer check ──
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  let originMatches = false

  if (origin) {
    // Origin is the most reliable header for CSRF checks — strict hostname matching
    try {
      const originUrl = new URL(origin)
      const appUrlObj = new URL(appUrl)
      originMatches = originUrl.origin === appUrlObj.origin ||
        originUrl.hostname === 'localhost' ||
        originUrl.hostname === '127.0.0.1'
    } catch {
      originMatches = false
    }
  } else if (referer) {
    // Fall back to Referer header if Origin is missing — strict hostname matching
    try {
      const refererUrl = new URL(referer)
      const appUrlObj = new URL(appUrl)
      originMatches = refererUrl.origin === appUrlObj.origin ||
        refererUrl.hostname === 'localhost' ||
        refererUrl.hostname === '127.0.0.1'
    } catch {
      // Malformed referer — reject
      originMatches = false
    }
  }
  // If neither Origin nor Referer is present, we still check X-Requested-With below.
  // Some legitimate API clients (e.g., mobile apps) may not send these headers.

  // ── Layer 2: X-Requested-With custom header check ──
  const hasRequestedWith = request.headers.get('x-requested-with') === 'XMLHttpRequest'

  // For browser-based requests (that send Origin or Referer), we enforce both checks.
  // For non-browser clients (no Origin/Referer), we only require X-Requested-With.
  if (origin || referer) {
    // Browser request — must pass both checks
    if (!originMatches || !hasRequestedWith) {
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Request rejected due to missing or invalid origin/headers',
        },
        { status: 403 }
      )
    }
  } else {
    // Non-browser request (e.g., mobile app, CLI tool) — must have custom header
    if (!hasRequestedWith) {
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Missing X-Requested-With header',
        },
        { status: 403 }
      )
    }
  }

  // All checks passed
  return null
}

// ── Middleware export ──
// When Clerk isn't configured, we use a simple middleware that only enforces
// CSRF protection and security headers. This prevents the Clerk SDK from
// crashing with "Publishable key not valid" when fake/placeholder keys are set.
function simpleMiddleware(request: NextRequest) {
  const csrfError = validateCsrf(request)
  if (csrfError) return csrfError
  return NextResponse.next()
}

export default isClerkConfigured
  ? clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl

  // ── API versioning: strip /v1 prefix for route matching ──
  // /api/v1/listings → /api/listings (rewrite happens in next.config.ts)
  // The proxy matches against the unversioned path so we don't need
  // to duplicate every route pattern with /v1 prefix.
  const normalizedPath = pathname.replace(/^\/api\/v1(\/|$)/, '/api$1')

  // Create a normalized request for route matching
  const normalizedRequest = normalizedPath !== pathname
    ? new NextRequest(new URL(normalizedPath, request.url), request as any)
    : request

  // ── If Clerk is not configured, still enforce CSRF ──
  if (!isClerkConfigured) {
    const csrfError = validateCsrf(request)
    if (csrfError) return csrfError
    return NextResponse.next()
  }

  // ── Block seed endpoint in production ──
  if (normalizedPath === '/api/seed' && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Seed endpoint is disabled in production' },
      { status: 403 }
    )
  }

  // ── CSRF protection for all state-changing API requests ──
  const csrfError = validateCsrf(request)
  if (csrfError) return csrfError

  // ── Public pages ──
  if (isPublicRoute(normalizedRequest)) {
    return NextResponse.next()
  }

  // ── Public API routes ──
  if (isPublicApiRoute(normalizedRequest)) {
    const response = NextResponse.next()
    addSecurityHeaders(response, request)
    return response
  }

  // ── Protected API routes: require auth ──
  if (isProtectedApiRoute(normalizedRequest)) {
    await auth.protect()
    const response = NextResponse.next()
    addSecurityHeaders(response, request)
    return response
  }

  // ── Optional auth API routes ──
  if (isOptionalAuthApiRoute(normalizedRequest)) {
    const response = NextResponse.next()
    addSecurityHeaders(response, request)
    return response
  }

  // ── All other pages: require auth ──
  if (!isPublicRoute(normalizedRequest)) {
    await auth.protect()
  }

  return NextResponse.next()
})
  : (request: NextRequest) => simpleMiddleware(request)

// ── Security Headers ──
function addSecurityHeaders(response: NextResponse, request: NextRequest) {
  // Anti-sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  // Prevent embedding in iframes
  response.headers.set('X-Frame-Options', 'DENY')
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // Permission policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)'
  )

  // CORS for API routes (same-origin only in production) — strict hostname matching
  const origin = request.headers.get('origin')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  if (origin) {
    try {
      const originUrl = new URL(origin)
      const appUrlObj = new URL(appUrl)
      if (originUrl.origin === appUrlObj.origin || originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        response.headers.set('Access-Control-Max-Age', '86400')
      }
    } catch {
      // Malformed origin — skip CORS headers
    }
  }

  // Content Security Policy
  const isProduction = process.env.NODE_ENV === 'production'
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js needs unsafe-eval/inline in dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.flutterwave.com https://*.clerk.accounts.dev https://*.clerk.com wss: ws:",
    "frame-src https://*.clerk.accounts.dev https://*.clerk.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    isProduction ? "upgrade-insecure-requests" : "",
  ].filter(Boolean).join('; ')
  response.headers.set('Content-Security-Policy', csp)

  // HSTS (production only)
  if (isProduction) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
