import type { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, DeliveryOrderStatus } from './delivery-types'
import { setRunnerLocation, removeRunnerLocation, setRunnerStatus, getRunnerStatus, findNearbyRunners, addDeliveryWatcher, removeDeliveryWatcher, getDeliveryWatchers, runnerHeartbeat } from './redis-location'
import { isRedisAvailable } from './redis'
import { logger } from './utils'
import { isDatabaseAvailable, db } from './db'
import { UNILAG_SERVICE_AREA, isInsideUnilagBoundary, estimateCampusTrip } from './runner-dispatch'
import { verifySocketToken } from './socket-auth'
import { notifyRunnerAssigned, notifyPackagePickedUp, notifyDeliveryDelivered, notifyDeliveryCancelled, notifyOfferAccepted } from './push-notifications'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface InterServerEvents {}
interface SocketData { userId: string; username: string; role: string; isRunner: boolean; connectedAt: number }
type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

let io: TypedServer | null = null
export function getIO(): TypedServer | null { return io }
export function isSocketIOReady(): boolean { return io !== null }

// ── Event rate limiting (in-memory, per-socket) ──
const eventRateLimits = new Map<string, { count: number; resetAt: number }>()

function checkEventRate(socketId: string, event: string, maxPerMinute: number = 30): boolean {
  const key = `${socketId}:${event}`
  const now = Date.now()
  const entry = eventRateLimits.get(key)

  if (!entry || now > entry.resetAt) {
    eventRateLimits.set(key, { count: 1, resetAt: now + 60000 })
    return true
  }

  entry.count++
  if (entry.count > maxPerMinute) {
    return false
  }
  return true
}

// Cleanup rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of eventRateLimits) {
    if (now > val.resetAt + 60000) eventRateLimits.delete(key)
  }
}, 300000)

