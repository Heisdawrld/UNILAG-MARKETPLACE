import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, verifyTransfer } from '@/lib/flutterwave'
import { db, isDatabaseAvailable } from '@/lib/db'
import { logger } from '@/lib/utils'

/**
 * POST /api/payments/transfer-webhook
 * Flutterwave transfer webhook — receives status updates for bank transfers (payouts).
 *
 * Events:
 * - transfer.completed → mark payout as completed
 * - transfer.failed    → mark payout as failed, refund wallet
 * - transfer.reversed  → mark payout as failed, refund wallet
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.text()
    const signature = req.headers.get('verif-hash') || ''

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      console.warn('[transfer-webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(payload)
    const event = body.event
    const transferData = body.data

    if (!transferData) {
      return NextResponse.json({ error: 'No transfer data' }, { status: 400 })
    }

    logger.log(`[transfer-webhook] Event: ${event}`, {
      id: transferData.id,
      reference: transferData.reference,
      status: transferData.status,
    })

    if (!isDatabaseAvailable()) {
      return NextResponse.json({ received: true })
    }

    // Find the payout by Flutterwave reference
    const payout = await db.payoutRequest.findFirst({
      where: { flutterwaveTxRef: transferData.reference },
    })

    if (!payout) {
      console.warn(`[transfer-webhook] No payout found for reference: ${transferData.reference}`)
      return NextResponse.json({ received: true })
    }

    // Handle completed transfer
    if (event === 'transfer.completed' || transferData.status === 'SUCCESSFUL') {
      await db.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: 'completed',
          processedAt: new Date(),
        },
      })

      logger.log(`[transfer-webhook] Payout ${payout.id} marked as completed`)
    }

    // Handle failed or reversed transfer
    if (event === 'transfer.failed' || event === 'transfer.reversed' ||
        transferData.status === 'FAILED' || transferData.status === 'REVERSED') {
      // Refund the amount back to wallet
      const wallet = await db.runnerWallet.findUnique({ where: { userId: payout.runnerId } })
      if (wallet) {
        await db.runnerWallet.update({
          where: { id: wallet.id },
          data: {
            balance: wallet.balance + payout.amount,
            totalWithdrawn: wallet.totalWithdrawn - payout.amount,
          },
        })
        await db.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'refund',
            amount: payout.amount,
            balance: wallet.balance + payout.amount,
            reference: payout.id,
            description: `Payout transfer failed/reversed — amount returned`,
            metadata: JSON.stringify({ transferId: transferData.id, reason: transferData.complete_message }),
          },
        })
      }

      await db.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: 'failed',
          failedReason: transferData.complete_message || 'Transfer failed via Flutterwave',
        },
      })

        logger.log(`[transfer-webhook] Payout ${payout.id} marked as failed, wallet refunded`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[transfer-webhook] Error processing webhook:', error)
    // Return 200 so Flutterwave doesn't retry unnecessarily
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
