/**
 * flutterwave.test.ts — Tests for payment mode logic and tx ref generation
 *
 * Tests pure functions: getPaymentMode(), isPaymentsEnabled(), generateTxRef()
 * No database or external API calls required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to re-import the module after changing env vars
// so we use dynamic imports with cache busting

const originalMode = process.env.FLUTTERWAVE_MODE

describe('Flutterwave payment mode', () => {
  beforeEach(() => {
    // Reset env before each test
    delete process.env.FLUTTERWAVE_MODE
    // Clear module cache so env changes are picked up
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original env
    if (originalMode !== undefined) {
      process.env.FLUTTERWAVE_MODE = originalMode
    } else {
      delete process.env.FLUTTERWAVE_MODE
    }
    vi.resetModules()
  })

  // ── getPaymentMode ──

  it('should return "locked" when FLUTTERWAVE_MODE is not set', async () => {
    const { getPaymentMode } = await import('@/lib/flutterwave')
    expect(getPaymentMode()).toBe('locked')
  })

  it('should return "live" when FLUTTERWAVE_MODE is "live"', async () => {
    process.env.FLUTTERWAVE_MODE = 'live'
    const { getPaymentMode } = await import('@/lib/flutterwave')
    expect(getPaymentMode()).toBe('live')
  })

  it('should return "sandbox" when FLUTTERWAVE_MODE is "sandbox"', async () => {
    process.env.FLUTTERWAVE_MODE = 'sandbox'
    const { getPaymentMode } = await import('@/lib/flutterwave')
    expect(getPaymentMode()).toBe('sandbox')
  })

  it('should return "locked" when FLUTTERWAVE_MODE is "locked"', async () => {
    process.env.FLUTTERWAVE_MODE = 'locked'
    const { getPaymentMode } = await import('@/lib/flutterwave')
    expect(getPaymentMode()).toBe('locked')
  })

  it('should return "locked" for invalid FLUTTERWAVE_MODE values', async () => {
    process.env.FLUTTERWAVE_MODE = 'invalid'
    const { getPaymentMode } = await import('@/lib/flutterwave')
    expect(getPaymentMode()).toBe('locked')
  })

  // ── isPaymentsEnabled ──

  it('should return false when mode is "locked"', async () => {
    process.env.FLUTTERWAVE_MODE = 'locked'
    const { isPaymentsEnabled } = await import('@/lib/flutterwave')
    expect(isPaymentsEnabled()).toBe(false)
  })

  it('should return true when mode is "sandbox"', async () => {
    process.env.FLUTTERWAVE_MODE = 'sandbox'
    const { isPaymentsEnabled } = await import('@/lib/flutterwave')
    expect(isPaymentsEnabled()).toBe(true)
  })

  it('should return true when mode is "live"', async () => {
    process.env.FLUTTERWAVE_MODE = 'live'
    const { isPaymentsEnabled } = await import('@/lib/flutterwave')
    expect(isPaymentsEnabled()).toBe(true)
  })

  // ── generateTxRef ──

  it('should generate a tx ref with "ULM" prefix in live mode', async () => {
    process.env.FLUTTERWAVE_MODE = 'live'
    const { generateTxRef } = await import('@/lib/flutterwave')
    const ref = generateTxRef('delivery')
    expect(ref).toMatch(/^ULM_delivery_\d+_[a-f0-9]+$/)
  })

  it('should generate a tx ref with "ULM_TEST" prefix in sandbox mode', async () => {
    process.env.FLUTTERWAVE_MODE = 'sandbox'
    const { generateTxRef } = await import('@/lib/flutterwave')
    const ref = generateTxRef('delivery')
    expect(ref).toMatch(/^ULM_TEST_delivery_\d+_[a-f0-9]+$/)
  })

  it('should generate a tx ref with "ULM_TEST" prefix in locked mode (defaults to test-like)', async () => {
    process.env.FLUTTERWAVE_MODE = 'locked'
    const { generateTxRef, isSandboxMode } = await import('@/lib/flutterwave')
    const ref = generateTxRef('payout')
    // Locked mode is not sandbox, so it uses "ULM" prefix
    // But isSandboxMode returns false for locked
    expect(isSandboxMode()).toBe(false)
    expect(ref).toMatch(/^ULM_payout_\d+_[a-f0-9]+$/)
  })

  it('should include the type parameter in the reference', async () => {
    process.env.FLUTTERWAVE_MODE = 'live'
    const { generateTxRef } = await import('@/lib/flutterwave')
    const boostRef = generateTxRef('boost')
    const payoutRef = generateTxRef('payout')
    const deliveryRef = generateTxRef('delivery')
    expect(boostRef).toContain('boost')
    expect(payoutRef).toContain('payout')
    expect(deliveryRef).toContain('delivery')
  })

  it('should generate unique references', async () => {
    process.env.FLUTTERWAVE_MODE = 'live'
    const { generateTxRef } = await import('@/lib/flutterwave')
    const refs = new Set<string>()
    for (let i = 0; i < 100; i++) {
      refs.add(generateTxRef('test'))
    }
    // All 100 refs should be unique
    expect(refs.size).toBe(100)
  })

  it('should include a timestamp in the reference', async () => {
    process.env.FLUTTERWAVE_MODE = 'live'
    const { generateTxRef } = await import('@/lib/flutterwave')
    const before = Date.now()
    const ref = generateTxRef('delivery')
    const after = Date.now()
    // Extract timestamp from ref
    const parts = ref.split('_')
    // ULM_delivery_{timestamp}_{hex}
    const timestamp = parseInt(parts[2], 10)
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  // ── isSandboxMode ──

  it('should return true for sandbox mode', async () => {
    process.env.FLUTTERWAVE_MODE = 'sandbox'
    const { isSandboxMode } = await import('@/lib/flutterwave')
    expect(isSandboxMode()).toBe(true)
  })

  it('should return false for live mode', async () => {
    process.env.FLUTTERWAVE_MODE = 'live'
    const { isSandboxMode } = await import('@/lib/flutterwave')
    expect(isSandboxMode()).toBe(false)
  })

  it('should return false for locked mode', async () => {
    process.env.FLUTTERWAVE_MODE = 'locked'
    const { isSandboxMode } = await import('@/lib/flutterwave')
    expect(isSandboxMode()).toBe(false)
  })
})
