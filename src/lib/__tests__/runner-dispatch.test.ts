/**
 * runner-dispatch.test.ts — Integration tests for the runner dispatch system
 *
 * Tests:
 *   - isInsideUnilagBoundary with valid and invalid coordinates
 *   - estimateCampusTrip returns reasonable estimates
 *   - Route factor (1.4x) is applied correctly
 *   - validateCampusRoute validates pickup and dropoff
 *   - isValidCoordinate and normalizeCoordinate
 *   - getTaskLifecycleTimestamps
 *   - getTaskStatusLabel
 */

import { describe, it, expect } from 'vitest'
import {
  isInsideUnilagBoundary,
  estimateCampusTrip,
  validateCampusRoute,
  isValidCoordinate,
  normalizeCoordinate,
  getTaskLifecycleTimestamps,
  getTaskStatusLabel,
  UNILAG_SERVICE_AREA,
} from '@/lib/runner-dispatch'

// ══════════════════════════════════════════
// 1. isInsideUnilagBoundary
// ══════════════════════════════════════════

describe('isInsideUnilagBoundary', () => {
  it('should return true for the center of UNILAG campus', () => {
    expect(isInsideUnilagBoundary({
      lat: UNILAG_SERVICE_AREA.centerLat,
      lng: UNILAG_SERVICE_AREA.centerLng,
    })).toBe(true)
  })

  it('should return true for coordinates at the NW corner boundary', () => {
    expect(isInsideUnilagBoundary({
      lat: UNILAG_SERVICE_AREA.minLat,
      lng: UNILAG_SERVICE_AREA.minLng,
    })).toBe(true)
  })

  it('should return true for coordinates at the SE corner boundary', () => {
    expect(isInsideUnilagBoundary({
      lat: UNILAG_SERVICE_AREA.maxLat,
      lng: UNILAG_SERVICE_AREA.maxLng,
    })).toBe(true)
  })

  it('should return false for coordinates north of UNILAG', () => {
    expect(isInsideUnilagBoundary({
      lat: UNILAG_SERVICE_AREA.maxLat + 0.01,
      lng: UNILAG_SERVICE_AREA.centerLng,
    })).toBe(false)
  })

  it('should return false for coordinates south of UNILAG', () => {
    expect(isInsideUnilagBoundary({
      lat: UNILAG_SERVICE_AREA.minLat - 0.01,
      lng: UNILAG_SERVICE_AREA.centerLng,
    })).toBe(false)
  })

  it('should return false for coordinates west of UNILAG', () => {
    expect(isInsideUnilagBoundary({
      lat: UNILAG_SERVICE_AREA.centerLat,
      lng: UNILAG_SERVICE_AREA.minLng - 0.01,
    })).toBe(false)
  })

  it('should return false for coordinates east of UNILAG', () => {
    expect(isInsideUnilagBoundary({
      lat: UNILAG_SERVICE_AREA.centerLat,
      lng: UNILAG_SERVICE_AREA.maxLng + 0.01,
    })).toBe(false)
  })

  it('should return false for coordinates completely outside Lagos', () => {
    // London coordinates
    expect(isInsideUnilagBoundary({ lat: 51.5074, lng: -0.1278 })).toBe(false)
  })

  it('should return true for a point inside campus (Jaja Hall area)', () => {
    // Approximate coordinates for Jaja Hall, UNILAG
    expect(isInsideUnilagBoundary({ lat: 6.515, lng: 3.391 })).toBe(true)
  })

  it('should return true for a point inside campus (Faculty of Science area)', () => {
    // Approximate coordinates for Faculty of Science, UNILAG
    expect(isInsideUnilagBoundary({ lat: 6.520, lng: 3.396 })).toBe(true)
  })
})

// ══════════════════════════════════════════
// 2. estimateCampusTrip
// ══════════════════════════════════════════

