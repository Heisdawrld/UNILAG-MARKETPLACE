/**
 * escrow.ts — Delivery escrow payment service
 *
 * Flow:
 * 1. Customer creates delivery → paymentStatus = "unpaid"
 * 2. Customer pays (Flutterwave) → paymentStatus = "escrow" (money held by platform)
 * 3. Runner delivers → delivery confirmed → paymentStatus = "released" (runner gets 88%)
 * 4. If cancelled before pickup → paymentStatus = "refunded"
 *
 * Commission: 12% of finalPrice goes to platform
 * Runner receives: finalPrice - platformCommission (88%)
 */

import { db, isDatabaseAvailable } from './db'
import { isPaymentsEnabled, getPaymentMode, generateTxRef, initializePayment, initiateRefund, initiateTransfer } from './flutterwave'
import { logger } from './utils'

const PLATFORM_COMMISSION_RATE = 0.12
const MIN_DELIVERY_PRICE = 100
const MAX_DELIVERY_PRICE = 50000

// ── Calculate commission ──

export function calculateCommission(finalPrice: number): { runnerPayout: number; platformFee: number } {
  const platformFee = Math.round(finalPrice * PLATFORM_COMMISSION_RATE)
  const runnerPayout = finalPrice - platformFee
  return { runnerPayout, platformFee }
}

// ── Initiate delivery payment (escrow) ──

export async function initiateDeliveryPayment(
  orderId: string,
  customerId: string,
  customerEmail: string,
  customerName: string,
  amount: number
): Promise<{ paymentLink?: string; txRef: string; isLocked: boolean }> {
  const { platformFee, runnerPayout } = calculateCommission(amount)
  const txRef = generateTxRef('delivery')

  // Update order with payment reference
  if (isDatabaseAvailable()) {
    await db.deliveryOrder.update({
      where: { id: orderId },
      data: {
        paymentReference: txRef,
        platformCommission: platformFee,
      },
    })
  }

  // If payments are locked, mark as "free" delivery
  if (!isPaymentsEnabled()) {
    if (isDatabaseAvailable()) {
      await db.deliveryOrder.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'escrow',
          paymentMethod: 'locked',
          customerPaidAt: new Date(),
        },
      })
    }
    return { txRef, isLocked: true }
  }

  // Initiate Flutterwave payment
  const result = await initializePayment({
    tx_ref: txRef,
    amount,
    currency: 'NGN',
    customer: { email: customerEmail, name: customerName },
    meta: { userId: customerId, type: 'delivery', orderId },
  })

  return { paymentLink: result.link, txRef, isLocked: result.isLocked }
}

// ── Confirm escrow payment (called after Flutterwave verification) ──

export async function confirmEscrowPayment(orderId: string, txRef: string): Promise<boolean> {
  if (!isDatabaseAvailable()) return false

  try {
    const order = await db.deliveryOrder.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true, finalPrice: true, customerPrice: true, assignedRunnerId: true },
    })

    if (!order || order.paymentStatus !== 'unpaid') return false

    const finalAmount = order.finalPrice || order.customerPrice
    const { runnerPayout, platformFee } = calculateCommission(finalAmount)

    // Update order payment status
    await db.deliveryOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'escrow',
        paymentMethod: 'flutterwave',
        paymentReference: txRef,
        customerPaidAt: new Date(),
        platformCommission: platformFee,
      },
    })

    // Add to runner's pending balance (escrow)
    if (order.assignedRunnerId) {
      await creditRunnerPendingBalance(order.assignedRunnerId, runnerPayout, orderId)
    }

    // Log status
    await db.orderStatusLog.create({
      data: {
        orderId,
        fromStatus: null,
        toStatus: 'escrow_held',
        metadata: JSON.stringify({ txRef, amount: finalAmount, platformFee, runnerPayout }),
      },
    })

    return true
  } catch (error) {
    console.error('[escrow] Confirm payment error:', error)
    return false
  }
}

// ── Release escrow to runner (called when delivery is completed) ──

export async function releaseEscrow(orderId: string): Promise<boolean> {
  if (!isDatabaseAvailable()) return false

  try {
    const order = await db.deliveryOrder.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true, finalPrice: true, customerPrice: true, assignedRunnerId: true, platformCommission: true },
    })

    if (!order || order.paymentStatus !== 'escrow') return false
    if (!order.assignedRunnerId) return false

    const finalAmount = order.finalPrice || order.customerPrice
    const { runnerPayout } = calculateCommission(finalAmount)

    // Update order
    await db.deliveryOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'released',
        escrowReleasedAt: new Date(),
      },
    })

    // Move from pending to available balance
    await releaseRunnerBalance(order.assignedRunnerId, runnerPayout, orderId)

    // Log
    await db.orderStatusLog.create({
      data: {
        orderId,
        fromStatus: 'escrow_held',
        toStatus: 'escrow_released',
        metadata: JSON.stringify({ runnerPayout, platformFee: order.platformCommission }),
      },
    })

    return true
  } catch (error) {
    console.error('[escrow] Release error:', error)
    return false
  }
}

