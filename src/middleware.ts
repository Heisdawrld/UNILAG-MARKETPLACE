import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple pass-through middleware.
// Clerk auth protection is handled at the page/route level instead.
// This prevents the "Expected an instance of Response" TypeError
// that was caused by incorrectly wrapping clerkMiddleware.
async function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export default middleware

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
