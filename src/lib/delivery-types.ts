/**
 * delivery-types.ts — Delivery System Type Definitions
 */

export type DeliveryOrderStatus =
  | 'created' | 'searching' | 'runner_assigned' | 'runner_en_route'
  | 'picked_up' | 'in_transit' | 'delivered' | 'completed' | 'cancelled'

export type DeliveryOfferStatus = 'open' | 'accepted' | 'rejected' | 'expired' | 'withdrawn'

export type DeliveryCancelReason =
  | 'customer_cancelled' | 'runner_cancelled' | 'runner_no_show'
  | 'customer_no_show' | 'item_unavailable' | 'safety_concern'
  | 'system_cancelled' | 'dispute'

export type TransportMode = 'walking' | 'bicycle' | 'motorcycle' | 'car'

export type DeliveryCategory = 'food' | 'documents' | 'packages' | 'groceries' | 'laundry' | 'medication' | 'electronics' | 'other'

export type DeliveryType = 'marketplace' | 'food_pickup' | 'errand' | 'pharmacy'

export type ItemPaymentMethod = 'prepaid' | 'cash_on_delivery' | 'already_paid'

export type UrgencyLevel = 'standard' | 'express' | 'urgent'

export interface ClientToServerEvents {
  'runner:location': (data: { lat: number; lng: number; heading?: number | null; speed?: number | null }) => void
  'runner:status': (data: { status: 'available' | 'busy' | 'offline' }) => void
  'runner:heartbeat': () => void
  'delivery:create': (data: {
    pickupLat: number; pickupLng: number; pickupAddress: string
    dropoffLat: number; dropoffLng: number; dropoffAddress: string
    customerPrice: number; category: DeliveryCategory; urgency: UrgencyLevel
    title: string; description: string; itemImages?: string[]
    deliveryType?: DeliveryType; itemCost?: number; itemPaymentMethod?: ItemPaymentMethod
    quickAccept?: boolean; preferredRunnerGender?: 'male' | 'female' | 'any'; safeMeetupPoint?: string
  }) => void
  'delivery:offer': (data: { orderId: string; runnerPrice: number; estimatedArrivalMinutes?: number; message?: string }) => void
  'delivery:accept-offer': (data: { orderId: string; offerId: string }) => void
  'delivery:reject-offer': (data: { orderId: string; offerId: string }) => void
  'delivery:runner-en-route': (data: { orderId: string }) => void
  'delivery:in-transit': (data: { orderId: string }) => void
  'delivery:pickup': (data: { orderId: string; pickupCode?: string }) => void
  'delivery:dropoff': (data: { orderId: string; dropoffCode?: string }) => void
  'delivery:confirm': (data: { orderId: string; rating: number; review?: string }) => void
  'delivery:cancel': (data: { orderId: string; reason: DeliveryCancelReason }) => void
  'delivery:watch': (data: { orderId: string }) => void
  'delivery:unwatch': (data: { orderId: string }) => void
  'delivery:message': (data: { orderId: string; message: string }) => void
}

export interface ServerToClientEvents {
  'delivery:request': (data: {
    orderId: string; customerPrice: number; category: DeliveryCategory
    urgency: UrgencyLevel; title: string
    pickupLat: number; pickupLng: number; pickupAddress: string
    dropoffLat: number; dropoffLng: number; dropoffAddress: string
    estimatedDistanceMeters: number; estimatedDurationMinutes: number; surgeMultiplier: number
  }) => void
  'delivery:offer-received': (data: {
    offerId: string; orderId: string; runnerId: string; runnerUsername: string
    runnerAvatar: string | null; runnerRating: number; runnerTasksCompleted: number
    runnerTransportMode: TransportMode; runnerPrice: number
    estimatedArrivalMinutes: number | null; message: string | null; expiresAt: string
  }) => void
  'delivery:offer-accepted': (data: {
    orderId: string; customerUsername: string; customerAvatar: string | null
    customerPhone: string | null; pickupLat: number; pickupLng: number
    pickupAddress: string; pickupCode: string; dropoffCode?: string | null
    deliveryType?: DeliveryType; itemCost?: number | null; itemPaymentMethod?: ItemPaymentMethod | null
  }) => void
  'delivery:offer-rejected': (data: { orderId: string }) => void
  'delivery:status': (data: {
    orderId: string; status: DeliveryOrderStatus; timestamp: string; metadata?: Record<string, unknown>
  }) => void
  'runner:location-update': (data: {
    orderId: string; runnerId: string; lat: number; lng: number
    heading: number | null; speed: number | null; updatedAt: number
  }) => void
  'delivery:eta': (data: { orderId: string; etaMinutes: number; distanceMeters: number }) => void
  'delivery:unavailable': (data: { orderId: string }) => void
  'delivery:runner-contact': (data: { runnerPhone: string | null }) => void
  'delivery:message': (data: {
    id: string; orderId: string; senderId: string
    message: string; type: string; createdAt: string
  }) => void
  'error': (data: { message: string; code: string }) => void
}

export const DELIVERY_CATEGORY_BASELINES: Record<DeliveryCategory, { min: number; max: number }> = {
  food: { min: 800, max: 1500 }, documents: { min: 500, max: 1000 },
  packages: { min: 900, max: 1600 }, groceries: { min: 1000, max: 1800 },
  laundry: { min: 700, max: 1200 }, medication: { min: 600, max: 1100 },
  electronics: { min: 1000, max: 2000 }, other: { min: 800, max: 1500 },
}

export const URGENCY_MULTIPLIERS: Record<UrgencyLevel, number> = {
  standard: 1.0, express: 1.3, urgent: 1.7,
}

export const PLATFORM_COMMISSION_RATE = 0.12
export const OFFER_TTL_SECONDS = 60
export const SEARCH_TIMEOUT_SECONDS = 60
export const PICKUP_CODE_LENGTH = 4
