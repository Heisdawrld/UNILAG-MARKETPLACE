export type RunnerAvailabilityStatus = 'offline' | 'available' | 'busy';

export type RunnerNegotiationStatus = 'open' | 'negotiating' | 'matched' | 'closed';

export type RunnerTaskStatus =
  | 'open'
  | 'assigned'
  | 'matched'
  | 'runner_heading_to_pickup'
  | 'picked_up'
  | 'delivering'
  | 'arrived'
  | 'completed'
  | 'cancelled';

export type RunnerOfferStatus = 'open' | 'accepted' | 'rejected' | 'expired' | 'superseded';

export const UNILAG_SERVICE_AREA = {
  id: 'unilag',
  name: 'UNILAG Campus',
  // Initial safe campus bounding box. Can be refined to polygon later.
  minLat: 6.496,
  maxLat: 6.535,
  minLng: 3.372,
  maxLng: 3.417,
  centerLat: 6.5154,
  centerLng: 3.3915,
} as const;

export type RunnerCoordinate = {
  lat: number;
  lng: number;
};

export function isValidCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function isInsideUnilagBoundary(point: RunnerCoordinate) {
  return (
    point.lat >= UNILAG_SERVICE_AREA.minLat &&
    point.lat <= UNILAG_SERVICE_AREA.maxLat &&
    point.lng >= UNILAG_SERVICE_AREA.minLng &&
    point.lng <= UNILAG_SERVICE_AREA.maxLng
  );
}

export function validateCampusRoute(
  pickup: RunnerCoordinate | null,
  dropoff: RunnerCoordinate | null,
) {
  if (!pickup || !dropoff) {
    return {
      ok: false,
      error: 'Pickup and dropoff pins are required for Runner requests.',
    };
  }

  if (!isInsideUnilagBoundary(pickup) || !isInsideUnilagBoundary(dropoff)) {
    return {
      ok: false,
      error: 'Runner currently works only inside UNILAG. Move both pickup and dropoff inside campus.',
    };
  }

  return { ok: true as const };
}

export function estimateCampusTrip(
  pickup: RunnerCoordinate,
  dropoff: RunnerCoordinate,
) {
  const latDiffKm = (dropoff.lat - pickup.lat) * 111;
  const lngDiffKm = (dropoff.lng - pickup.lng) * 111 * Math.cos(((pickup.lat + dropoff.lat) / 2) * Math.PI / 180);
  const distanceKm = Math.sqrt((latDiffKm ** 2) + (lngDiffKm ** 2));
  const estimatedDistanceMeters = Math.round(distanceKm * 1000);
  const estimatedDurationMinutes = Math.max(3, Math.round((distanceKm / 12) * 60));

  return {
    estimatedDistanceMeters,
    estimatedDurationMinutes,
  };
}

export function getTaskLifecycleTimestamps(status: RunnerTaskStatus) {
  const now = new Date();

  return {
    matchedAt: status === 'matched' ? now : undefined,
    pickedUpAt: status === 'picked_up' ? now : undefined,
    deliveringAt: status === 'delivering' ? now : undefined,
    arrivedAt: status === 'arrived' ? now : undefined,
    completedAt: status === 'completed' ? now : undefined,
    cancelledAt: status === 'cancelled' ? now : undefined,
  };
}

export function getTaskStatusLabel(status: string) {
  return {
    open: 'Open',
    assigned: 'Assigned',
    matched: 'Matched',
    runner_heading_to_pickup: 'Runner Heading To Pickup',
    picked_up: 'Picked Up',
    delivering: 'Delivering',
    arrived: 'Arrived',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }[status] || status;
}
