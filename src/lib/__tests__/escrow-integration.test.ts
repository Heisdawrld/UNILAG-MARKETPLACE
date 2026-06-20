/**
 * escrow-integration.test.ts — Integration tests for the escrow flow
 *
 * Tests the end-to-end escrow lifecycle with mocked database:
 *   initiateDeliveryPayment → confirmEscrowPayment → releaseEscrow
 *   Double-release / double-refund prevention
 *   Commission calculation correctness
 *   Item cost + prepaid flow
 *   Item reimbursement for prepaid items
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mock functions (available in vi.mock factories) ──
const mocks = vi.hoisted(() => ({
  deliveryOrderFindUnique: vi.fn(),
  deliveryOrderUpdate: vi.fn(),
  deliveryOrderUpdateMany: vi.fn(),
  orderStatusLogCreate: vi.fn(),
  runnerWalletFindUnique: vi.fn(),
  runnerWalletCreate: vi.fn(),
  runnerWalletUpdate: vi.fn(),
  walletTransactionCreate: vi.fn(),
  auditLogCreate: vi.fn(),
}))

// ── Mock database ──
vi.mock('@/lib/db', () => ({
  db: {
    deliveryOrder: {
      findUnique: (...args: unknown[]) => mocks.deliveryOrderFindUnique(...args),
      update: (...args: unknown[]) => mocks.deliveryOrderUpdate(...args),
      updateMany: (...args: unknown[]) => mocks.deliveryOrderUpdateMany(...args),
    },
    orderStatusLog: {
      create: (...args: unknown[]) => mocks.orderStatusLogCreate(...args),
    },
    runnerWallet: {
      findUnique: (...args: unknown[]) => mocks.runnerWalletFindUnique(...args),
      create: (...args: unknown[]) => mocks.runnerWalletCreate(...args),
      update: (...args: unknown[]) => mocks.runnerWalletUpdate(...args),
    },
    walletTransaction: {
      create: (...args: unknown[]) => mocks.walletTransactionCreate(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mocks.auditLogCreate(...args),
    },
  },
  isDatabaseAvailable: () => true,
}))

// ── Mock flutterwave ──
vi.mock('@/lib/flutterwave', () => ({
  isPaymentsEnabled: () => false,
  getPaymentMode: () => 'locked',
  generateTxRef: (type: string) => `ULM_TEST_${type}_${Date.now()}_mock`,
  initializePayment: vi.fn().mockResolvedValue({
    link: 'https://example.com/pay?ref=test',
    tx_ref: 'test_ref',
    isSandbox: true,
    isLocked: true,
  }),
  initiateRefund: vi.fn().mockResolvedValue({
    success: true,
    refundId: 123,
    transactionId: 456,
    amountRefunded: 1000,
    status: 'completed',
    isSandbox: true,
    isLocked: true,
  }),
  initiateTransfer: vi.fn().mockResolvedValue({
    success: true,
    transferId: 789,
    status: 'queued',
    isSandbox: true,
    isLocked: true,
  }),
}))

// ── Mock audit-log ──
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// ── Mock utils logger ──
vi.mock('@/lib/utils', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { initiateDeliveryPayment, confirmEscrowPayment, releaseEscrow, refundEscrow, calculateCommission } from '@/lib/escrow'

beforeEach(() => {
  vi.clearAllMocks()
})

// ══════════════════════════════════════════
// 1. Commission Calculation
// ══════════════════════════════════════════

describe('Escrow Integration — Commission Calculation', () => {
  it('should calculate 12% platform commission correctly', () => {
    const result = calculateCommission(1000)
    expect(result.platformFee).toBe(120)
    expect(result.runnerPayout).toBe(880)
  })

  it('should maintain runnerPayout + platformFee = finalPrice invariant', () => {
    const amounts = [100, 500, 1000, 2500, 5000, 10000, 50000]
    for (const amount of amounts) {
      const result = calculateCommission(amount)
      expect(result.runnerPayout + result.platformFee).toBe(amount)
    }
  })

  it('should handle rounding for fractional commissions', () => {
    // 12% of 999 = 119.88, rounded to 120
    const result = calculateCommission(999)
    expect(result.platformFee).toBe(120)
    expect(result.runnerPayout).toBe(879)
  })

  it('should calculate commission on zero amount', () => {
    const result = calculateCommission(0)
    expect(result.platformFee).toBe(0)
    expect(result.runnerPayout).toBe(0)
  })
})

// ══════════════════════════════════════════
// 2. Happy Path: initiate → confirm → release
// ══════════════════════════════════════════

describe('Escrow Integration — Happy Path', () => {
  it('should complete the full escrow flow: initiate → confirm → release', async () => {
    const orderId = 'order-1'
    const customerId = 'customer-1'
    const runnerId = 'runner-1'

    // Step 1: initiateDeliveryPayment (locked mode → 2 updates)
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      itemCost: null,
      itemPaymentMethod: null,
    })
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({}) // set paymentReference
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({}) // set paymentStatus = escrow

    const initiateResult = await initiateDeliveryPayment(
      orderId,
      customerId,
      'test@unilag.edu.ng',
      'Test User',
      1000
    )

    expect(initiateResult.isLocked).toBe(true)
    expect(initiateResult.txRef).toContain('ULM_TEST_delivery_')

    // Step 2: confirmEscrowPayment
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      id: orderId,
      paymentStatus: 'unpaid',
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: runnerId,
    })
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({})
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: runnerId,
      balance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      totalHeld: 0,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    const confirmResult = await confirmEscrowPayment(orderId, initiateResult.txRef)
    expect(confirmResult).toBe(true)

    // Step 3: releaseEscrow
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: runnerId,
      platformCommission: 120,
      itemCost: null,
      itemPaymentMethod: null,
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: runnerId,
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 880,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    const releaseResult = await releaseEscrow(orderId)
    expect(releaseResult).toBe(true)
  })
})

// ══════════════════════════════════════════
// 3. Double-Release Prevention (Atomic Guard)
// ══════════════════════════════════════════

describe('Escrow Integration — Double-Release Prevention', () => {
  it('should prevent double-release when updateMany returns count 0', async () => {
    // Simulate a second release attempt where paymentStatus is already 'released'
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 0 })

    const result = await releaseEscrow('order-already-released')
    expect(result).toBe(false)
  })

  it('should call updateMany with paymentStatus: escrow guard', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      platformCommission: 120,
      itemCost: null,
      itemPaymentMethod: null,
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 880,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    await releaseEscrow('order-escrow')

    // Verify the atomic guard was used
    expect(mocks.deliveryOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-escrow',
          paymentStatus: 'escrow',
        }),
      })
    )
  })

  it('should set paymentStatus to released on successful release', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      platformCommission: 120,
      itemCost: null,
      itemPaymentMethod: null,
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 880,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    await releaseEscrow('order-release-status')

    expect(mocks.deliveryOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'released',
        }),
      })
    )
  })
})

// ══════════════════════════════════════════
// 4. Double-Refund Prevention (Atomic Guard)
// ══════════════════════════════════════════

describe('Escrow Integration — Double-Refund Prevention', () => {
  it('should prevent double-refund when updateMany returns count 0', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 0 })

    const result = await refundEscrow('order-already-refunded', 'test reason')
    expect(result).toBe(false)
  })

  it('should call updateMany with paymentStatus: escrow guard for refund', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      paymentReference: 'test-ref',
      paymentMethod: 'locked',
      flutterwaveTransactionId: null,
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 0,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    await refundEscrow('order-escrow', 'Runner no-show')

    expect(mocks.deliveryOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-escrow',
          paymentStatus: 'escrow',
        }),
      })
    )
  })

  it('should set paymentStatus to refunded on successful refund', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      paymentReference: null,
      paymentMethod: 'locked',
      flutterwaveTransactionId: null,
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 0,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    await refundEscrow('order-refund-status', 'Customer cancelled')

    expect(mocks.deliveryOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'refunded',
        }),
      })
    )
  })
})

// ══════════════════════════════════════════
// 5. Item Cost + Prepaid Flow
// ══════════════════════════════════════════

describe('Escrow Integration — Item Cost + Prepaid Flow', () => {
  it('should include item cost in total when itemPaymentMethod is prepaid', async () => {
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      itemCost: 5000,
      itemPaymentMethod: 'prepaid',
    })
    // First update: sets paymentReference and platformCommission
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({})
    // Second update (locked mode): sets paymentStatus = escrow
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({})

    const result = await initiateDeliveryPayment(
      'order-prepaid',
      'customer-1',
      'test@unilag.edu.ng',
      'Test User',
      1000 // delivery fee
    )

    expect(result.isLocked).toBe(true)

    // The first update should have platformCommission calculated on 1000 + 5000 = 6000
    // 12% of 6000 = 720
    expect(mocks.deliveryOrderUpdate).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        data: expect.objectContaining({
          platformCommission: 720,
        }),
      })
    )
  })

  it('should NOT include item cost when itemPaymentMethod is NOT prepaid', async () => {
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      itemCost: 5000,
      itemPaymentMethod: 'pay_on_delivery',
    })
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({})
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({})

    await initiateDeliveryPayment(
      'order-not-prepaid',
      'customer-1',
      'test@unilag.edu.ng',
      'Test User',
      1000
    )

    // Platform commission should only be on 1000 (delivery fee), not 6000
    // 12% of 1000 = 120
    expect(mocks.deliveryOrderUpdate).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        data: expect.objectContaining({
          platformCommission: 120,
        }),
      })
    )
  })

  it('should NOT include item cost when itemCost is null', async () => {
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      itemCost: null,
      itemPaymentMethod: 'prepaid',
    })
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({})
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({})

    await initiateDeliveryPayment(
      'order-no-itemcost',
      'customer-1',
      'test@unilag.edu.ng',
      'Test User',
      1000
    )

    expect(mocks.deliveryOrderUpdate).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        data: expect.objectContaining({
          platformCommission: 120,
        }),
      })
    )
  })
})

// ══════════════════════════════════════════
// 6. Item Reimbursement in releaseEscrow
// ══════════════════════════════════════════

describe('Escrow Integration — Item Reimbursement for Prepaid Items', () => {
  it('should add item cost reimbursement to runner payout for prepaid items', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      platformCommission: 120,
      itemCost: 5000,
      itemPaymentMethod: 'prepaid',
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 5880, // 880 runner payout + 5000 item reimbursement
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    const result = await releaseEscrow('order-prepaid-release')
    expect(result).toBe(true)

    // Verify the wallet was credited with runnerPayout + itemReimbursement
    // runnerPayout = 1000 - 120 = 880, itemReimbursement = 5000, total = 5880
    expect(mocks.runnerWalletUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: { increment: 5880 },
          pendingBalance: { decrement: 5880 },
        }),
      })
    )
  })

  it('should NOT add item reimbursement when itemPaymentMethod is NOT prepaid', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      platformCommission: 120,
      itemCost: 5000,
      itemPaymentMethod: 'pay_on_delivery',
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 880,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    const result = await releaseEscrow('order-nonprepaid-release')
    expect(result).toBe(true)

    // Only runner payout (880), no item reimbursement
    expect(mocks.runnerWalletUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: { increment: 880 },
          pendingBalance: { decrement: 880 },
        }),
      })
    )
  })

  it('should NOT add item reimbursement when itemCost is null', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      platformCommission: 120,
      itemCost: null,
      itemPaymentMethod: 'prepaid',
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 880,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    const result = await releaseEscrow('order-null-itemcost')
    expect(result).toBe(true)

    // Only runner payout (880), no item reimbursement
    expect(mocks.runnerWalletUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: { increment: 880 },
          pendingBalance: { decrement: 880 },
        }),
      })
    )
  })
})

// ══════════════════════════════════════════
// 7. confirmEscrowPayment edge cases
// ══════════════════════════════════════════

describe('Escrow Integration — confirmEscrowPayment Edge Cases', () => {
  it('should return false if order not found', async () => {
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce(null)

    const result = await confirmEscrowPayment('nonexistent', 'txref')
    expect(result).toBe(false)
  })

  it('should return false if order is already paid (not unpaid)', async () => {
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      id: 'order-1',
      paymentStatus: 'escrow', // already in escrow
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
    })

    const result = await confirmEscrowPayment('order-1', 'txref')
    expect(result).toBe(false)
  })

  it('should use customerPrice when finalPrice is null', async () => {
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      id: 'order-1',
      paymentStatus: 'unpaid',
      finalPrice: null,
      customerPrice: 2000,
      assignedRunnerId: 'runner-1',
    })
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({})
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 0,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 0,
      pendingBalance: 1760,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    const result = await confirmEscrowPayment('order-1', 'txref')
    expect(result).toBe(true)

    // Commission should be calculated on customerPrice (2000)
    // 12% of 2000 = 240
    expect(mocks.deliveryOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platformCommission: 240,
        }),
      })
    )
  })

  it('should credit runner pending balance on confirmation', async () => {
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      id: 'order-1',
      paymentStatus: 'unpaid',
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
    })
    mocks.deliveryOrderUpdate.mockResolvedValueOnce({})
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 0,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    const result = await confirmEscrowPayment('order-1', 'txref')
    expect(result).toBe(true)

    // Runner pending balance should be credited with runnerPayout (880)
    expect(mocks.runnerWalletUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendingBalance: { increment: 880 },
        }),
      })
    )
  })
})

// ══════════════════════════════════════════
// 8. releaseEscrow edge cases
// ══════════════════════════════════════════

describe('Escrow Integration — releaseEscrow Edge Cases', () => {
  it('should return false when order has no assignedRunnerId', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: null,
      platformCommission: 120,
      itemCost: null,
      itemPaymentMethod: null,
    })

    const result = await releaseEscrow('order-no-runner')
    expect(result).toBe(false)
  })

  it('should return false when order is not found after updateMany', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce(null)

    const result = await releaseEscrow('order-gone')
    expect(result).toBe(false)
  })

  it('should create an escrow_released status log', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      platformCommission: 120,
      itemCost: null,
      itemPaymentMethod: null,
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 880,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    await releaseEscrow('order-log')

    expect(mocks.orderStatusLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'escrow_held',
          toStatus: 'escrow_released',
        }),
      })
    )
  })
})

// ══════════════════════════════════════════
// 9. refundEscrow edge cases
// ══════════════════════════════════════════

describe('Escrow Integration — refundEscrow Edge Cases', () => {
  it('should still succeed when order has no assignedRunnerId (skip wallet debit)', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: null,
      paymentReference: null,
      paymentMethod: 'locked',
      flutterwaveTransactionId: null,
    })
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    const result = await refundEscrow('order-no-runner-refund', 'Customer cancelled')
    expect(result).toBe(true)
  })

  it('should handle refund with flutterwave transaction ID', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      paymentReference: 'ULM_delivery_123',
      paymentMethod: 'flutterwave',
      flutterwaveTransactionId: '456789',
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 0,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    const result = await refundEscrow('order-fw-refund', 'Runner no-show')
    expect(result).toBe(true)
  })

  it('should create an escrow_refunded status log', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: null,
      paymentReference: null,
      paymentMethod: 'locked',
      flutterwaveTransactionId: null,
    })
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    await refundEscrow('order-refund-log', 'Customer cancelled')

    expect(mocks.orderStatusLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'escrow_held',
          toStatus: 'escrow_refunded',
        }),
      })
    )
  })

  it('should debit runner pending balance on refund', async () => {
    mocks.deliveryOrderUpdateMany.mockResolvedValueOnce({ count: 1 })
    mocks.deliveryOrderFindUnique.mockResolvedValueOnce({
      finalPrice: 1000,
      customerPrice: 1000,
      assignedRunnerId: 'runner-1',
      paymentReference: null,
      paymentMethod: 'locked',
      flutterwaveTransactionId: null,
    })
    mocks.runnerWalletFindUnique.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'runner-1',
      balance: 0,
      pendingBalance: 880,
    })
    mocks.runnerWalletUpdate.mockResolvedValueOnce({
      id: 'wallet-1',
      balance: 0,
      pendingBalance: 0,
    })
    mocks.walletTransactionCreate.mockResolvedValueOnce({})
    mocks.orderStatusLogCreate.mockResolvedValueOnce({})

    await refundEscrow('order-debit', 'Runner no-show')

    // Runner pending balance should be debited
    expect(mocks.runnerWalletUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendingBalance: { decrement: 880 },
        }),
      })
    )
  })
})
