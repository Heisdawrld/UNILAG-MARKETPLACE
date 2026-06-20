import { NextRequest, NextResponse } from 'next/server'
import { requireRunner } from '@/lib/auth-guard'
import { rateLimits } from '@/lib/rate-limit'
import { db, isDatabaseAvailable } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { userId, errorResponse } = await requireRunner()
  if (errorResponse) return errorResponse

  const rl = await rateLimits.standard(req)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) return NextResponse.json({ error: 'Service unavailable — database not configured' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const type = searchParams.get('type')

  const wallet = await db.runnerWallet.findUnique({ where: { userId: userId! } })
  if (!wallet) return NextResponse.json({ transactions: [] })

  const where: any = { walletId: wallet.id }
  if (type) where.type = type

  const transactions = await db.walletTransaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ transactions })
}
