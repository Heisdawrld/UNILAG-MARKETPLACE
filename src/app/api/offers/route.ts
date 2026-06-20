import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { rateLimits } from '@/lib/rate-limit'

async function getAuthUser() {
  const { auth } = await import('@clerk/nextjs/server')
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  return db.user.findUnique({ where: { clerkId }, select: { id: true, role: true } })
}

// POST /api/offers — Make an offer on a listing
export async function POST(req: NextRequest) {
  // Rate limit
  const rl = await rateLimits.write(req)
  if (!rl.success) return rl.response!

  try {
    const authUser = await getAuthUser()
    if (!authUser) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    if (!isDatabaseAvailable()) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

    const body = await req.json()
    const { listingId, amount, message } = body

    if (!listingId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'listingId and amount are required' }, { status: 400 })
    }

    const listing = await db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, price: true, sellerId: true, negotiable: true, status: true },
    })

    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (listing.status !== 'active') return NextResponse.json({ error: 'Listing not available' }, { status: 400 })
    if (listing.sellerId === authUser.id) return NextResponse.json({ error: 'Cannot offer on your own listing' }, { status: 400 })
    if (!listing.negotiable && amount < listing.price) {
      return NextResponse.json({ error: 'This listing is not negotiable' }, { status: 400 })
    }
    if (amount > listing.price * 2) {
      return NextResponse.json({ error: 'Offer cannot exceed 2x the listing price' }, { status: 400 })
    }

    // Check for existing pending offer from this buyer
    const existing = await db.offer.findFirst({
      where: { listingId, buyerId: authUser.id, status: 'pending' },
    })
    if (existing) {
      return NextResponse.json({ error: 'You already have a pending offer', code: 'DUPLICATE_OFFER' }, { status: 409 })
    }

    const offer = await db.offer.create({
      data: {
        listingId,
        buyerId: authUser.id,
        amount,
        message: message ? String(message).trim().slice(0, 500) : null,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour expiry
      },
    })

    // Notify seller
    await db.notification.create({
      data: {
        userId: listing.sellerId,
        type: 'new_offer',
        title: 'New Offer',
        message: `${authUser.id} offered ₦${amount.toLocaleString()} for your listing`,
        data: JSON.stringify({ offerId: offer.id, listingId, amount }),
      },
    })

    return NextResponse.json({ offer })
  } catch (error) {
    console.error('[offers] Create error:', error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }
}

// GET /api/offers — List offers for a listing (seller) or user's offers (buyer)
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    if (!isDatabaseAvailable()) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

    const url = new URL(req.url)
    const listingId = url.searchParams.get('listingId')
    const role = url.searchParams.get('role') || 'buyer'

    const where: Record<string, unknown> = {}
    if (listingId) {
      where.listingId = listingId
      if (role === 'seller') {
        // Verify user owns the listing
        const listing = await db.listing.findUnique({ where: { id: listingId } })
        if (!listing || listing.sellerId !== authUser.id) {
          return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
        }
      }
    } else {
      where.buyerId = authUser.id
    }

    const offers = await db.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { id: true, username: true, avatar: true, trustScore: true } },
        listing: { select: { id: true, title: true, price: true, images: true } },
      },
    })

    return NextResponse.json({ offers })
  } catch (error) {
    console.error('[offers] List error:', error)
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}
