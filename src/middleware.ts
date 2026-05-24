import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/delivery(.*)',
  '/runner(.*)',
  '/sell(.*)',
  '/messages(.*)',
  '/profile(.*)',
  '/settings(.*)',
  '/api/auth/socket-token(.*)',
  '/api/delivery(.*)',
  '/api/listings(.*)',
  '/api/messages(.*)',
  '/api/user(.*)',
])

// Routes that are public (no auth required)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/browse(.*)',
  '/listings(.*)',
  '/api/health(.*)',
  '/api/seed(.*)',
  '/api/webhook(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes without auth
  if (isPublicRoute(req)) {
    return
  }

  // Protect routes that require authentication
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
