import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'
import { rateLimits } from '@/lib/rate-limit'
import { validateBody, DeliveryCreateSchema } from '@/lib/validation'
import { sanitizeText, sanitizeDescription } from '@/lib/sanitize'

// GET /api/deliveries — List deliveries for a customer
export async function GET(req: NextRequest) {
  // 1. Auth check
  const { userId, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // 2. Rate limit
  const rl = await rateLimits.standard(req)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
    }

    // 3. Verify customerId matches authenticated user
    if (customerId !== userId) {
      return NextResponse.json({ error: 'You can only view your own deliveries' }, { status: 403 })
    }

    const where: any = { customerId }
    if (status) {
      const statuses = status.split(',')
      where.status = { in: statuses }
    }

    const [orders, total] = await Promise.all([
      db.deliveryOrder.findMany({
        where,
        include: {
          assignedRunner: {
            select: { id: true, username: true, avatar: true, runnerRating: true, runnerProfile: { select: { transportMode: true } } },
          },
          offers: {
            where: { status: 'open' },
            include: { runner: { select: { id: true, username: true, avatar: true, runnerRating: true, tasksCompleted: true, runnerProfile: { select: { transportMode: true } } } } },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.deliveryOrder.count({ where }),
    ])

    return NextResponse.json({ deliveries: orders, total, limit, offset })
  } catch (error) {
    console.error('[deliveries] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 })
  }
}

// POST /api/deliveries — Create a new delivery order
export async function POST(req: NextRequest) {
  // 1. Auth check
  const { userId, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // 2. Rate limit (stricter for creation)
  const rl = await rateLimits.delivery(req)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const body = await req.json()

    // 3. Validate input
    const { data, error } = validateBody(DeliveryCreateSchema, body)
    if (error) return error

    // 4. Use authenticated userId as customerId (ignore body.customerId)
    const customerId = userId!

    // Sanitize text inputs
    const sanitizedTitle = sanitizeText(data.title, 200)
    const sanitizedDesc = sanitizeDescription(data.description || '', 2000)
    const sanitizedPickupAddr = sanitizeText(data.pickupAddress, 300)
    const sanitizedDropoffAddr = sanitizeText(data.dropoffAddress, 300)

    const lat = data.pickupLat
    const lng = data.pickupLng
    const dLat = data.dropoffLat
    const dLng = data.dropoffLng

    // Calculate trip estimates
    const latDiffKm = (dLat - lat) * 111
    const lngDiffKm = (dLng - lng) * 111 * Math.cos(((lat + dLat) / 2) * Math.PI / 180)
    const distanceKm = Math.sqrt(latDiffKm ** 2 + lngDiffKm ** 2)
    const estimatedDistanceMeters = Math.round(distanceKm * 1000)
    const estimatedDurationMinutes = Math.max(3, Math.round((distanceKm / 12) * 60))

    // Generate pickup code
    const pickupCode = String(Math.floor(1000 + Math.random() * 9000))

    const order = await db.deliveryOrder.create({
      data: {
        customerId,
        status: 'searching',
        pickupLat: lat,
        pickupLng: lng,
        pickupAddress: sanitizedPickupAddr,
        dropoffLat: dLat,
        dropoffLng: dLng,
        dropoffAddress: sanitizedDropoffAddr,
        serviceArea: 'unilag',
        estimatedDistanceMeters,
        estimatedDurationMinutes,
        customerPrice: data.customerPrice,
        finalPrice: null,
        surgeMultiplier: 1.0,
        platformCommission: Math.round(data.customerPrice * 0.12),
        cancellationFee: 0,
        pickupCode,
        category: data.category,
        urgency: data.urgency,
        title: sanitizedTitle,
        description: sanitizedDesc,
        itemImages: JSON.stringify(data.itemImages || []),
        searchingAt: new Date(),
      },
    })

    // Log status change
    await db.orderStatusLog.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: 'searching',
        metadata: JSON.stringify({ customerId }),
      },
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error('[deliveries] POST error:', error)
    return NextResponse.json({ error: 'Failed to create delivery' }, { status: 500 })
  }
}
