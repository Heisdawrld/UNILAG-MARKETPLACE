import { NextRequest, NextResponse } from 'next/server'
import { fetchBanks } from '@/lib/flutterwave'

/**
 * GET /api/payments/banks
 * Returns list of supported banks with their Flutterwave codes.
 * Used by the payout form to populate bank selection dropdown.
 */
export async function GET(req: NextRequest) {
  try {
    const currency = req.nextUrl.searchParams.get('currency') || 'NGN'
    const banks = await fetchBanks(currency)
    return NextResponse.json({ banks })
  } catch (error) {
    console.error('[api/payments/banks] Error:', error)
    return NextResponse.json({ banks: [] }, { status: 200 })
  }
}
