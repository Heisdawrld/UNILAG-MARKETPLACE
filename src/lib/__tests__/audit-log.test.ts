/**
 * audit-log.test.ts — Integration tests for the audit logging system
 *
 * Tests:
 *   - createAuditLog creates a log entry
 *   - createAuditLog doesn't crash when DB is unavailable
 *   - createAuditLog doesn't crash when DB write fails
 *   - queryAuditLogs with filters (action, actorId, resourceType, etc.)
 *   - queryAuditLogs pagination
 *   - queryAuditLogs when DB is unavailable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock database ──
const mockAuditLogCreate = vi.fn()
const mockAuditLogFindMany = vi.fn()
const mockAuditLogCount = vi.fn()

let mockIsDatabaseAvailable = true

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
      findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
      count: (...args: unknown[]) => mockAuditLogCount(...args),
    },
  },
  isDatabaseAvailable: () => mockIsDatabaseAvailable,
}))

import { createAuditLog, queryAuditLogs } from '@/lib/audit-log'

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDatabaseAvailable = true
})

// ══════════════════════════════════════════
// 1. createAuditLog — Happy Path
// ══════════════════════════════════════════

describe('createAuditLog — Happy Path', () => {
  it('should create a log entry with all required fields', async () => {
    mockAuditLogCreate.mockResolvedValueOnce({ id: 'log-1' })

    await createAuditLog({
      action: 'payment.initiated',
      actorId: 'user-1',
      actorRole: 'user',
      resourceType: 'payment',
      resourceId: 'pay-1',
      description: 'Payment initiated for listing',
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'payment.initiated',
        actorId: 'user-1',
        actorRole: 'user',
        resourceType: 'payment',
        resourceId: 'pay-1',
        description: 'Payment initiated for listing',
      }),
    })
  })

  it('should create a log entry with optional metadata', async () => {
    mockAuditLogCreate.mockResolvedValueOnce({ id: 'log-2' })

    await createAuditLog({
      action: 'escrow.released',
      actorId: 'runner-1',
      actorRole: 'runner',
      resourceType: 'delivery',
      resourceId: 'order-1',
      description: 'Escrow released',
      metadata: { amount: 880, platformFee: 120 },
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: JSON.stringify({ amount: 880, platformFee: 120 }),
      }),
    })
  })

  it('should create a log entry with optional ipAddress and userAgent', async () => {
    mockAuditLogCreate.mockResolvedValueOnce({ id: 'log-3' })

    await createAuditLog({
      action: 'auth.login',
      actorId: 'user-2',
      actorRole: 'user',
      resourceType: 'auth',
      resourceId: 'session-1',
      description: 'User logged in',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      }),
    })
  })

  it('should set metadata to null when not provided', async () => {
    mockAuditLogCreate.mockResolvedValueOnce({ id: 'log-4' })

    await createAuditLog({
      action: 'delivery.created',
      actorId: 'user-3',
      actorRole: 'user',
      resourceType: 'delivery',
      resourceId: 'order-2',
      description: 'Delivery created',
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: null,
      }),
    })
  })

  it('should handle all defined audit actions', async () => {
    const actions = [
      'payment.initiated', 'payment.verified', 'payment.refunded',
      'escrow.held', 'escrow.released', 'escrow.refunded',
      'payout.requested', 'payout.completed', 'payout.failed',
      'delivery.created', 'delivery.status_changed', 'delivery.cancelled', 'delivery.confirmed',
      'runner.assigned', 'runner.location_updated',
      'admin.user_updated', 'admin.payout_approved', 'admin.payout_rejected',
      'auth.login', 'auth.role_changed',
      'listing.created', 'listing.updated', 'listing.boosted',
      'store.created',
      'report.filed',
      'user.profile_updated',
    ]

    mockAuditLogCreate.mockResolvedValue({ id: 'log-x' })

    for (const action of actions) {
      await createAuditLog({
        action,
        actorId: 'user-1',
        actorRole: 'user',
        resourceType: 'test',
        resourceId: 'res-1',
        description: `Test action: ${action}`,
      })
    }

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(actions.length)
  })
})

// ══════════════════════════════════════════
// 2. createAuditLog — DB Unavailable
// ══════════════════════════════════════════

describe('createAuditLog — DB Unavailable', () => {
  it('should not crash when database is unavailable', async () => {
    mockIsDatabaseAvailable = false

    // Should resolve without error
    await expect(
      createAuditLog({
        action: 'payment.initiated',
        actorId: 'user-1',
        actorRole: 'user',
        resourceType: 'payment',
        resourceId: 'pay-1',
        description: 'Payment initiated',
      })
    ).resolves.toBeUndefined()

    // Should not have called the DB
    expect(mockAuditLogCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════
// 3. createAuditLog — DB Write Failure
// ══════════════════════════════════════════

describe('createAuditLog — DB Write Failure', () => {
  it('should not crash when database write fails', async () => {
    mockAuditLogCreate.mockRejectedValueOnce(new Error('Connection refused'))

    // Should resolve without error (audit logging never crashes the app)
    await expect(
      createAuditLog({
        action: 'escrow.released',
        actorId: 'runner-1',
        actorRole: 'runner',
        resourceType: 'delivery',
        resourceId: 'order-1',
        description: 'Escrow released',
      })
    ).resolves.toBeUndefined()
  })

  it('should not crash on constraint violation errors', async () => {
    mockAuditLogCreate.mockRejectedValueOnce(new Error('Unique constraint failed'))

    await expect(
      createAuditLog({
        action: 'auth.login',
        actorId: 'user-1',
        actorRole: 'user',
        resourceType: 'auth',
        resourceId: 'session-1',
        description: 'Login attempt',
      })
    ).resolves.toBeUndefined()
  })
})

// ══════════════════════════════════════════
// 4. queryAuditLogs — Happy Path
// ══════════════════════════════════════════

describe('queryAuditLogs — Happy Path', () => {
  it('should return logs with pagination info', async () => {
    const mockLogs = [
      { id: 'log-1', action: 'payment.initiated', actorId: 'user-1', createdAt: new Date() },
      { id: 'log-2', action: 'escrow.released', actorId: 'runner-1', createdAt: new Date() },
    ]
    mockAuditLogFindMany.mockResolvedValueOnce(mockLogs)
    mockAuditLogCount.mockResolvedValueOnce(2)

    const result = await queryAuditLogs({})

    expect(result.logs).toEqual(mockLogs)
    expect(result.total).toBe(2)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('should filter by action', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    await queryAuditLogs({ action: 'payment.initiated' })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: 'payment.initiated' }),
      })
    )
  })

  it('should filter by actorId', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    await queryAuditLogs({ actorId: 'user-1' })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ actorId: 'user-1' }),
      })
    )
  })

  it('should filter by resourceType', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    await queryAuditLogs({ resourceType: 'delivery' })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resourceType: 'delivery' }),
      })
    )
  })

  it('should filter by resourceId', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    await queryAuditLogs({ resourceId: 'order-1' })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resourceId: 'order-1' }),
      })
    )
  })

  it('should filter by date range', async () => {
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-12-31')
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    await queryAuditLogs({ startDate, endDate })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: startDate, lte: endDate },
        }),
      })
    )
  })

  it('should filter by startDate only', async () => {
    const startDate = new Date('2024-06-01')
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    await queryAuditLogs({ startDate })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: startDate }),
        }),
      })
    )
  })

  it('should filter by endDate only', async () => {
    const endDate = new Date('2024-12-31')
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    await queryAuditLogs({ endDate })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lte: endDate }),
        }),
      })
    )
  })
})

// ══════════════════════════════════════════
// 5. queryAuditLogs — Pagination
// ══════════════════════════════════════════

describe('queryAuditLogs — Pagination', () => {
  it('should default to page 1, limit 50', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    const result = await queryAuditLogs({})

    expect(result.page).toBe(1)
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
      })
    )
  })

  it('should calculate correct pagination for page 2', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(100)

    const result = await queryAuditLogs({ page: 2, limit: 50 })

    expect(result.page).toBe(2)
    expect(result.totalPages).toBe(2)
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
      })
    )
  })

  it('should cap limit at 100', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(500)

    await queryAuditLogs({ limit: 200 })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    )
  })

  it('should calculate totalPages correctly', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(75)

    const result = await queryAuditLogs({ limit: 50 })

    expect(result.totalPages).toBe(2) // ceil(75/50) = 2
  })

  it('should return 0 totalPages when no results', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    const result = await queryAuditLogs({})

    expect(result.totalPages).toBe(0)
  })
})

// ══════════════════════════════════════════
// 6. queryAuditLogs — DB Unavailable
// ══════════════════════════════════════════

describe('queryAuditLogs — DB Unavailable', () => {
  it('should return empty results when database is unavailable', async () => {
    mockIsDatabaseAvailable = false

    const result = await queryAuditLogs({})

    expect(result).toEqual({
      logs: [],
      total: 0,
      page: 1,
      totalPages: 0,
    })
    expect(mockAuditLogFindMany).not.toHaveBeenCalled()
    expect(mockAuditLogCount).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════
// 7. queryAuditLogs — Ordering
// ══════════════════════════════════════════

describe('queryAuditLogs — Ordering', () => {
  it('should order logs by createdAt descending', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([])
    mockAuditLogCount.mockResolvedValueOnce(0)

    await queryAuditLogs({})

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })
})

// ══════════════════════════════════════════
// 8. createAuditLog — Custom action strings
// ══════════════════════════════════════════

describe('createAuditLog — Custom Actions', () => {
  it('should accept custom action strings (not just predefined types)', async () => {
    mockAuditLogCreate.mockResolvedValueOnce({ id: 'log-custom' })

    await createAuditLog({
      action: 'custom.webhook_received',
      actorId: 'system',
      actorRole: 'system',
      resourceType: 'webhook',
      resourceId: 'hook-1',
      description: 'Webhook received from Flutterwave',
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'custom.webhook_received',
      }),
    })
  })
})
