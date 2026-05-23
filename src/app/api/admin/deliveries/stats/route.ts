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
    const [total, completed, searching, inTransit, cancelled, totalRevenue, totalCommission, avgRating] = await Promise.all([
      db.deliveryOrder.count(),
      db.deliveryOrder.count({ where: { status: 'completed' } }),
      db.deliveryOrder.count({ where: { status: 'searching' } }),
      db.deliveryOrder.count({ where: { status: { in: ['runner_assigned', 'runner_en_route', 'picked_up', 'in_transit'] } } }),
      db.deliveryOrder.count({ where: { status: 'cancelled' } }),
      db.deliveryOrder.aggregate({ where: { status: 'completed', finalPrice: { not: null } }, _sum: { finalPrice: true } }),
      db.deliveryOrder.aggregate({ where: { status: 'completed' }, _sum: { platformCommission: true } }),
      db.deliveryOrder.aggregate({ where: { status: 'completed', customerRating: { not: null } }, _avg: { customerRating: true } }),
    ])

    const runnerCount = await db.user.count({ where: { isRunner: true } })
    const activeRunners = await db.user.count({ where: { isRunner: true, runnerAvailabilityStatus: 'available' } })

    return NextResponse.json({
      total,
      byStatus: { completed, searching, inTransit, cancelled },
      revenue: {
        total: totalRevenue._sum.finalPrice || 0,
        commission: totalCommission._sum.platformCommission || 0,
      },
      avgRating: avgRating._avg.customerRating ? Math.round(avgRating._avg.customerRating * 10) / 10 : 0,
      runners: { total: runnerCount, active: activeRunners },
    })
  } catch (error) {
    console.error('[admin/deliveries/stats] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
