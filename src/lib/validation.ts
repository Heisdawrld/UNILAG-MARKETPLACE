/**
 * validation.ts — Zod schemas for all API request bodies
 *
 * Type-safe validation + sanitization in one step.
 * Every API route should validate its input with these schemas.
 *
 * Usage:
 *   const result = DeliveryCreateSchema.safeParse(body)
 *   if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
 *   const data = result.data  // fully typed & sanitized
 */

import { z } from 'zod/v4'

// ── Helper: sanitized string (trim + max length) ──
const text = (max: number = 1000) => z.string().trim().max(max)
const requiredText = (max: number = 1000) => z.string().trim().min(1).max(max)

// ── Auth Schemas ──

export const AuthRegisterSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username: letters, numbers, underscores only'),
  email: z.string().trim().email().max(254),
  faculty: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  level: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(20).optional(),
  hostel: z.string().trim().max(100).optional(),
})

export const AuthProfileUpdateSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(20).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  faculty: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  level: z.string().trim().max(20).optional(),
  hostel: z.string().trim().max(100).optional(),
  avatar: z.string().trim().max(2048).optional(),
})

// ── Listing Schemas ──

export const ListingCreateSchema = z.object({
  title: requiredText(200),
  description: text(5000).optional(),
  price: z.number().min(0).max(10000000),
  category: z.string().trim().min(1).max(50),
  condition: z.enum(['brand_new', 'like_new', 'good', 'fair', 'poor']).optional(),
  images: z.array(z.string().trim().max(2048)).max(10).optional(),
  storeId: z.string().trim().optional(),
  negotiable: z.boolean().optional(),
  location: z.string().trim().max(200).optional(),
})

export const ListingUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: text(5000).optional(),
  price: z.number().min(0).max(10000000).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  condition: z.enum(['brand_new', 'like_new', 'good', 'fair', 'poor']).optional(),
  images: z.array(z.string().trim().max(2048)).max(10).optional(),
  status: z.enum(['available', 'sold', 'reserved', 'draft']).optional(),
  negotiable: z.boolean().optional(),
  location: z.string().trim().max(200).optional(),
})

// ── Delivery Schemas ──

const UNILAG_LAT_RANGE = { min: 6.496, max: 6.535 }
const UNILAG_LNG_RANGE = { min: 3.372, max: 3.417 }

export const DeliveryCreateSchema = z.object({
  title: requiredText(200),
  description: text(2000).optional(),
  pickupLat: z.number().min(UNILAG_LAT_RANGE.min).max(UNILAG_LAT_RANGE.max),
  pickupLng: z.number().min(UNILAG_LNG_RANGE.min).max(UNILAG_LNG_RANGE.max),
  pickupAddress: requiredText(300),
  dropoffLat: z.number().min(UNILAG_LAT_RANGE.min).max(UNILAG_LAT_RANGE.max),
  dropoffLng: z.number().min(UNILAG_LNG_RANGE.min).max(UNILAG_LNG_RANGE.max),
  dropoffAddress: requiredText(300),
  customerPrice: z.number().min(100).max(50000),
  category: z.enum(['food', 'documents', 'packages', 'groceries', 'laundry', 'medication', 'electronics', 'other']),
  urgency: z.enum(['standard', 'express', 'urgent']).optional().default('standard'),
  itemImages: z.array(z.string().trim().max(2048)).max(5).optional(),
})

export const DeliveryUpdateSchema = z.object({
  action: z.enum(['confirm', 'cancel']),
  rating: z.number().min(1).max(5).optional(),
  review: text(1000).optional(),
  cancelReason: text(500).optional(),
  cancelledBy: z.string().trim().max(50).optional(),
})

// ── Chat & Message Schemas ──

export const ChatCreateSchema = z.object({
  listingId: z.string().trim().min(1),
  sellerId: z.string().trim().min(1),
})

export const MessageCreateSchema = z.object({
  chatId: z.string().trim().min(1),
  message: z.string().trim().min(1).max(5000),
  imageUrl: z.string().trim().max(2048).optional(),
})

