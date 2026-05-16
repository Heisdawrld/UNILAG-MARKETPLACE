import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Check if Clerk is configured before importing it
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
const clerkSecret = process.env.CLERK_SECRET_KEY
const clerkConfigured = !!(
  clerkKey && clerkKey !== 'undefined' && clerkKey.trim() !== '' &&
  clerkSecret && clerkSecret !== 'undefined' && clerkSecret.trim() !== ''
)

async function middleware(request: NextRequest) {
  // If Clerk isn't configured, just pass through
  if (!clerkConfigured) {
    return NextResponse.next()
  }

  try {
    const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server')

    const isPublicRoute = createRouteMatcher([
      '/api/auth/(.*)',
      '/api/listings',
      '/api/seed',
      '/api/payments/webhook',
      '/api/health',
    ])

    // clerkMiddleware() returns a handler function, NOT a Response.
    // We must CALL it with the request to get the actual Response.
    const handler = clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        auth().protect()
      }
    })

    return handler(request)
  } catch (err) {
    console.error('[middleware] Clerk import failed, skipping auth:', err)
    return NextResponse.next()
  }
}

export default middleware

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
