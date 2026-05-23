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
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status) where.status = status

    const [payouts, total] = await Promise.all([
      db.payoutRequest.findMany({
        where,
        include: {
          runner: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.payoutRequest.count({ where }),
    ])

    // ── Payout stats ──
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [pendingAgg, processingAgg, completedThisMonthAgg] = await Promise.all([
      db.payoutRequest.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true, netAmount: true },
        _count: true,
      }),
      db.payoutRequest.aggregate({
        where: { status: 'processing' },
        _sum: { amount: true, netAmount: true },
        _count: true,
      }),
      db.payoutRequest.aggregate({
        where: { status: 'completed', processedAt: { gte: startOfMonth } },
        _sum: { amount: true, netAmount: true },
        _count: true,
      }),
    ])

    return NextResponse.json({
      payouts,
      total,
      limit,
      offset,
      stats: {
        pending: {
          totalAmount: pendingAgg._sum.amount || 0,
          totalNetAmount: pendingAgg._sum.netAmount || 0,
          count: pendingAgg._count,
        },
        processing: {
          totalAmount: processingAgg._sum.amount || 0,
          totalNetAmount: processingAgg._sum.netAmount || 0,
          count: processingAgg._count,
        },
        completedThisMonth: {
          totalAmount: completedThisMonthAgg._sum.amount || 0,
          totalNetAmount: completedThisMonthAgg._sum.netAmount || 0,
          count: completedThisMonthAgg._count,
        },
      },
    })
  } catch (error) {
    console.error('[admin/payouts] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 })
  }
}
