import { NextRequest, NextResponse } from 'next/server'
import { requireRunner } from '@/lib/auth-guard'
import { rateLimits } from '@/lib/rate-limit'
import { getRunnerWallet } from '@/lib/escrow'

export async function GET(req: NextRequest) {
  const { userId, errorResponse } = await requireRunner()
  if (errorResponse) return errorResponse

  const rl = await rateLimits.standard(req)
  if (!rl.success) return rl.response!

  const wallet = await getRunnerWallet(userId!)
  return NextResponse.json(wallet)
}