describe('estimateCampusTrip', () => {
  it('should return positive distance for two different campus points', () => {
    const result = estimateCampusTrip(
      { lat: 6.505, lng: 3.385 },
      { lat: 6.520, lng: 3.398 }
    )
    expect(result.estimatedDistanceMeters).toBeGreaterThan(0)
    expect(result.estimatedDurationMinutes).toBeGreaterThan(0)
  })

  it('should return 0 distance for identical pickup and dropoff', () => {
    const result = estimateCampusTrip(
      { lat: 6.515, lng: 3.391 },
      { lat: 6.515, lng: 3.391 }
    )
    expect(result.estimatedDistanceMeters).toBe(0)
    // Duration should still be at least 5 minutes (minimum)
    expect(result.estimatedDurationMinutes).toBe(5)
  })

  it('should return at least 5 minutes duration (minimum)', () => {
    // Very close points
    const result = estimateCampusTrip(
      { lat: 6.515, lng: 3.391 },
      { lat: 6.5151, lng: 3.3911 }
    )
    expect(result.estimatedDurationMinutes).toBeGreaterThanOrEqual(5)
  })

  it('should apply the 1.4x route factor to straight-line distance', () => {
    // Calculate straight-line distance manually
    const pickup = { lat: 6.505, lng: 3.385 }
    const dropoff = { lat: 6.520, lng: 3.398 }

    const latDiffKm = (dropoff.lat - pickup.lat) * 111
    const lngDiffKm = (dropoff.lng - pickup.lng) * 111 * Math.cos(((pickup.lat + dropoff.lat) / 2) * Math.PI / 180)
    const straightLineKm = Math.sqrt(latDiffKm ** 2 + lngDiffKm ** 2)
    const expectedRouteDistanceMeters = Math.round(straightLineKm * 1000 * 1.4)

    const result = estimateCampusTrip(pickup, dropoff)
    expect(result.estimatedDistanceMeters).toBe(expectedRouteDistanceMeters)
  })

  it('should estimate longer duration for longer distances', () => {
    const shortTrip = estimateCampusTrip(
      { lat: 6.515, lng: 3.391 },
      { lat: 6.516, lng: 3.392 }
    )
    const longTrip = estimateCampusTrip(
      { lat: 6.505, lng: 3.385 },
      { lat: 6.525, lng: 3.399 }
    )
    expect(longTrip.estimatedDistanceMeters).toBeGreaterThan(shortTrip.estimatedDistanceMeters)
    expect(longTrip.estimatedDurationMinutes).toBeGreaterThanOrEqual(shortTrip.estimatedDurationMinutes)
  })

  it('should respect custom speed parameter', () => {
    const result15kmh = estimateCampusTrip(
      { lat: 6.505, lng: 3.385 },
      { lat: 6.520, lng: 3.398 },
      15
    )
    const result5kmh = estimateCampusTrip(
      { lat: 6.505, lng: 3.385 },
      { lat: 6.520, lng: 3.398 },
      5
    )
    // Slower speed should result in longer duration
    expect(result5kmh.estimatedDurationMinutes).toBeGreaterThan(result15kmh.estimatedDurationMinutes)
  })

  it('should return reasonable campus trip estimates (1-4 km, 5-30 min)', () => {
    // Cross-campus trip
    const result = estimateCampusTrip(
      { lat: 6.505, lng: 3.385 },
      { lat: 6.525, lng: 3.399 }
    )
    // Campus is ~2.5km x ~1.7km, so cross-campus should be 1-4 km with route factor
    expect(result.estimatedDistanceMeters).toBeGreaterThan(500)
    expect(result.estimatedDistanceMeters).toBeLessThan(5000)
    expect(result.estimatedDurationMinutes).toBeGreaterThanOrEqual(5)
    expect(result.estimatedDurationMinutes).toBeLessThanOrEqual(60)
  })
})

// ══════════════════════════════════════════
// 3. validateCampusRoute
// ══════════════════════════════════════════

