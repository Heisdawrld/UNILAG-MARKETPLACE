import { NextRequest, NextResponse } from 'next/server'
import { requireRunner } from '@/lib/auth-guard'
import { rateLimits } from '@/lib/rate-limit'
import { requestPayout } from '@/lib/escrow'
import { validateBody } from '@/lib/validation'
import { z } from 'zod/v4'

const PayoutRequestSchema = z.object({
  amount: z.number().min(1000).max(500000),
  bankName: z.string().trim().min(1).max(100),
  bankCode: z.string().trim().min(1).max(10).optional(), // Flutterwave bank code (e.g. '044')
  accountNumber: z.string().trim().min(10).max(20),
  accountName: z.string().trim().min(1).max(100),
})

export async function POST(req: NextRequest) {
  const { userId, errorResponse } = await requireRunner()
  if (errorResponse) return errorResponse

  const rl = await rateLimits.write(req)
  if (!rl.success) return rl.response!

  const body = await req.json()
  const { data, error } = validateBody(PayoutRequestSchema, body)
  if (error) return error

  const result = await requestPayout(
    userId!,
    data.amount,
    data.bankName,
    data.accountNumber,
    data.accountName,
    data.bankCode
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, payoutId: result.payoutId }, { status: 201 })
}
