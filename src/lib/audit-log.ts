/**
 * audit-log.ts — Enterprise audit logging service
 *
 * Every significant action (payment, admin action, delivery state change,
 * wallet mutation, role change) is logged to the AuditLog table for:
 * - Regulatory compliance
 * - Dispute resolution
 * - Fraud detection
 * - Analytics & reporting
 */

import { db, isDatabaseAvailable } from './db'

export type AuditAction =
  | 'payment.initiated'
  | 'payment.verified'
  | 'payment.refunded'
  | 'escrow.held'
  | 'escrow.released'
  | 'escrow.refunded'
  | 'payout.requested'
  | 'payout.completed'
  | 'payout.failed'
  | 'delivery.created'
  | 'delivery.status_changed'
  | 'delivery.cancelled'
  | 'delivery.confirmed'
  | 'runner.assigned'
  | 'runner.location_updated'
  | 'admin.user_updated'
  | 'admin.payout_approved'
  | 'admin.payout_rejected'
  | 'auth.login'
  | 'auth.role_changed'
  | 'listing.created'
  | 'listing.updated'
  | 'listing.boosted'
  | 'store.created'
  | 'report.filed'
  | 'user.profile_updated'

interface AuditLogEntry {
  action: AuditAction | string
  actorId: string
  actorRole: string
  resourceType: string
  resourceId: string
  description: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  if (!isDatabaseAvailable()) return

  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        description: entry.description,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      },
    })
  } catch (error) {
    // Audit logging should never crash the app
    console.error('[audit] Failed to create audit log:', error)
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(filters: {
  action?: string
  actorId?: string
  resourceType?: string
  resourceId?: string
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}) {
  if (!isDatabaseAvailable()) return { logs: [], total: 0, page: 1, totalPages: 0 }

  const page = filters.page || 1
  const limit = Math.min(filters.limit || 50, 100)
  const skip = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (filters.action) where.action = filters.action
  if (filters.actorId) where.actorId = filters.actorId
  if (filters.resourceType) where.resourceType = filters.resourceType
  if (filters.resourceId) where.resourceId = filters.resourceId
  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ])

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}
