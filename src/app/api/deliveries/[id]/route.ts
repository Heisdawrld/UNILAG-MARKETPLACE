import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'
import { rateLimits } from '@/lib/rate-limit'
import { validateBody, DeliveryUpdateSchema } from '@/lib/validation'
import { sanitizeText } from '@/lib/sanitize'

// GET /api/deliveries/[id] — Get a single delivery order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const order = await db.deliveryOrder.findUnique({
      where: { id },
      include: {
        assignedRunner: {
          select: {
            id: true, username: true, avatar: true, runnerRating: true,
            phone: true, runnerProfile: { select: { transportMode: true } },
          },
        },
        offers: {
          include: {
            runner: {
              select: {
                id: true, username: true, avatar: true, runnerRating: true,
                tasksCompleted: true, runnerProfile: { select: { transportMode: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        statusLogs: { orderBy: { timestamp: 'asc' } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    // 3. Only allow customer or assigned runner to view
    if (order.customerId !== userId && order.assignedRunnerId !== userId) {
      return NextResponse.json({ error: 'You are not authorized to view this delivery' }, { status: 403 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('[deliveries/id] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch delivery' }, { status: 500 })
  }
}

// PATCH /api/deliveries/[id] — Update a delivery order (confirm, rate, cancel)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth check
  const { userId, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // 2. Rate limit
  const rl = await rateLimits.write(req)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    // 3. Validate input
    const { data, error } = validateBody(DeliveryUpdateSchema, body)
    if (error) return error

    const { action, rating, review, cancelReason, cancelledBy } = data

    const order = await db.deliveryOrder.findUnique({
      where: { id },
      select: { status: true, customerId: true, assignedRunnerId: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    // 4. Verify ownership based on action
    const isCustomer = order.customerId === userId
    const isRunner = order.assignedRunnerId === userId

    if (action === 'confirm') {
      // Only the customer can confirm/rate
      if (!isCustomer) {
        return NextResponse.json({ error: 'Only the customer can confirm this delivery' }, { status: 403 })
      }
      if (order.status !== 'delivered') {
        return NextResponse.json({ error: 'Order must be delivered first' }, { status: 400 })
      }
      const now = new Date()
      const sanitizedReview = review ? sanitizeText(review, 1000) : null
      await db.deliveryOrder.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: now,
          customerRating: rating,
          customerReview: sanitizedReview,
        },
      })
      await db.orderStatusLog.create({
        data: { orderId: id, fromStatus: 'delivered', toStatus: 'completed', metadata: JSON.stringify({ rating }) },
      })
      // Update runner stats
      if (order.assignedRunnerId) {
        const runner = await db.user.findUnique({
          where: { id: order.assignedRunnerId },
          select: { tasksCompleted: true, runnerRating: true, totalReviews: true },
        })
        if (runner && rating) {
          const n = runner.totalReviews + 1
          await db.user.update({
            where: { id: order.assignedRunnerId },
            data: {
              tasksCompleted: runner.tasksCompleted + 1,
              runnerRating: Math.round(((runner.runnerRating * runner.totalReviews + rating) / n) * 10) / 10,
              totalReviews: n,
            },
          })
        }
      }
      return NextResponse.json({ success: true, status: 'completed' })
    }

    if (action === 'cancel') {
      // Both customer and runner can cancel
      if (!isCustomer && !isRunner) {
        return NextResponse.json({ error: 'You are not authorized to cancel this delivery' }, { status: 403 })
      }
      if (['completed', 'cancelled'].includes(order.status)) {
        return NextResponse.json({ error: 'Cannot cancel completed/cancelled order' }, { status: 400 })
      }
      const now = new Date()
      const sanitizedReason = cancelReason ? sanitizeText(cancelReason, 500) : null
      await db.deliveryOrder.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: now, cancelReason: sanitizedReason, cancelledBy: cancelledBy || null },
      })
      await db.orderStatusLog.create({
        data: { orderId: id, fromStatus: order.status, toStatus: 'cancelled', metadata: JSON.stringify({ reason: sanitizedReason, cancelledBy }) },
      })
      return NextResponse.json({ success: true, status: 'cancelled' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[deliveries/id] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 })
  }
}
