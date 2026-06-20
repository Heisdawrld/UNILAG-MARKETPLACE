import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { createAuditLog } from '@/lib/audit-log'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { auth } = await import('@clerk/nextjs/server')
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    if (!isDatabaseAvailable()) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

    const { id } = await params
    const body = await req.json()
    const { action, reason } = body // 'confirm_delivery' | 'cancel' | 'dispute' | 'mark_delivered'

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      include: { listing: { select: { id: true, title: true, sellerId: true } } },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // ── mark_delivered: Seller marks order as delivered ──
    if (action === 'mark_delivered') {
      // Only seller can mark as delivered
      if (order.sellerId !== user.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
      if (order.status !== 'paid') {
        return NextResponse.json({ error: 'Order must be in paid status to mark as delivered' }, { status: 400 })
      }

      await db.marketplaceOrder.update({
        where: { id },
        data: { status: 'delivered' },
      })

      // Notify buyer that their order has been delivered
      await db.notification.create({
        data: {
          userId: order.buyerId,
          type: 'item_sold',
          title: 'Order Delivered!',
          message: `Your order for "${order.listing.title}" has been marked as delivered. Please confirm receipt.`,
          data: JSON.stringify({ orderId: order.id, action: 'confirm_delivery' }),
        },
      })

      // Audit log
      await createAuditLog({
        action: 'marketplace_order.delivered',
        actorId: user.id,
        actorRole: 'seller',
        resourceType: 'marketplace_order',
        resourceId: order.id,
        description: `Seller marked order as delivered: ${order.listing.title}`,
        metadata: { orderId: order.id, listingId: order.listingId },
      })

      return NextResponse.json({ success: true, status: 'delivered' })
    }

    // ── confirm_delivery: Buyer confirms they received the item ──
    if (action === 'confirm_delivery') {
      // Only buyer can confirm
      if (order.buyerId !== user.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
      if (order.status !== 'delivered' && order.status !== 'paid') {
        return NextResponse.json({ error: 'Order not in deliverable state' }, { status: 400 })
      }

      // Update order status
      await db.marketplaceOrder.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date(), paymentStatus: 'released' },
      })

      // Credit seller wallet
      let sellerWallet = await db.sellerWallet.findUnique({ where: { userId: order.sellerId } })
      if (!sellerWallet) {
        sellerWallet = await db.sellerWallet.create({
          data: { userId: order.sellerId, balance: order.sellerPayout, totalEarned: order.sellerPayout },
        })
      } else {
        sellerWallet = await db.sellerWallet.update({
          where: { id: sellerWallet.id },
          data: { balance: { increment: order.sellerPayout }, totalEarned: { increment: order.sellerPayout } },
        })
      }

      // Credit platform wallet
      let platformWallet = await db.platformWallet.findFirst()
      if (!platformWallet) {
        platformWallet = await db.platformWallet.create({
          data: { balance: order.platformFee, totalEarned: order.platformFee },
        })
      } else {
        platformWallet = await db.platformWallet.update({
          where: { id: platformWallet.id },
          data: { balance: { increment: order.platformFee }, totalEarned: { increment: order.platformFee }, lastUpdatedAt: new Date() },
        })
      }

      // Create wallet transaction for seller
      await db.walletTransaction.create({
        data: {
          walletId: sellerWallet.id,
          sellerWalletId: sellerWallet.id,
          type: 'marketplace_sale',
          amount: order.sellerPayout,
          balance: sellerWallet.balance,
          reference: order.id,
          description: `Sale of "${order.listing.title}"`,
          metadata: JSON.stringify({ orderId: order.id, listingId: order.listingId, platformFee: order.platformFee }),
        },
      })

      // Mark listing as sold
      await db.listing.update({
        where: { id: order.listingId },
        data: { status: 'sold' },
      })

      // Notify seller
      await db.notification.create({
        data: {
          userId: order.sellerId,
          type: 'item_sold',
          title: 'Payment Received!',
          message: `Your buyer confirmed delivery for "${order.listing.title}". ₦${order.sellerPayout.toLocaleString()} has been credited to your wallet.`,
          data: JSON.stringify({ orderId: order.id, amount: order.sellerPayout }),
        },
      })

      // Audit log
      await createAuditLog({
        action: 'marketplace_order.completed',
        actorId: user.id,
        actorRole: 'buyer',
        resourceType: 'marketplace_order',
        resourceId: order.id,
        description: `Marketplace order completed: ${order.listing.title}`,
        metadata: { amount: order.amount, sellerPayout: order.sellerPayout, platformFee: order.platformFee },
      })

      return NextResponse.json({ success: true, status: 'completed' })
    }

    // ── cancel: Cancel the order ──
    if (action === 'cancel') {
      if (order.buyerId !== user.id && order.sellerId !== user.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
      if (order.status === 'completed' || order.status === 'cancelled') {
        return NextResponse.json({ error: 'Order already completed/cancelled' }, { status: 400 })
      }

      await db.marketplaceOrder.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason || 'Cancelled by user' },
      })

      // Refund if escrow was held
      if (order.paymentStatus === 'escrow' && order.paymentMethod === 'flutterwave') {
        try {
          const { initiateRefund } = await import('@/lib/flutterwave')
          await initiateRefund({
            transactionId: order.paymentReference || '',
            txRef: `REFUND_ORDER_${order.id}`,
          })
        } catch (err) {
          console.error('[orders] Refund failed:', err)
        }
        await db.marketplaceOrder.update({
          where: { id },
          data: { paymentStatus: 'refunded' },
        })
      }

      // Audit log
      await createAuditLog({
        action: 'marketplace_order.cancelled',
        actorId: user.id,
        actorRole: order.buyerId === user.id ? 'buyer' : 'seller',
        resourceType: 'marketplace_order',
        resourceId: order.id,
        description: `Marketplace order cancelled: ${order.listing.title}`,
        metadata: { reason: reason || 'Cancelled by user', orderId: order.id },
      })

      return NextResponse.json({ success: true })
    }

    // ── dispute: Flag for admin review ──
    if (action === 'dispute') {
      if (order.buyerId !== user.id && order.sellerId !== user.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
      if (order.status === 'completed' || order.status === 'cancelled') {
        return NextResponse.json({ error: 'Cannot dispute a completed/cancelled order' }, { status: 400 })
      }

      await db.marketplaceOrder.update({
        where: { id },
        data: { status: 'disputed', cancelReason: reason || 'Dispute raised' },
      })

      // Create report for admin
      await db.report.create({
        data: {
          reporterId: user.id,
          listingId: order.listingId,
          reason: 'dispute',
          status: 'pending',
        },
      })

      // Audit log
      await createAuditLog({
        action: 'marketplace_order.disputed',
        actorId: user.id,
        actorRole: order.buyerId === user.id ? 'buyer' : 'seller',
        resourceType: 'marketplace_order',
        resourceId: order.id,
        description: `Dispute raised on order: ${order.listing.title}`,
        metadata: { reason: reason || 'Dispute raised', orderId: order.id },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[orders] Update error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

// GET /api/orders/[id] — Get a single order by ID
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { auth } = await import('@clerk/nextjs/server')
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    if (!isDatabaseAvailable()) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

    const { id } = await params

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            images: true,
            condition: true,
            status: true,
          },
        },
        buyer: {
          select: { id: true, username: true, avatar: true },
        },
        seller: {
          select: { id: true, username: true, avatar: true },
        },
        store: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Only buyer, seller, or admin can view the order
    if (order.buyerId !== user.id && order.sellerId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('[orders] Get error:', error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