// ── Refund escrow (called when delivery is cancelled before pickup) ──

export async function refundEscrow(orderId: string, reason: string): Promise<boolean> {
  if (!isDatabaseAvailable()) return false

  try {
    const order = await db.deliveryOrder.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true, finalPrice: true, customerPrice: true, assignedRunnerId: true, paymentReference: true, paymentMethod: true },
    })

    if (!order || order.paymentStatus !== 'escrow') return false

    const finalAmount = order.finalPrice || order.customerPrice
    const { runnerPayout } = calculateCommission(finalAmount)

    // Update order
    await db.deliveryOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'refunded',
        refundReason: reason,
        refundProcessedAt: new Date(),
      },
    })

    // Remove from runner's pending balance
    if (order.assignedRunnerId) {
      await debitRunnerPendingBalance(order.assignedRunnerId, runnerPayout, orderId, reason)
    }

    // Log
    await db.orderStatusLog.create({
      data: {
        orderId,
        fromStatus: 'escrow_held',
        toStatus: 'escrow_refunded',
        metadata: JSON.stringify({ reason, refundAmount: finalAmount }),
      },
    })

    // ── Attempt Flutterwave refund (non-blocking) ──
    // The DB is already updated; if the Flutterwave call fails we log it
    // but don't block the refund. The refund can be retried later.
    try {
      if (order.paymentReference && order.paymentMethod === 'flutterwave') {
        const refundResult = await initiateRefund({
          transactionId: order.paymentReference,
          txRef: `REFUND_${orderId}`,
        })

        if (refundResult.success) {
          logger.log(`[escrow] Flutterwave refund initiated for order ${orderId}`, {
            refundId: refundResult.refundId,
            status: refundResult.status,
            isLocked: refundResult.isLocked,
          })
        } else {
          console.error(`[escrow] Flutterwave refund FAILED for order ${orderId} (DB refund still applied):`, refundResult.error)
        }
      } else {
        logger.log(`[escrow] Skipping Flutterwave refund for order ${orderId} (method: ${order.paymentMethod || 'unknown'}, ref: ${order.paymentReference || 'none'})`)
      }
    } catch (fwError) {
      // Never let Flutterwave errors crash the refund flow
      console.error('[escrow] Flutterwave refund exception (DB refund still applied):', fwError)
    }

    return true
  } catch (error) {
    console.error('[escrow] Refund error:', error)
    return false
  }
}

// ── Runner wallet helpers ──

async function getOrCreateWallet(userId: string) {
  if (!isDatabaseAvailable()) return null

  let wallet = await db.runnerWallet.findUnique({ where: { userId } })
  if (!wallet) {
    wallet = await db.runnerWallet.create({
      data: { userId, balance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0, totalHeld: 0 },
    })
  }
  return wallet
}

async function creditRunnerPendingBalance(userId: string, amount: number, orderId: string) {
  const wallet = await getOrCreateWallet(userId)
  if (!wallet) return

  const newPending = wallet.pendingBalance + amount
  const newTotalHeld = wallet.totalHeld + (amount * PLATFORM_COMMISSION_RATE / (1 - PLATFORM_COMMISSION_RATE))

  await db.runnerWallet.update({
    where: { id: wallet.id },
    data: { pendingBalance: newPending, totalHeld: Math.round(newTotalHeld) },
  })

  await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'escrow_hold',
      amount,
      balance: wallet.balance,
      reference: orderId,
      description: `Escrow hold for delivery ${orderId}`,
      metadata: JSON.stringify({ orderId }),
    },
  })
}

async function releaseRunnerBalance(userId: string, amount: number, orderId: string) {
  const wallet = await getOrCreateWallet(userId)
  if (!wallet) return

  const newBalance = wallet.balance + amount
  const newPending = Math.max(0, wallet.pendingBalance - amount)
  const newTotalEarned = wallet.totalEarned + amount

  await db.runnerWallet.update({
    where: { id: wallet.id },
    data: {
      balance: Math.round(newBalance),
      pendingBalance: Math.round(newPending),
      totalEarned: Math.round(newTotalEarned),
    },
  })

  await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'escrow_release',
      amount,
      balance: Math.round(newBalance),
      reference: orderId,
      description: `Payment received for delivery ${orderId}`,
      metadata: JSON.stringify({ orderId, runnerPayout: amount }),
    },
  })
}

