import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth'
import { rateLimits } from '@/lib/rate-limit'
import { db, isDatabaseAvailable } from '@/lib/db'
import { verifyTransfer, initiateTransfer, generateTxRef, isPaymentsEnabled } from '@/lib/flutterwave'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdminUser()
  if (!adminResult.ok) return NextResponse.json({ error: adminResult.error }, { status: adminResult.status })

  const rl = await rateLimits.write(req)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  try {
    const { id } = await params
    const body = await req.json()
    const { action, failedReason } = body

    const payout = await db.payoutRequest.findUnique({ where: { id } })
    if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    if (payout.status !== 'pending' && payout.status !== 'processing') {
      return NextResponse.json({ error: 'Cannot modify completed/failed payout' }, { status: 400 })
    }

    if (action === 'approve') {
      await db.payoutRequest.update({
        where: { id },
        data: { status: 'processing', reviewedBy: adminResult.user.id, reviewedAt: new Date() },
      })
      return NextResponse.json({ success: true, status: 'processing' })
    }

    if (action === 'complete') {
      await db.payoutRequest.update({
        where: { id },
        data: { status: 'completed', processedAt: new Date(), reviewedBy: adminResult.user.id },
      })
      return NextResponse.json({ success: true, status: 'completed' })
    }

    if (action === 'reject') {
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
            description: `Payout rejected: ${failedReason || 'Admin decision'}`,
          },
        })
      }
      await db.payoutRequest.update({
        where: { id },
        data: { status: 'failed', failedReason: failedReason || 'Rejected by admin', reviewedBy: adminResult.user.id, reviewedAt: new Date() },
      })
      return NextResponse.json({ success: true, status: 'failed' })
    }

    // ── Check Flutterwave transfer status ──
    if (action === 'check_status') {
      if (!payout.flutterwaveTxRef) {
        return NextResponse.json({ error: 'No Flutterwave reference on this payout' }, { status: 400 })
      }

      const transferResult = await verifyTransfer(payout.flutterwaveTxRef)

      if (!transferResult.success) {
        return NextResponse.json({ error: transferResult.error || 'Failed to verify transfer' }, { status: 500 })
      }

      const fwStatus = transferResult.status?.toLowerCase()
      let newStatus = payout.status

      if (fwStatus === 'success' || fwStatus === 'successful') {
        newStatus = 'completed'
        await db.payoutRequest.update({
          where: { id },
          data: { status: 'completed', processedAt: new Date() },
        })
      } else if (fwStatus === 'failed' || fwStatus === 'reversed') {
        newStatus = 'failed'
        // Refund wallet on failed transfer
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
              description: `Payout transfer failed via Flutterwave — amount returned`,
            },
          })
        }
        await db.payoutRequest.update({
          where: { id },
          data: { status: 'failed', failedReason: 'Transfer failed via Flutterwave' },
        })
      }

      return NextResponse.json({
        success: true,
        flutterwaveStatus: fwStatus,
        payoutStatus: newStatus,
      })
    }

    // ── Retry failed Flutterwave transfer ──
    if (action === 'retry_transfer') {
      if (!isPaymentsEnabled()) {
        return NextResponse.json({ error: 'Payments are currently locked' }, { status: 400 })
      }

      if (!payout.bankCode || !payout.accountNumber || !payout.accountName) {
        return NextResponse.json({ error: 'Missing bank details for transfer' }, { status: 400 })
      }

      const newRef = generateTxRef('payout_retry')
      const transferResult = await initiateTransfer({
        accountBank: payout.bankCode,
        accountNumber: payout.accountNumber,
        amount: payout.netAmount,
        narration: `UNILAG Marketplace payout (retry) - ${payout.accountName}`,
        reference: newRef,
        currency: 'NGN',
        beneficiaryName: payout.accountName,
      })

      if (transferResult.success) {
        await db.payoutRequest.update({
          where: { id },
          data: {
            status: transferResult.status === 'success' ? 'completed' : 'processing',
            flutterwaveTxRef: transferResult.flutterwaveRef || transferResult.reference || newRef,
            failedReason: null,
            ...(transferResult.status === 'success' ? { processedAt: new Date() } : {}),
          },
        })

        return NextResponse.json({
          success: true,
          status: transferResult.status === 'success' ? 'completed' : 'processing',
          transferId: transferResult.transferId,
          reference: transferResult.reference,
        })
      } else {
        return NextResponse.json({
          error: `Transfer retry failed: ${transferResult.error}`,
        }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Invalid action. Use: approve, complete, reject, check_status, retry_transfer' }, { status: 400 })
  } catch (error) {
    console.error('[admin/payouts] Error:', error)
    return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 })
  }
}
