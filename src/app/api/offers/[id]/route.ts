import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

async function getAuthUser() {
  const { auth } = await import('@clerk/nextjs/server')
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  return db.user.findUnique({ where: { clerkId }, select: { id: true, role: true } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    if (!isDatabaseAvailable()) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

    const { id } = await params
    const body = await req.json()
    const { action } = body // 'accept' or 'reject'

    const offer = await db.offer.findUnique({
      where: { id },
      include: { listing: { select: { sellerId: true, id: true, price: true } } },
    })
    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

    // Only the seller can accept/reject
    if (offer.listing.sellerId !== authUser.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    if (offer.status !== 'pending') {
      return NextResponse.json({ error: 'Offer already responded to' }, { status: 400 })
    }

    if (action === 'accept') {
      // Accept this offer, reject all others
      await db.offer.update({ where: { id }, data: { status: 'accepted', respondedAt: new Date() } })
      await db.offer.updateMany({
        where: { listingId: offer.listingId, status: 'pending', id: { not: id } },
        data: { status: 'rejected', respondedAt: new Date() },
      })

      // Notify buyer
      await db.notification.create({
        data: {
          userId: offer.buyerId,
          type: 'offer_accepted',
          title: 'Offer Accepted!',
          message: `Your offer of ₦${offer.amount.toLocaleString()} was accepted`,
          data: JSON.stringify({ offerId: id, listingId: offer.listingId }),
        },
      })
    } else if (action === 'reject') {
      await db.offer.update({ where: { id }, data: { status: 'rejected', respondedAt: new Date() } })

      await db.notification.create({
        data: {
          userId: offer.buyerId,
          type: 'offer_rejected',
          title: 'Offer Rejected',
          message: `Your offer of ₦${offer.amount.toLocaleString()} was not accepted`,
          data: JSON.stringify({ offerId: id, listingId: offer.listingId }),
        },
      })
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "accept" or "reject"' }, { status: 400 })
    }

    return NextResponse.json({ success: true, action })
  } catch (error) {
    console.error('[offers] Update error:', error)
    return NextResponse.json({ error: 'Failed to update offer' }, { status: 500 })
  }
}