// ── Review Schema ──

export const ReviewCreateSchema = z.object({
  sellerId: z.string().trim().min(1),
  listingId: z.string().trim().optional(),
  rating: z.number().int().min(1).max(5),
  comment: text(1000).optional(),
})

// ── Report Schema ──

export const ReportCreateSchema = z.object({
  listingId: z.string().trim().min(1),
  reason: z.enum(['scam', 'fake_listing', 'harassment', 'spam', 'illegal_item']),
  description: text(1000).optional(),
})

// ── Store Schemas ──

export const StoreCreateSchema = z.object({
  name: requiredText(100),
  description: text(2000).optional(),
  category: z.string().trim().min(1).max(50),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9\-]+$/).optional(),
  coverImage: z.string().trim().max(2048).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  location: z.string().trim().max(200).optional(),
})

// ── Payment Schema ──

export const PaymentInitializeSchema = z.object({
  type: z.enum(['boost', 'vendor_subscription', 'sponsored_ad']),
  amount: z.number().positive(),
  listingId: z.string().trim().optional(),
  currency: z.string().trim().length(3).optional().default('NGN'),
})

// ── User Profile Schema (for PATCH /api/users/[id]) ──

export const UserProfileUpdateSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatar: z.string().trim().max(2048).optional(),
  faculty: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  level: z.string().trim().max(20).optional(),
  bio: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(20).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  hostel: z.string().trim().max(100).optional(),
})

// ── Notification Schema ──

export const NotificationReadSchema = z.object({
  notificationId: z.string().trim().optional(),
  all: z.boolean().optional(),
})

// ── Saved Listing Schema ──

export const SavedListingSchema = z.object({
  listingId: z.string().trim().min(1),
})

// ── Push Subscription Schema ──

export const PushSubscribeSchema = z.object({
  endpoint: z.string().trim().min(1).max(2048).url(),
  keys: z.object({
    p256dh: z.string().trim().min(1),
    auth: z.string().trim().min(1),
  }),
})

// ── Runner Application Schema ──

export const RunnerApplicationSchema = z.object({
  studentId: z.string().trim().min(1).max(50),
  profilePhoto: z.string().trim().min(1).max(2048),
  studentIdImage: z.string().trim().min(1).max(2048),
  transportMode: z.enum(['walking', 'bicycle', 'motorcycle', 'car']).optional(),
})

// ── Runner Location Schema ──

export const RunnerLocationSchema = z.object({
  lat: z.number().min(UNILAG_LAT_RANGE.min).max(UNILAG_LAT_RANGE.max),
  lng: z.number().min(UNILAG_LNG_RANGE.min).max(UNILAG_LNG_RANGE.max),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
})

// ── Task Schemas ──

export const TaskCreateSchema = z.object({
  title: requiredText(200),
  description: text(2000).optional(),
  category: z.string().trim().min(1).max(50),
  reward: z.number().min(100).max(50000),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  pickupAddress: text(300).optional(),
  dropoffAddress: text(300).optional(),
  urgency: z.enum(['standard', 'express', 'urgent']).optional().default('standard'),
})

export const TaskOfferSchema = z.object({
  amount: z.number().min(0).max(10000000),
  message: text(500).optional(),
})

// ── Validation helper ──

import { NextResponse } from 'next/server'

/**
 * Validate a request body against a Zod schema.
 * Returns parsed data on success, or an error response on failure.
 *
 * Usage:
 *   const { data, error } = validateBody(DeliveryCreateSchema, body)
 *   if (error) return error
 *   // data is fully typed
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { data: T; error: null } | { data: null; error: NextResponse } {
  const result = schema.safeParse(body)

  if (result.success) {
    return { data: result.data, error: null }
  }

  const errors = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))

  return {
    data: null,
    error: NextResponse.json(
      { error: 'Validation failed', details: errors },
      { status: 400 }
    ),
  }
}
