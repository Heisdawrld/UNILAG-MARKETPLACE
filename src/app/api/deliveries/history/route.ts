import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'
import { rateLimits } from '@/lib/rate-limit'

// GET /api/deliveries/history — Get delivery history for a customer
export async function GET(req: NextRequest) {
  // 1. Auth check
  const { userId, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // 2. Rate limit
  const rl = await rateLimits.standard(req)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
    }

    // 3. Verify customerId matches authenticated user
    if (customerId !== userId) {
      return NextResponse.json({ error: 'You can only view your own delivery history' }, { status: 403 })
    }

    const orders = await db.deliveryOrder.findMany({
      where: {
        customerId,
        status: { in: ['completed', 'cancelled'] },
      },
      select: {
        id: true,
        title: true,
        category: true,
        finalPrice: true,
        status: true,
        completedAt: true,
        customerRating: true,
        customerReview: true,
        estimatedDistanceMeters: true,
        assignedRunner: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const total = await db.deliveryOrder.count({
      where: {
        customerId,
        status: { in: ['completed', 'cancelled'] },
      },
    })

    const history = orders.map(order => ({
      id: order.id,
      title: order.title,
      category: order.category,
      finalPrice: order.finalPrice,
      status: order.status,
      completedAt: order.completedAt?.toISOString() || null,
      runnerRating: order.customerRating,
      runnerReview: order.customerReview,
      estimatedDistanceMeters: order.estimatedDistanceMeters,
      runnerUsername: order.assignedRunner?.username || null,
    }))

    return NextResponse.json({ history, total, limit, offset })
  } catch (error) {
    console.error('[deliveries/history] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch delivery history' }, { status: 500 })
  }
}