export function initSocketIO(httpServer: HTTPServer): TypedServer {
  if (io) return io
  const corsOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: { origin: [corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'], methods: ['GET', 'POST'], credentials: true },
    pingInterval: 10000, pingTimeout: 5000, connectTimeout: 10000, maxHttpBufferSize: 1e6, transports: ['websocket', 'polling'],
  })

  // ── AUTH MIDDLEWARE: Verify signed token (ONLY) ──
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined
    if (!token) {
      return next(new Error('Authentication required: provide a signed token from /api/auth/socket-token'))
    }

    const result = verifySocketToken(token)
    if (result.valid && result.payload) {
      socket.data = {
        userId: result.payload.userId,
        username: result.payload.username,
        role: result.payload.role,
        isRunner: result.payload.isRunner,
        connectedAt: Date.now(),
      }
      return next()
    }

    return next(new Error('Authentication failed: invalid or expired token. Fetch a new token from /api/auth/socket-token'))
  })

  io.on('connection', (socket) => {
    const { userId, username, isRunner } = socket.data
    logger.log(`[socket] Connected: ${username} (${userId}) [runner=${isRunner}]`)

    if (isRunner) {
      socket.join(`runner:${userId}`)

      socket.on('runner:location', async (data) => {
        if (!checkEventRate(socket.id, 'runner:location', 60)) {
          socket.emit('error', { message: 'Rate limit: too many location updates', code: 'RATE_LIMITED' })
          return
        }
        const { lat, lng, heading, speed } = data
        if (!isInsideUnilagBoundary({ lat, lng })) { socket.emit('error', { message: 'Location outside UNILAG campus boundary', code: 'OUT_OF_BOUNDS' }); return }
        await setRunnerLocation(userId, lat, lng, heading, speed)
        try {
          if (isDatabaseAvailable()) {
            const activeDelivery = await db.deliveryOrder.findFirst({ where: { assignedRunnerId: userId, status: { in: ['runner_en_route', 'picked_up', 'in_transit'] } }, select: { id: true } })
            if (activeDelivery) { io!.to(`delivery:${activeDelivery.id}`).emit('runner:location-update', { orderId: activeDelivery.id, runnerId: userId, lat, lng, heading: heading ?? null, speed: speed ?? null, updatedAt: Date.now() }) }
          }
        } catch {}
      })

      socket.on('runner:status', async (data) => {
        if (!checkEventRate(socket.id, 'runner:status', 10)) return
        await setRunnerStatus(userId, data.status)
        if (data.status === 'available') { socket.join('runners:available') } else { socket.leave('runners:available') }
      })

      socket.on('runner:heartbeat', async () => {
        await runnerHeartbeat(userId)
      })

      socket.on('delivery:offer', async (data) => {
        if (!checkEventRate(socket.id, 'delivery:offer', 15)) {
          socket.emit('error', { message: 'Rate limit: too many offers', code: 'RATE_LIMITED' })
          return
        }
        const { orderId, runnerPrice, estimatedArrivalMinutes, message } = data
        try {
          if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }
          // Validate runnerPrice
          if (!runnerPrice || runnerPrice < 100 || runnerPrice > 50000) {
            socket.emit('error', { message: 'Invalid price (100-50000)', code: 'INVALID_PRICE' }); return
          }
          const order = await db.deliveryOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true, customerId: true } })
          if (!order || order.status !== 'searching') { socket.emit('error', { message: 'Order not available for offers', code: 'ORDER_UNAVAILABLE' }); return }
          const expiresAt = new Date(Date.now() + 30 * 1000)
          const sanitizedMessage = message ? String(message).trim().slice(0, 500) : null
          // Upsert offer — allow runners to counter-offer (fixes unique constraint bug)
          const existing = await db.deliveryOffer.findUnique({ where: { orderId_runnerId: { orderId, runnerId: userId } } })
          let offer
          if (existing && existing.status === 'open') {
            offer = await db.deliveryOffer.update({
              where: { id: existing.id },
              data: { runnerPrice, estimatedArrivalMinutes: estimatedArrivalMinutes ?? null, message: sanitizedMessage, expiresAt },
              include: { runner: { select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true, runnerProfile: { select: { transportMode: true } } } } }
            })
          } else {
            offer = await db.deliveryOffer.create({
              data: { orderId, runnerId: userId, runnerPrice, estimatedArrivalMinutes: estimatedArrivalMinutes ?? null, message: sanitizedMessage, status: 'open', expiresAt },
              include: { runner: { select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true, runnerProfile: { select: { transportMode: true } } } } }
            })
          }
          io!.to(`customer:${order.customerId}`).emit('delivery:offer-received', { offerId: offer.id, orderId, runnerId: userId, runnerUsername: offer.runner.username, runnerAvatar: offer.runner.avatar, runnerRating: offer.runner.runnerRating, runnerTasksCompleted: offer.runner.tasksCompleted, runnerTransportMode: (offer.runner.runnerProfile?.transportMode as any) || 'walking', runnerPrice, estimatedArrivalMinutes: estimatedArrivalMinutes ?? null, message: sanitizedMessage, expiresAt: expiresAt.toISOString() })
        } catch (err) { socket.emit('error', { message: 'Failed to create offer', code: 'OFFER_ERROR' }) }
      })

      socket.on('delivery:runner-en-route', async (data) => {
        try {
          if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }
          const order = await db.deliveryOrder.findUnique({ where: { id: data.orderId }, select: { status: true, assignedRunnerId: true, customerId: true } })
          if (!order || order.assignedRunnerId !== userId) { socket.emit('error', { message: 'Not authorized', code: 'UNAUTHORIZED' }); return }
          if (order.status !== 'runner_assigned') { socket.emit('error', { message: 'Invalid status', code: 'INVALID_STATUS' }); return }
          const now = new Date()
          await db.deliveryOrder.update({ where: { id: data.orderId }, data: { status: 'runner_en_route' } })
          await db.orderStatusLog.create({ data: { orderId: data.orderId, fromStatus: 'runner_assigned', toStatus: 'runner_en_route', metadata: JSON.stringify({ runnerId: userId }) } })
          io!.to(`delivery:${data.orderId}`).emit('delivery:status', { orderId: data.orderId, status: 'runner_en_route', timestamp: now.toISOString(), metadata: { runnerId: userId } })
        } catch (err) { socket.emit('error', { message: 'Failed to update status', code: 'STATUS_ERROR' }) }
      })

      socket.on('delivery:in-transit', async (data) => {
        try {
          if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }
          const order = await db.deliveryOrder.findUnique({ where: { id: data.orderId }, select: { status: true, assignedRunnerId: true, customerId: true } })
          if (!order || order.assignedRunnerId !== userId) { socket.emit('error', { message: 'Not authorized', code: 'UNAUTHORIZED' }); return }
          if (order.status !== 'picked_up') { socket.emit('error', { message: 'Invalid status', code: 'INVALID_STATUS' }); return }
          const now = new Date()
          await db.deliveryOrder.update({ where: { id: data.orderId }, data: { status: 'in_transit' } })
          await db.orderStatusLog.create({ data: { orderId: data.orderId, fromStatus: 'picked_up', toStatus: 'in_transit', metadata: JSON.stringify({ runnerId: userId }) } })
          io!.to(`delivery:${data.orderId}`).emit('delivery:status', { orderId: data.orderId, status: 'in_transit', timestamp: now.toISOString(), metadata: { runnerId: userId } })
        } catch (err) { socket.emit('error', { message: 'Failed to update status', code: 'STATUS_ERROR' }) }
      })

      socket.on('delivery:pickup', async (data) => {
        try {
          if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }
          const order = await db.deliveryOrder.findUnique({ where: { id: data.orderId }, select: { pickupCode: true, status: true, assignedRunnerId: true, customerId: true } })
          if (!order || order.assignedRunnerId !== userId) { socket.emit('error', { message: 'Not authorized', code: 'UNAUTHORIZED' }); return }
          if (order.status !== 'runner_en_route') { socket.emit('error', { message: 'Invalid status', code: 'INVALID_STATUS' }); return }
          if (order.pickupCode !== data.pickupCode) { socket.emit('error', { message: 'Invalid pickup code', code: 'INVALID_PICKUP_CODE' }); return }
          const now = new Date()
          await db.deliveryOrder.update({ where: { id: data.orderId }, data: { status: 'picked_up', pickedUpAt: now } })
          await db.orderStatusLog.create({ data: { orderId: data.orderId, fromStatus: 'runner_en_route', toStatus: 'picked_up', metadata: JSON.stringify({ runnerId: userId }) } })
          io!.to(`delivery:${data.orderId}`).emit('delivery:status', { orderId: data.orderId, status: 'picked_up', timestamp: now.toISOString(), metadata: { runnerId: userId } })
          await setRunnerStatus(userId, 'busy'); socket.leave('runners:available')
          // Push notification
          notifyPackagePickedUp(order.customerId, data.orderId).catch(() => {})
        } catch (err) { socket.emit('error', { message: 'Pickup failed', code: 'PICKUP_ERROR' }) }
      })

      socket.on('delivery:dropoff', async (data) => {
        try {
          if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }
          const order = await db.deliveryOrder.findUnique({ where: { id: data.orderId }, select: { status: true, assignedRunnerId: true, customerId: true } })
          if (!order || order.assignedRunnerId !== userId) { socket.emit('error', { message: 'Not authorized', code: 'UNAUTHORIZED' }); return }
          if (order.status !== 'in_transit') { socket.emit('error', { message: 'Invalid status', code: 'INVALID_STATUS' }); return }
          const now = new Date()
          await db.deliveryOrder.update({ where: { id: data.orderId }, data: { status: 'delivered', deliveredAt: now } })
          await db.orderStatusLog.create({ data: { orderId: data.orderId, fromStatus: 'in_transit', toStatus: 'delivered', metadata: JSON.stringify({ runnerId: userId }) } })
          io!.to(`delivery:${data.orderId}`).emit('delivery:status', { orderId: data.orderId, status: 'delivered', timestamp: now.toISOString(), metadata: { runnerId: userId } })
          // Push notification
          notifyDeliveryDelivered(order.customerId, data.orderId).catch(() => {})
        } catch (err) { socket.emit('error', { message: 'Dropoff failed', code: 'DROPOFF_ERROR' }) }
      })
    }

    socket.join(`customer:${userId}`)

    socket.on('delivery:create', async (data) => {
      if (!checkEventRate(socket.id, 'delivery:create', 5)) {
        socket.emit('error', { message: 'Rate limit: too many delivery requests', code: 'RATE_LIMITED' })
        return
      }
      try {
        if (!isInsideUnilagBoundary({ lat: data.pickupLat, lng: data.pickupLng }) || !isInsideUnilagBoundary({ lat: data.dropoffLat, lng: data.dropoffLng })) { socket.emit('error', { message: 'Route outside campus', code: 'OUT_OF_BOUNDS' }); return }
        if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }
        // Validate price
        if (!data.customerPrice || data.customerPrice < 100 || data.customerPrice > 50000) {
          socket.emit('error', { message: 'Invalid price (₦100-₦50,000)', code: 'INVALID_PRICE' }); return
        }
        const trip = estimateCampusTrip({ lat: data.pickupLat, lng: data.pickupLng }, { lat: data.dropoffLat, lng: data.dropoffLng })
        const pickupCode = String(Math.floor(1000 + Math.random() * 9000))
        // Sanitize text inputs
        const sanitizedTitle = String(data.title || '').trim().slice(0, 200)
        const sanitizedDesc = data.description ? String(data.description).trim().slice(0, 2000) : ''
        const sanitizedPickupAddr = String(data.pickupAddress || '').trim().slice(0, 300)
        const sanitizedDropoffAddr = String(data.dropoffAddress || '').trim().slice(0, 300)
        const order = await db.deliveryOrder.create({ data: { customerId: userId, status: 'searching', pickupLat: data.pickupLat, pickupLng: data.pickupLng, pickupAddress: sanitizedPickupAddr, dropoffLat: data.dropoffLat, dropoffLng: data.dropoffLng, dropoffAddress: sanitizedDropoffAddr, serviceArea: 'unilag', estimatedDistanceMeters: trip.estimatedDistanceMeters, estimatedDurationMinutes: trip.estimatedDurationMinutes, customerPrice: data.customerPrice, surgeMultiplier: 1.0, platformCommission: Math.round(data.customerPrice * 0.12), cancellationFee: 0, pickupCode, category: data.category, urgency: data.urgency, title: sanitizedTitle, description: sanitizedDesc, itemImages: JSON.stringify(data.itemImages || []), searchingAt: new Date() } })
        await db.orderStatusLog.create({ data: { orderId: order.id, fromStatus: null, toStatus: 'searching', metadata: JSON.stringify({ customerId: userId }) } })
        socket.join(`delivery:${order.id}`)
        const search = await findNearbyRunners(data.pickupLat, data.pickupLng, 10)
        if (search.found) { for (const runner of search.runners) { io!.to(`runner:${runner.runnerId}`).emit('delivery:request', { orderId: order.id, customerPrice: data.customerPrice, category: data.category, urgency: data.urgency, title: sanitizedTitle, pickupLat: data.pickupLat, pickupLng: data.pickupLng, pickupAddress: sanitizedPickupAddr, dropoffLat: data.dropoffLat, dropoffLng: data.dropoffLng, dropoffAddress: sanitizedDropoffAddr, estimatedDistanceMeters: trip.estimatedDistanceMeters, estimatedDurationMinutes: trip.estimatedDurationMinutes, surgeMultiplier: 1.0 }) } }
        socket.emit('delivery:status', { orderId: order.id, status: 'searching', timestamp: new Date().toISOString(), metadata: { nearbyRunnerCount: search.runners.length } })
      } catch (err) { socket.emit('error', { message: 'Failed to create delivery', code: 'CREATE_ERROR' }) }
    })

    socket.on('delivery:accept-offer', async (data) => {
      try {
        if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }
        const offer = await db.deliveryOffer.findUnique({ where: { id: data.offerId }, include: { order: { select: { customerId: true, status: true } } } })
        if (!offer || offer.order.customerId !== userId) { socket.emit('error', { message: 'Not authorized', code: 'UNAUTHORIZED' }); return }
        if (offer.order.status !== 'searching') { socket.emit('error', { message: 'Order unavailable', code: 'ORDER_UNAVAILABLE' }); return }
        await db.deliveryOffer.update({ where: { id: data.offerId }, data: { status: 'accepted' } })
        await db.deliveryOffer.updateMany({ where: { orderId: data.orderId, status: 'open', id: { not: data.offerId } }, data: { status: 'rejected' } })
        const now = new Date()
        await db.deliveryOrder.update({ where: { id: data.orderId }, data: { status: 'runner_assigned', assignedRunnerId: offer.runnerId, finalPrice: offer.runnerPrice, assignedAt: now } })
        await db.orderStatusLog.create({ data: { orderId: data.orderId, fromStatus: 'searching', toStatus: 'runner_assigned', metadata: JSON.stringify({ runnerId: offer.runnerId }) } })
        const order = await db.deliveryOrder.findUnique({ where: { id: data.orderId }, select: { pickupLat: true, pickupLng: true, pickupAddress: true, pickupCode: true } })
        io!.to(`runner:${offer.runnerId}`).emit('delivery:offer-accepted', { orderId: data.orderId, customerUsername: socket.data.username, customerAvatar: null, customerPhone: null, pickupLat: order?.pickupLat ?? 0, pickupLng: order?.pickupLng ?? 0, pickupAddress: order?.pickupAddress ?? '', pickupCode: order?.pickupCode ?? '' })
        io!.to(`delivery:${data.orderId}`).emit('delivery:status', { orderId: data.orderId, status: 'runner_assigned', timestamp: now.toISOString(), metadata: { runnerId: offer.runnerId } })
        // Push notifications
        notifyRunnerAssigned(offer.runnerId, socket.data.username, data.orderId).catch(() => {})
        notifyOfferAccepted(offer.runnerId, data.orderId).catch(() => {})
      } catch (err) { socket.emit('error', { message: 'Failed to accept offer', code: 'ACCEPT_ERROR' }) }
    })

    socket.on('delivery:reject-offer', async (data) => {
      try { if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }; await db.deliveryOffer.update({ where: { id: data.offerId }, data: { status: 'rejected' } }); const offer = await db.deliveryOffer.findUnique({ where: { id: data.offerId }, select: { runnerId: true } }); if (offer) io!.to(`runner:${offer.runnerId}`).emit('delivery:offer-rejected', { orderId: data.orderId }) } catch (err) { socket.emit('error', { message: 'Failed to reject offer', code: 'REJECT_ERROR' }) }
    })

    socket.on('delivery:confirm', async (data) => {
      try {
        if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }
        const order = await db.deliveryOrder.findUnique({ where: { id: data.orderId }, select: { status: true, customerId: true, assignedRunnerId: true, finalPrice: true, customerPrice: true, paymentStatus: true } })
        if (!order || order.customerId !== userId) { socket.emit('error', { message: 'Not authorized', code: 'UNAUTHORIZED' }); return }
        if (order.status !== 'delivered') { socket.emit('error', { message: 'Not yet delivered', code: 'INVALID_STATUS' }); return }
        // Validate rating
        const rating = data.rating ? Math.min(5, Math.max(1, Math.round(data.rating))) : null
        const review = data.review ? String(data.review).trim().slice(0, 1000) : null
        const now = new Date()
        // Atomic status guard: only update if still 'delivered' (prevents double-confirm)
        const confirmResult = await db.deliveryOrder.updateMany({ where: { id: data.orderId, status: 'delivered' }, data: { status: 'completed', completedAt: now, customerRating: rating, customerReview: review } })
        if (confirmResult.count === 0) { socket.emit('error', { message: 'Already confirmed', code: 'ALREADY_CONFIRMED' }); return }
        await db.orderStatusLog.create({ data: { orderId: data.orderId, fromStatus: 'delivered', toStatus: 'completed', metadata: JSON.stringify({ rating }) } })
        if (order.assignedRunnerId) {
          const runner = await db.user.findUnique({ where: { id: order.assignedRunnerId }, select: { tasksCompleted: true, runnerRating: true, totalReviews: true } })
          if (runner && rating) { const n = runner.totalReviews + 1; await db.user.update({ where: { id: order.assignedRunnerId }, data: { tasksCompleted: runner.tasksCompleted + 1, runnerRating: Math.round(((runner.runnerRating * runner.totalReviews + rating) / n) * 10) / 10, totalReviews: n } }) }
          await setRunnerStatus(order.assignedRunnerId, 'available')
        }
        // Release escrow payment to runner (releaseEscrow has its own atomic guard)
        if (order.paymentStatus === 'escrow') {
          const { releaseEscrow } = await import('./escrow')
          releaseEscrow(data.orderId).catch(err => console.error('[socket] Escrow release failed:', err))
        }
        io!.to(`delivery:${data.orderId}`).emit('delivery:status', { orderId: data.orderId, status: 'completed', timestamp: now.toISOString(), metadata: { rating } })
      } catch (err) { socket.emit('error', { message: 'Confirmation failed', code: 'CONFIRM_ERROR' }) }
    })

    socket.on('delivery:cancel', async (data) => {
      try {
        if (!isDatabaseAvailable()) { socket.emit('error', { message: 'Database unavailable', code: 'DB_UNAVAILABLE' }); return }
        const order = await db.deliveryOrder.findUnique({ where: { id: data.orderId }, select: { status: true, customerId: true, assignedRunnerId: true, paymentStatus: true } })
        if (!order) { socket.emit('error', { message: 'Not found', code: 'NOT_FOUND' }); return }
        if (order.customerId !== userId && order.assignedRunnerId !== userId) { socket.emit('error', { message: 'Not authorized', code: 'UNAUTHORIZED' }); return }
        if (order.status === 'completed' || order.status === 'cancelled') { socket.emit('error', { message: 'Already done', code: 'INVALID_STATUS' }); return }
        const reason = data.reason ? String(data.reason).trim().slice(0, 500) : null
        const now = new Date()
        // Atomic status guard: only update if not already completed/cancelled (prevents double-cancel)
        const cancelResult = await db.deliveryOrder.updateMany({ where: { id: data.orderId, status: { notIn: ['completed', 'cancelled'] } }, data: { status: 'cancelled', cancelledAt: now, cancelReason: reason, cancelledBy: userId } })
        if (cancelResult.count === 0) { socket.emit('error', { message: 'Already completed or cancelled', code: 'ALREADY_DONE' }); return }
        await db.orderStatusLog.create({ data: { orderId: data.orderId, fromStatus: order.status as DeliveryOrderStatus, toStatus: 'cancelled', metadata: JSON.stringify({ reason, cancelledBy: userId }) } })
        if (order.assignedRunnerId) await setRunnerStatus(order.assignedRunnerId, 'available')
        // Refund escrow if payment was held (refundEscrow has its own atomic guard)
        if (order.paymentStatus === 'escrow') {
          const { refundEscrow } = await import('./escrow')
          refundEscrow(data.orderId, reason || 'Cancelled by user').catch(err => console.error('[socket] Escrow refund failed:', err))
        }
        io!.to(`delivery:${data.orderId}`).emit('delivery:status', { orderId: data.orderId, status: 'cancelled', timestamp: now.toISOString(), metadata: { reason } })
        // Push notifications
        const otherUserId = order.customerId === userId ? order.assignedRunnerId : order.customerId
        if (otherUserId) notifyDeliveryCancelled(otherUserId, reason || 'Delivery cancelled', data.orderId).catch(() => {})
      } catch (err) { socket.emit('error', { message: 'Cancellation failed', code: 'CANCEL_ERROR' }) }
    })

    socket.on('delivery:watch', async (data) => { socket.join(`delivery:${data.orderId}`); await addDeliveryWatcher(data.orderId, socket.id) })
    socket.on('delivery:unwatch', async (data) => { socket.leave(`delivery:${data.orderId}`); await removeDeliveryWatcher(data.orderId, socket.id) })

    socket.on('disconnect', async () => {
      if (isRunner) await removeRunnerLocation(userId)
      // Clean up rate limit entries for this socket
      for (const key of eventRateLimits.keys()) {
        if (key.startsWith(`${socket.id}:`)) eventRateLimits.delete(key)
      }
    })
  })

  logger.log('[socket] Socket.io server initialized (token-based auth enabled)')
  return io
}