async function debitRunnerPendingBalance(userId: string, amount: number, orderId: string, reason: string) {
  const wallet = await getOrCreateWallet(userId)
  if (!wallet) return

  const newPending = Math.max(0, wallet.pendingBalance - amount)

  await db.runnerWallet.update({
    where: { id: wallet.id },
    data: { pendingBalance: Math.round(newPending) },
  })

  await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'refund',
      amount: -amount,
      balance: wallet.balance,
      reference: orderId,
      description: `Refund: ${reason}`,
      metadata: JSON.stringify({ orderId, reason }),
    },
  })
}

// ── Get wallet info ──

export async function getRunnerWallet(userId: string) {
  const wallet = await getOrCreateWallet(userId)
  if (!wallet) return { balance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0, totalHeld: 0 }
  return {
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance,
    totalEarned: wallet.totalEarned,
    totalWithdrawn: wallet.totalWithdrawn,
    totalHeld: wallet.totalHeld,
  }
}

// ── Request payout ──

export async function requestPayout(
  runnerId: string,
  amount: number,
  bankName: string,
  accountNumber: string,
  accountName: string,
  bankCode?: string
): Promise<{ success: boolean; payoutId?: string; error?: string }> {
  if (!isDatabaseAvailable()) return { success: false, error: 'Database unavailable' }

  const wallet = await getOrCreateWallet(runnerId)
  if (!wallet) return { success: false, error: 'Wallet not found' }

  if (amount > wallet.balance) {
    return { success: false, error: 'Insufficient balance' }
  }

  const MIN_PAYOUT = 1000 // ₦1,000 minimum payout
  if (amount < MIN_PAYOUT) {
    return { success: false, error: `Minimum payout is ₦${MIN_PAYOUT.toLocaleString()}` }
  }

  const PAYOUT_FEE = 50 // ₦50 processing fee
  const netAmount = amount - PAYOUT_FEE

  // Generate a unique reference for the Flutterwave transfer
  const transferRef = generateTxRef('payout')

  // Create payout request
  const payout = await db.payoutRequest.create({
    data: {
      runnerId,
      amount,
      fee: PAYOUT_FEE,
      netAmount,
      status: 'pending',
      method: 'bank_transfer',
      bankName,
      bankCode: bankCode || null,
      accountNumber,
      accountName,
      flutterwaveTxRef: transferRef,
    },
  })

  // Deduct from wallet balance
  await db.runnerWallet.update({
    where: { id: wallet.id },
    data: {
      balance: Math.round(wallet.balance - amount),
      totalWithdrawn: Math.round(wallet.totalWithdrawn + amount),
    },
  })

  // Record transaction
  await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'payout',
      amount: -amount,
      balance: Math.round(wallet.balance - amount),
      reference: payout.id,
      description: `Payout request to ${bankName} ****${accountNumber.slice(-4)}`,
      metadata: JSON.stringify({ payoutId: payout.id, bankName, accountNumber: accountNumber.slice(-4), netAmount, transferRef }),
    },
  })

  // ── Attempt Flutterwave transfer (non-blocking) ──
  // If the Flutterwave call fails, the payout stays "pending" and can be
  // retried by the admin or via a retry job. The wallet is already debited.
  try {
    if (isPaymentsEnabled() && bankCode && accountNumber && accountName) {
      const transferResult = await initiateTransfer({
        accountBank: bankCode,
        accountNumber,
        amount: netAmount,
        narration: `UNILAG Marketplace payout - ${accountName}`,
        reference: transferRef,
        currency: 'NGN',
        beneficiaryName: accountName,
      })

      if (transferResult.success) {
        // Update payout with Flutterwave transfer details
        await db.payoutRequest.update({
          where: { id: payout.id },
          data: {
            status: transferResult.status === 'success' ? 'completed' : 'processing',
            flutterwaveTxRef: transferResult.flutterwaveRef || transferResult.reference || transferRef,
            ...(transferResult.status === 'success' ? { processedAt: new Date() } : {}),
          },
        })

        logger.log(`[escrow] Flutterwave transfer initiated for payout ${payout.id}`, {
          transferId: transferResult.transferId,
          status: transferResult.status,
          reference: transferResult.reference,
          isLocked: transferResult.isLocked,
        })
      } else {
        console.error(`[escrow] Flutterwave transfer FAILED for payout ${payout.id} (stays pending):`, transferResult.error)
      }
    } else if (!bankCode) {
      console.warn(`[escrow] No bankCode provided for payout ${payout.id} — stays pending until admin processes`)
    } else {
      logger.log(`[escrow] Payments locked — payout ${payout.id} stays pending (mock mode)`)
      // In locked mode, auto-complete the payout since there's no real money movement
      if (getPaymentMode() === 'locked') {
        await db.payoutRequest.update({
          where: { id: payout.id },
          data: {
            status: 'completed',
            processedAt: new Date(),
          },
        })
      }
    }
  } catch (fwError) {
    // Never let Flutterwave errors crash the payout flow
    console.error('[escrow] Flutterwave transfer exception (payout stays pending):', fwError)
  }

  return { success: true, payoutId: payout.id }
}
