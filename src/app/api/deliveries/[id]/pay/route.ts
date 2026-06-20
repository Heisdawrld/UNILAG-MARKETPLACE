import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { rateLimits } from '@/lib/rate-limit'
import { initiateDeliveryPayment } from '@/lib/escrow'
import { isPaymentsEnabled } from '@/lib/flutterwave'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const rl = await rateLimits.write(req)
  if (!rl.success) return rl.response!

  const { id } = await params

  // Get the delivery order
  const order = await db.deliveryOrder.findUnique({
    where: { id },
    select: { id: true, customerId: true, paymentStatus: true, finalPrice: true, customerPrice: true },
  })

  if (!order) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  if (order.customerId !== userId) return NextResponse.json({ error: 'Not your delivery' }, { status: 403 })
  if (order.paymentStatus !== 'unpaid') return NextResponse.json({ error: 'Already paid' }, { status: 400 })

  const amount = order.finalPrice || order.customerPrice

  const result = await initiateDeliveryPayment(
    id,
    userId!,
    user!.email,
    user!.username,
    amount
  )

  // Audit log for payment initiation
  await createAuditLog({
    action: 'payment.initiated',
    actorId: userId!,
    actorRole: user!.role,
    resourceType: 'delivery',
    resourceId: id,
    description: `Payment initiated for delivery ${id}: ₦${amount.toLocaleString()}`,
    metadata: { amount, txRef: result.txRef, isLocked: result.isLocked },
  })

  return NextResponse.json({
    paymentLink: result.paymentLink || null,
    txRef: result.txRef,
    isLocked: result.isLocked,
    amount,
    commission: Math.round(amount * 0.12),
    runnerPayout: amount - Math.round(amount * 0.12),
  })
}