describe('validateCampusRoute', () => {
  it('should return ok: true when both points are inside UNILAG', () => {
    const result = validateCampusRoute(
      { lat: 6.515, lng: 3.391 },
      { lat: 6.520, lng: 3.396 }
    )
    expect(result.ok).toBe(true)
  })

  it('should return error when pickup is outside UNILAG', () => {
    const result = validateCampusRoute(
      { lat: 6.530, lng: 3.391 }, // outside
      { lat: 6.520, lng: 3.396 }
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('inside campus')
    }
  })

  it('should return error when dropoff is outside UNILAG', () => {
    const result = validateCampusRoute(
      { lat: 6.515, lng: 3.391 },
      { lat: 6.530, lng: 3.396 } // outside
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('inside campus')
    }
  })

  it('should return error when both points are outside UNILAG', () => {
    const result = validateCampusRoute(
      { lat: 6.530, lng: 3.380 },
      { lat: 6.540, lng: 3.410 }
    )
    expect(result.ok).toBe(false)
  })

  it('should return error when pickup is null', () => {
    const result = validateCampusRoute(null, { lat: 6.520, lng: 3.396 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('required')
    }
  })

  it('should return error when dropoff is null', () => {
    const result = validateCampusRoute({ lat: 6.515, lng: 3.391 }, null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('required')
    }
  })

  it('should return error when both are null', () => {
    const result = validateCampusRoute(null, null)
    expect(result.ok).toBe(false)
  })
})

// ══════════════════════════════════════════
// 4. isValidCoordinate
// ══════════════════════════════════════════

describe('isValidCoordinate', () => {
  it('should return true for valid numbers', () => {
    expect(isValidCoordinate(6.515)).toBe(true)
    expect(isValidCoordinate(0)).toBe(true)
    expect(isValidCoordinate(-3.391)).toBe(true)
  })

  it('should return false for NaN', () => {
    expect(isValidCoordinate(NaN)).toBe(false)
  })

  it('should return false for Infinity', () => {
    expect(isValidCoordinate(Infinity)).toBe(false)
    expect(isValidCoordinate(-Infinity)).toBe(false)
  })

  it('should return false for strings', () => {
    expect(isValidCoordinate('6.515')).toBe(false)
  })

  it('should return false for undefined/null', () => {
    expect(isValidCoordinate(undefined)).toBe(false)
    expect(isValidCoordinate(null as unknown as number)).toBe(false)
  })
})

// ══════════════════════════════════════════
// 5. normalizeCoordinate
// ══════════════════════════════════════════

describe('normalizeCoordinate', () => {
  it('should return the number for valid number input', () => {
    expect(normalizeCoordinate(6.515)).toBe(6.515)
  })

  it('should parse valid numeric strings', () => {
    expect(normalizeCoordinate('6.515')).toBe(6.515)
    expect(normalizeCoordinate('3.391')).toBe(3.391)
  })

  it('should return null for non-numeric strings', () => {
    expect(normalizeCoordinate('abc')).toBeNull()
  })

  it('should return null for empty strings', () => {
    expect(normalizeCoordinate('')).toBeNull()
    expect(normalizeCoordinate('   ')).toBeNull()
  })

  it('should return null for NaN', () => {
    expect(normalizeCoordinate(NaN)).toBeNull()
  })

  it('should return null for Infinity', () => {
    expect(normalizeCoordinate(Infinity)).toBeNull()
  })

  it('should return null for boolean and object types', () => {
    expect(normalizeCoordinate(true as unknown)).toBeNull()
    expect(normalizeCoordinate({} as unknown)).toBeNull()
  })
})

// ══════════════════════════════════════════
// 6. getTaskLifecycleTimestamps
// ══════════════════════════════════════════

describe('getTaskLifecycleTimestamps', () => {
  it('should return matchedAt when status is matched', () => {
    const result = getTaskLifecycleTimestamps('matched')
    expect(result.matchedAt).toBeInstanceOf(Date)
    expect(result.pickedUpAt).toBeUndefined()
    expect(result.deliveringAt).toBeUndefined()
  })

  it('should return pickedUpAt when status is picked_up', () => {
    const result = getTaskLifecycleTimestamps('picked_up')
    expect(result.pickedUpAt).toBeInstanceOf(Date)
    expect(result.matchedAt).toBeUndefined()
  })

  it('should return deliveringAt when status is delivering', () => {
    const result = getTaskLifecycleTimestamps('delivering')
    expect(result.deliveringAt).toBeInstanceOf(Date)
  })

  it('should return arrivedAt when status is arrived', () => {
    const result = getTaskLifecycleTimestamps('arrived')
    expect(result.arrivedAt).toBeInstanceOf(Date)
  })

  it('should return completedAt when status is completed', () => {
    const result = getTaskLifecycleTimestamps('completed')
    expect(result.completedAt).toBeInstanceOf(Date)
  })

  it('should return cancelledAt when status is cancelled', () => {
    const result = getTaskLifecycleTimestamps('cancelled')
    expect(result.cancelledAt).toBeInstanceOf(Date)
  })

  it('should return all undefined for open status', () => {
    const result = getTaskLifecycleTimestamps('open')
    expect(result.matchedAt).toBeUndefined()
    expect(result.pickedUpAt).toBeUndefined()
    expect(result.deliveringAt).toBeUndefined()
    expect(result.arrivedAt).toBeUndefined()
    expect(result.completedAt).toBeUndefined()
    expect(result.cancelledAt).toBeUndefined()
  })
})

// ══════════════════════════════════════════
// 7. getTaskStatusLabel
// ══════════════════════════════════════════

describe('getTaskStatusLabel', () => {
  it('should return human-readable labels for all statuses', () => {
    expect(getTaskStatusLabel('open')).toBe('Open')
    expect(getTaskStatusLabel('assigned')).toBe('Assigned')
    expect(getTaskStatusLabel('matched')).toBe('Matched')
    expect(getTaskStatusLabel('runner_heading_to_pickup')).toBe('Runner Heading To Pickup')
    expect(getTaskStatusLabel('picked_up')).toBe('Picked Up')
    expect(getTaskStatusLabel('delivering')).toBe('Delivering')
    expect(getTaskStatusLabel('arrived')).toBe('Arrived')
    expect(getTaskStatusLabel('completed')).toBe('Completed')
    expect(getTaskStatusLabel('cancelled')).toBe('Cancelled')
  })

  it('should return the status string itself for unknown statuses', () => {
    expect(getTaskStatusLabel('unknown_status')).toBe('unknown_status')
  })
})
