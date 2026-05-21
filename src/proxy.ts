import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
const clerkSecKey = process.env.CLERK_SECRET_KEY || ''
const isClerkConfigured = !!(
  clerkPubKey &&
  clerkSecKey &&
  clerkPubKey !== 'undefined' &&
  clerkSecKey !== 'undefined' &&
  clerkPubKey.startsWith('pk_')
)

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/(.*)',
  '/manifest.json',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isClerkConfigured) {
    return NextResponse.next()
  }

  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
