import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { rateLimits } from '@/lib/rate-limit'

// GET /api/deliveries/[id]/track — Public tracking info (limited data)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const rl = await rateLimits.standard(req)
  if (!rl.success) return rl.response!

  try {
    const { id } = await params
    const order = await db.deliveryOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        title: true,
        category: true,
        pickupAddress: true,
        dropoffAddress: true,
        estimatedDurationMinutes: true,
        createdAt: true,
        assignedRunner: {
          select: {
            username: true,
            avatar: true,
            runnerRating: true,
            runnerProfile: { select: { transportMode: true } },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    // Only return limited tracking data (no pickup code, no price, no internal IDs)
    return NextResponse.json({
      id: order.id,
      status: order.status,
      title: order.title,
      category: order.category,
      pickupAddress: order.pickupAddress,
      dropoffAddress: order.dropoffAddress,
      estimatedDurationMinutes: order.estimatedDurationMinutes,
      runnerName: order.assignedRunner?.username || null,
      runnerAvatar: order.assignedRunner?.avatar || null,
      runnerRating: order.assignedRunner?.runnerRating || null,
      runnerTransport: order.assignedRunner?.runnerProfile?.transportMode || null,
      createdAt: order.createdAt,
    })
  } catch (error) {
    console.error('[deliveries/id/track] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch tracking info' }, { status: 500 })
  }
}
