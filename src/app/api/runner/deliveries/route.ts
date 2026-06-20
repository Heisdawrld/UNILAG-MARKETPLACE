import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { requireRunner } from '@/lib/auth-guard'
import { rateLimits } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // 1. Auth check — require runner
  const { userId, errorResponse } = await requireRunner()
  if (errorResponse) return errorResponse

  // 2. Rate limit
  const rl = await rateLimits.standard(req)
  if (!rl.success) return rl.response!

  try {
    const { searchParams } = new URL(req.url)
    const runnerId = searchParams.get('runnerId')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const cursor = searchParams.get('cursor')

    if (!runnerId) return NextResponse.json({ error: 'runnerId is required' }, { status: 400 })

    // 3. Verify runnerId matches authenticated user
    if (runnerId !== userId) {
      return NextResponse.json({ error: 'You can only view your own deliveries' }, { status: 403 })
    }

    if (!isDatabaseAvailable()) return NextResponse.json({ error: 'Service unavailable — database not configured' }, { status: 503 })
    const where: any = { assignedRunnerId: runnerId, status: { in: status ? [status] : ['completed', 'cancelled'] } }
    if (cursor) where.id = { lt: cursor }
    const deliveries = await db.deliveryOrder.findMany({ where, select: { id: true, title: true, category: true, finalPrice: true, status: true, completedAt: true, cancelledAt: true, customerRating: true, customerReview: true, estimatedDistanceMeters: true }, orderBy: { createdAt: 'desc' }, take: limit + 1 })
    const hasMore = deliveries.length > limit
    const items = hasMore ? deliveries.slice(0, limit) : deliveries
    return NextResponse.json({ items, nextCursor: hasMore ? items[items.length - 1].id : null, total: items.length })
  } catch (error) { console.error('[api/runner/deliveries] Error:', error); return NextResponse.json({ error: 'Failed to fetch delivery history' }, { status: 500 }) }
}
