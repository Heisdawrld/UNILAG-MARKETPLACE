import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const xCronSecret = req.headers.get('x-cron-secret')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && xCronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }

  const now = new Date()
  const results = { staleSearches: 0, runnerNoShows: 0, stuckDeliveries: 0, unpaidTimeouts: 0 }

  try {
    // 1. Cancel stale searching orders (>5 min, no offers)
    const staleSearches = await db.deliveryOrder.findMany({
      where: {
        status: 'searching',
        searchingAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) },
      },
      select: { id: true },
    })
    for (const order of staleSearches) {
      await db.deliveryOrder.update({
        where: { id: order.id },
        data: { status: 'cancelled', cancelledAt: now, cancelReason: 'No runners available', cancelledBy: 'system' },
      })
      await db.orderStatusLog.create({
        data: { orderId: order.id, fromStatus: 'searching', toStatus: 'cancelled', metadata: JSON.stringify({ reason: 'timeout_no_runners' }) },
      })
      // Notify customer via socket if possible
      try {
        const { getIO } = await import('@/lib/socket-server')
        const io = getIO()
        if (io) {
          const fullOrder = await db.deliveryOrder.findUnique({ where: { id: order.id }, select: { customerId: true } })
          if (fullOrder) {
            io.to(`customer:${fullOrder.customerId}`).emit('delivery:unavailable', { orderId: order.id })
            io.to(`delivery:${order.id}`).emit('delivery:status', { orderId: order.id, status: 'cancelled', timestamp: now.toISOString(), metadata: { reason: 'No runners available' } })
          }
        }
      } catch {}
      results.staleSearches++
    }

    // 2. Cancel runner no-shows (>15 min assigned/en_route without pickup)
    const runnerNoShows = await db.deliveryOrder.findMany({
      where: {
        status: { in: ['runner_assigned', 'runner_en_route'] },
        assignedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
      },
      select: { id: true, assignedRunnerId: true },
    })
    for (const order of runnerNoShows) {
      await db.deliveryOrder.update({
        where: { id: order.id },
        data: { status: 'cancelled', cancelledAt: now, cancelReason: 'Runner no-show', cancelledBy: 'system' },
      })
      await db.orderStatusLog.create({
        data: { orderId: order.id, fromStatus: 'runner_en_route', toStatus: 'cancelled', metadata: JSON.stringify({ reason: 'runner_no_show', runnerId: order.assignedRunnerId }) },
      })
      // Make runner available again
      if (order.assignedRunnerId) {
        try {
          const { setRunnerStatus } = await import('@/lib/redis-location')
          await setRunnerStatus(order.assignedRunnerId, 'available')
        } catch {}
      }
      // Refund escrow if held
      try {
        const fullOrder = await db.deliveryOrder.findUnique({ where: { id: order.id }, select: { paymentStatus: true, customerId: true } })
        if (fullOrder?.paymentStatus === 'escrow') {
          try {
            const { refundEscrow } = await import('@/lib/escrow')
            await refundEscrow(order.id, 'Runner no-show - auto-cancelled')
          } catch {}
        }
        // Notify via socket
        try {
          const { getIO } = await import('@/lib/socket-server')
          const io = getIO()
          if (io && fullOrder) {
            io.to(`customer:${fullOrder.customerId}`).emit('delivery:status', { orderId: order.id, status: 'cancelled', timestamp: now.toISOString(), metadata: { reason: 'Runner no-show' } })
            io.to(`delivery:${order.id}`).emit('delivery:status', { orderId: order.id, status: 'cancelled', timestamp: now.toISOString(), metadata: { reason: 'Runner no-show' } })
          }
        } catch {}
      } catch {}
      results.runnerNoShows++
    }

    // 3. Flag stuck deliveries for admin review (>60 min in transit)
    const stuckDeliveries = await db.deliveryOrder.findMany({
      where: {
        status: { in: ['picked_up', 'in_transit'] },
        pickedUpAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) },
      },
      select: { id: true },
    })
    results.stuckDeliveries = stuckDeliveries.length
    // Log stuck deliveries for admin review
    for (const order of stuckDeliveries) {
      try {
        await db.orderStatusLog.create({
          data: { orderId: order.id, fromStatus: null, toStatus: 'admin_review', metadata: JSON.stringify({ reason: 'stuck_delivery', flaggedAt: now.toISOString() }) },
        })
      } catch {}
    }

    // 4. Cancel unpaid orders after runner assigned (>5 min)
    const unpaidTimeouts = await db.deliveryOrder.findMany({
      where: {
        status: 'runner_assigned',
        paymentStatus: 'unpaid',
        assignedAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) },
      },
      select: { id: true, assignedRunnerId: true },
    })
    for (const order of unpaidTimeouts) {
      await db.deliveryOrder.update({
        where: { id: order.id },
        data: { status: 'cancelled', cancelledAt: now, cancelReason: 'Payment timeout', cancelledBy: 'system' },
      })
      await db.orderStatusLog.create({
        data: { orderId: order.id, fromStatus: 'runner_assigned', toStatus: 'cancelled', metadata: JSON.stringify({ reason: 'payment_timeout' }) },
      })
      // Make runner available again
      if (order.assignedRunnerId) {
        try {
          const { setRunnerStatus } = await import('@/lib/redis-location')
          await setRunnerStatus(order.assignedRunnerId, 'available')
        } catch {}
      }
      // Notify via socket
      try {
        const { getIO } = await import('@/lib/socket-server')
        const io = getIO()
        if (io) {
          const fullOrder = await db.deliveryOrder.findUnique({ where: { id: order.id }, select: { customerId: true } })
          if (fullOrder) {
            io.to(`customer:${fullOrder.customerId}`).emit('delivery:status', { orderId: order.id, status: 'cancelled', timestamp: now.toISOString(), metadata: { reason: 'Payment timeout' } })
            io.to(`delivery:${order.id}`).emit('delivery:status', { orderId: order.id, status: 'cancelled', timestamp: now.toISOString(), metadata: { reason: 'Payment timeout' } })
          }
        }
      } catch {}
      results.unpaidTimeouts++
    }

    return NextResponse.json({ success: true, results, timestamp: now.toISOString() })
  } catch (error) {
    console.error('[cron/delivery-timeouts] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
