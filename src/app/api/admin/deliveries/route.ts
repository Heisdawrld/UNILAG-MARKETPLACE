import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth'
import { rateLimits } from '@/lib/rate-limit'
import { db, isDatabaseAvailable } from '@/lib/db'

export async function GET(req: NextRequest) {
  const adminResult = await requireAdminUser()
  if (!adminResult.ok) return NextResponse.json({ error: adminResult.error }, { status: adminResult.status })

  const rl = await rateLimits.standard(req)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')

    const where: any = {}
    if (status) where.status = status
    if (search) where.title = { contains: search }

    const [deliveries, total] = await Promise.all([
      db.deliveryOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, username: true, avatar: true, email: true } },
          assignedRunner: { select: { id: true, username: true, avatar: true, runnerRating: true } },
          offers: { select: { id: true, runnerId: true, runnerPrice: true, status: true, createdAt: true }, where: { status: 'open' } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.deliveryOrder.count({ where }),
    ])

    return NextResponse.json({ deliveries, total, limit, offset })
  } catch (error) {
    console.error('[admin/deliveries] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 })
  }
}
