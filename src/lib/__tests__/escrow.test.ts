/**
 * escrow.test.ts — Tests for escrow commission calculations
 *
 * These tests focus on the pure `calculateCommission()` function.
 * The async functions that interact with the database are NOT tested here
 * (they would require DB mocking which is out of scope for critical tests).
 */

import { describe, it, expect, vi } from 'vitest'

// We only import the pure function — no DB dependencies
// Since escrow.ts imports db and flutterwave at module level, we need to
// extract the function or mock the modules. Let's mock the modules.
vi.mock('@/lib/db', () => ({
  db: {},
  isDatabaseAvailable: () => false,
}))

vi.mock('@/lib/flutterwave', () => ({
  isPaymentsEnabled: () => false,
  getPaymentMode: () => 'locked',
  generateTxRef: (type: string) => `ULM_TEST_${type}_${Date.now()}_mock`,
  initializePayment: vi.fn(),
  initiateRefund: vi.fn(),
  initiateTransfer: vi.fn(),
}))

import { calculateCommission } from '@/lib/escrow'

describe('calculateCommission', () => {
  it('should calculate 12% platform commission on a standard amount', () => {
    const result = calculateCommission(1000)
    expect(result.platformFee).toBe(120)    // 12% of 1000
    expect(result.runnerPayout).toBe(880)   // 88% of 1000
  })

  it('should calculate commission on a large amount', () => {
    const result = calculateCommission(50000)
    expect(result.platformFee).toBe(6000)   // 12% of 50000
    expect(result.runnerPayout).toBe(44000)  // 88% of 50000
  })

  it('should calculate commission on the minimum delivery price', () => {
    const result = calculateCommission(100)
    expect(result.platformFee).toBe(12)     // 12% of 100
    expect(result.runnerPayout).toBe(88)    // 88% of 100
  })

  it('should return 0 commission for amount of 0', () => {
    const result = calculateCommission(0)
    expect(result.platformFee).toBe(0)
    expect(result.runnerPayout).toBe(0)
  })

  it('should handle negative amounts (debt scenario)', () => {
    const result = calculateCommission(-1000)
    expect(result.platformFee).toBe(-120)   // 12% of -1000
    expect(result.runnerPayout).toBe(-880)  // 88% of -1000
  })

  it('should handle very large amounts', () => {
    const result = calculateCommission(1000000)
    expect(result.platformFee).toBe(120000)   // 12% of 1000000
    expect(result.runnerPayout).toBe(880000)  // 88% of 1000000
  })

  it('should handle fractional amounts by rounding', () => {
    // 12% of 999 = 119.88, rounded to 120
    const result = calculateCommission(999)
    expect(result.platformFee).toBe(120)
    expect(result.runnerPayout).toBe(879)  // 999 - 120
  })

  it('should handle amounts that produce fractional commissions', () => {
    // 12% of 333 = 39.96, rounded to 40
    const result = calculateCommission(333)
    expect(result.platformFee).toBe(40)
    expect(result.runnerPayout).toBe(293)  // 333 - 40
  })

  it('should maintain the invariant: runnerPayout + platformFee = finalPrice', () => {
    const testAmounts = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000]
    for (const amount of testAmounts) {
      const result = calculateCommission(amount)
      expect(result.runnerPayout + result.platformFee).toBe(amount)
    }
  })

  it('should always give runner exactly 88% (accounting for rounding)', () => {
    // For amounts where 12% is a whole number, runner should get exactly 88%
    const cleanAmounts = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000]
    for (const amount of cleanAmounts) {
      const result = calculateCommission(amount)
      expect(result.runnerPayout).toBe(amount * 0.88)
    }
  })
})
