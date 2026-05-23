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

    if (!runnerId) return NextResponse.json({ error: 'runnerId is required' }, { status: 400 })

    // 3. Verify runnerId matches authenticated user
    if (runnerId !== userId) {
      return NextResponse.json({ error: 'You can only view your own earnings' }, { status: 403 })
    }

    if (!isDatabaseAvailable()) return NextResponse.json({ today: 4200, week: 18700, month: 52300, totalDeliveries: 12, avgRating: 4.7, pendingPayout: 3200 })
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const completedDeliveries = await db.deliveryOrder.findMany({ where: { assignedRunnerId: runnerId, status: 'completed', finalPrice: { not: null } }, select: { id: true, finalPrice: true, platformCommission: true, customerRating: true, completedAt: true }, orderBy: { completedAt: 'desc' } })
    const todayEarnings = completedDeliveries.filter(d => d.completedAt && d.completedAt >= startOfDay).reduce((sum, d) => sum + (d.finalPrice || 0) - (d.platformCommission || 0), 0)
    const weekEarnings = completedDeliveries.filter(d => d.completedAt && d.completedAt >= startOfWeek).reduce((sum, d) => sum + (d.finalPrice || 0) - (d.platformCommission || 0), 0)
    const monthEarnings = completedDeliveries.filter(d => d.completedAt && d.completedAt >= startOfMonth).reduce((sum, d) => sum + (d.finalPrice || 0) - (d.platformCommission || 0), 0)
    const totalDeliveries = completedDeliveries.length
    const avgRating = totalDeliveries > 0 ? completedDeliveries.reduce((sum, d) => sum + (d.customerRating || 0), 0) / totalDeliveries : 0
    return NextResponse.json({ today: Math.round(todayEarnings), week: Math.round(weekEarnings), month: Math.round(monthEarnings), totalDeliveries, avgRating: Math.round(avgRating * 10) / 10, pendingPayout: 0 })
  } catch (error) { console.error('[api/runner/earnings] Error:', error); return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 }) }
}
