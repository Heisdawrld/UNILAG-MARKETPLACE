/**
 * validation.test.ts — Tests for Zod validation schemas
 *
 * Tests valid and invalid inputs for key schemas.
 * No database or external services required.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock next/server since validateBody uses NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
    }),
  },
}))

import {
  AuthRegisterSchema,
  ListingCreateSchema,
  DeliveryCreateSchema,
  ReviewCreateSchema,
  MessageCreateSchema,
  PaymentInitializeSchema,
  RunnerApplicationSchema,
  validateBody,
} from '@/lib/validation'

// ── AuthRegisterSchema ──

describe('AuthRegisterSchema', () => {
  it('should accept a valid registration', () => {
    const result = AuthRegisterSchema.safeParse({
      username: 'john_doe',
      email: 'john@unilag.edu.ng',
      faculty: 'Engineering',
      department: 'Computer Science',
      level: '400',
    })
    expect(result.success).toBe(true)
  })

  it('should reject username with special characters', () => {
    const result = AuthRegisterSchema.safeParse({
      username: 'john@doe!',
      email: 'john@unilag.edu.ng',
    })
    expect(result.success).toBe(false)
  })

  it('should reject username shorter than 3 chars', () => {
    const result = AuthRegisterSchema.safeParse({
      username: 'ab',
      email: 'john@unilag.edu.ng',
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid email', () => {
    const result = AuthRegisterSchema.safeParse({
      username: 'john_doe',
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('should accept username with underscores and numbers', () => {
    const result = AuthRegisterSchema.safeParse({
      username: 'user_123',
      email: 'user@test.com',
    })
    expect(result.success).toBe(true)
  })

  it('should trim whitespace from fields', () => {
    const result = AuthRegisterSchema.safeParse({
      username: '  john_doe  ',
      email: '  john@test.com  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.username).toBe('john_doe')
      expect(result.data.email).toBe('john@test.com')
    }
  })

  it('should reject username longer than 30 chars', () => {
    const result = AuthRegisterSchema.safeParse({
      username: 'a'.repeat(31),
      email: 'john@test.com',
    })
    expect(result.success).toBe(false)
  })
})

// ── ListingCreateSchema ──

describe('ListingCreateSchema', () => {
  it('should accept a valid listing', () => {
    const result = ListingCreateSchema.safeParse({
      title: 'MacBook Pro 2023',
      price: 500000,
      category: 'Electronics',
    })
    expect(result.success).toBe(true)
  })

  it('should reject listing without required title', () => {
    const result = ListingCreateSchema.safeParse({
      price: 500000,
      category: 'Electronics',
    })
    expect(result.success).toBe(false)
  })

  it('should reject negative price', () => {
    const result = ListingCreateSchema.safeParse({
      title: 'Test',
      price: -100,
      category: 'Electronics',
    })
    expect(result.success).toBe(false)
  })

  it('should reject price above 10,000,000', () => {
    const result = ListingCreateSchema.safeParse({
      title: 'Test',
      price: 10000001,
      category: 'Electronics',
    })
    expect(result.success).toBe(false)
  })

  it('should accept zero price', () => {
    const result = ListingCreateSchema.safeParse({
      title: 'Free Item',
      price: 0,
      category: 'Free',
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid condition values', () => {
    const conditions = ['brand_new', 'like_new', 'good', 'fair', 'poor']
    for (const condition of conditions) {
      const result = ListingCreateSchema.safeParse({
        title: 'Item',
        price: 1000,
        category: 'Test',
        condition,
      })
      expect(result.success).toBe(true)
    }
  })

  it('should reject invalid condition value', () => {
    const result = ListingCreateSchema.safeParse({
      title: 'Item',
      price: 1000,
      category: 'Test',
      condition: 'excellent',
    })
    expect(result.success).toBe(false)
  })

  it('should accept up to 10 images', () => {
    const result = ListingCreateSchema.safeParse({
      title: 'Item',
      price: 1000,
      category: 'Test',
      images: Array(10).fill('https://example.com/img.jpg'),
    })
    expect(result.success).toBe(true)
  })

  it('should reject more than 10 images', () => {
    const result = ListingCreateSchema.safeParse({
      title: 'Item',
      price: 1000,
      category: 'Test',
      images: Array(11).fill('https://example.com/img.jpg'),
    })
    expect(result.success).toBe(false)
  })
})

// ── DeliveryCreateSchema ──

describe('DeliveryCreateSchema', () => {
  const validDelivery = {
    title: 'Deliver my textbook',
    pickupLat: 6.515,
    pickupLng: 3.395,
    pickupAddress: 'Jaja Hall, UNILAG',
    dropoffLat: 6.520,
    dropoffLng: 3.400,
    dropoffAddress: 'Faculty of Science, UNILAG',
    customerPrice: 500,
    category: 'documents' as const,
  }

  it('should accept a valid delivery', () => {
    const result = DeliveryCreateSchema.safeParse(validDelivery)
    expect(result.success).toBe(true)
  })

  it('should default urgency to standard', () => {
    const result = DeliveryCreateSchema.safeParse(validDelivery)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.urgency).toBe('standard')
    }
  })

  it('should reject pickup lat outside UNILAG range', () => {
    const result = DeliveryCreateSchema.safeParse({
      ...validDelivery,
      pickupLat: 5.0,  // Way outside UNILAG
    })
    expect(result.success).toBe(false)
  })

  it('should reject pickup lng outside UNILAG range', () => {
    const result = DeliveryCreateSchema.safeParse({
      ...validDelivery,
      pickupLng: 1.0,  // Way outside UNILAG
    })
    expect(result.success).toBe(false)
  })

  it('should reject customerPrice below 100', () => {
    const result = DeliveryCreateSchema.safeParse({
      ...validDelivery,
      customerPrice: 50,
    })
    expect(result.success).toBe(false)
  })

  it('should reject customerPrice above 50000', () => {
    const result = DeliveryCreateSchema.safeParse({
      ...validDelivery,
      customerPrice: 60000,
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid category', () => {
    const result = DeliveryCreateSchema.safeParse({
      ...validDelivery,
      category: 'furniture',
    })
    expect(result.success).toBe(false)
  })

  it('should accept all valid categories', () => {
    const categories = ['food', 'documents', 'packages', 'groceries', 'laundry', 'medication', 'electronics', 'other']
    for (const category of categories) {
      const result = DeliveryCreateSchema.safeParse({
        ...validDelivery,
        category,
      })
      expect(result.success).toBe(true)
    }
  })

  it('should accept all valid urgency levels', () => {
    const urgencies = ['standard', 'express', 'urgent'] as const
    for (const urgency of urgencies) {
      const result = DeliveryCreateSchema.safeParse({
        ...validDelivery,
        urgency,
      })
      expect(result.success).toBe(true)
    }
  })

  it('should reject missing required fields', () => {
    const result = DeliveryCreateSchema.safeParse({
      title: 'Missing fields delivery',
    })
    expect(result.success).toBe(false)
  })
})

// ── ReviewCreateSchema ──

describe('ReviewCreateSchema', () => {
  it('should accept a valid review', () => {
    const result = ReviewCreateSchema.safeParse({
      sellerId: 'seller-123',
      rating: 5,
      comment: 'Great seller!',
    })
    expect(result.success).toBe(true)
  })

  it('should reject rating below 1', () => {
    const result = ReviewCreateSchema.safeParse({
      sellerId: 'seller-123',
      rating: 0,
    })
    expect(result.success).toBe(false)
  })

  it('should reject rating above 5', () => {
    const result = ReviewCreateSchema.safeParse({
      sellerId: 'seller-123',
      rating: 6,
    })
    expect(result.success).toBe(false)
  })

  it('should reject non-integer rating', () => {
    const result = ReviewCreateSchema.safeParse({
      sellerId: 'seller-123',
      rating: 3.5,
    })
    expect(result.success).toBe(false)
  })

  it('should accept review without comment', () => {
    const result = ReviewCreateSchema.safeParse({
      sellerId: 'seller-123',
      rating: 4,
    })
    expect(result.success).toBe(true)
  })
})

// ── MessageCreateSchema ──

describe('MessageCreateSchema', () => {
  it('should accept a valid message', () => {
    const result = MessageCreateSchema.safeParse({
      chatId: 'chat-123',
      message: 'Hello, is this still available?',
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty message', () => {
    const result = MessageCreateSchema.safeParse({
      chatId: 'chat-123',
      message: '',
    })
    expect(result.success).toBe(false)
  })

  it('should reject message over 5000 chars', () => {
    const result = MessageCreateSchema.safeParse({
      chatId: 'chat-123',
      message: 'a'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })

  it('should accept message with optional imageUrl', () => {
    const result = MessageCreateSchema.safeParse({
      chatId: 'chat-123',
      message: 'Check this out',
      imageUrl: 'https://example.com/image.jpg',
    })
    expect(result.success).toBe(true)
  })
})

// ── PaymentInitializeSchema ──

describe('PaymentInitializeSchema', () => {
  it('should accept valid boost payment', () => {
    const result = PaymentInitializeSchema.safeParse({
      type: 'boost',
      amount: 500,
    })
    expect(result.success).toBe(true)
  })

  it('should default currency to NGN', () => {
    const result = PaymentInitializeSchema.safeParse({
      type: 'boost',
      amount: 500,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currency).toBe('NGN')
    }
  })

  it('should reject invalid payment type', () => {
    const result = PaymentInitializeSchema.safeParse({
      type: 'invalid',
      amount: 500,
    })
    expect(result.success).toBe(false)
  })

  it('should reject zero amount', () => {
    const result = PaymentInitializeSchema.safeParse({
      type: 'boost',
      amount: 0,
    })
    expect(result.success).toBe(false)
  })

  it('should reject negative amount', () => {
    const result = PaymentInitializeSchema.safeParse({
      type: 'boost',
      amount: -100,
    })
    expect(result.success).toBe(false)
  })
})

// ── RunnerApplicationSchema ──

describe('RunnerApplicationSchema', () => {
  it('should accept a valid runner application', () => {
    const result = RunnerApplicationSchema.safeParse({
      studentId: '71890123AB',
      profilePhoto: 'https://example.com/photo.jpg',
      studentIdImage: 'https://example.com/id.jpg',
      transportMode: 'bicycle',
    })
    expect(result.success).toBe(true)
  })

  it('should accept without transport mode', () => {
    const result = RunnerApplicationSchema.safeParse({
      studentId: '71890123AB',
      profilePhoto: 'https://example.com/photo.jpg',
      studentIdImage: 'https://example.com/id.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid transport mode', () => {
    const result = RunnerApplicationSchema.safeParse({
      studentId: '71890123AB',
      profilePhoto: 'https://example.com/photo.jpg',
      studentIdImage: 'https://example.com/id.jpg',
      transportMode: 'helicopter',
    })
    expect(result.success).toBe(false)
  })

  it('should reject missing required fields', () => {
    const result = RunnerApplicationSchema.safeParse({
      studentId: '71890123AB',
    })
    expect(result.success).toBe(false)
  })
})

// ── validateBody helper ──

describe('validateBody', () => {
  it('should return data on valid input', () => {
    const { data, error } = validateBody(ReviewCreateSchema, {
      sellerId: 'seller-123',
      rating: 5,
    })
    expect(error).toBeNull()
    expect(data).toEqual({
      sellerId: 'seller-123',
      rating: 5,
    })
  })

  it('should return error response on invalid input', () => {
    const { data, error } = validateBody(ReviewCreateSchema, {
      sellerId: 'seller-123',
      rating: 10,  // Invalid: max 5
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.status).toBe(400)
  })

  it('should return error response on missing fields', () => {
    const { data, error } = validateBody(ReviewCreateSchema, {})
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.status).toBe(400)
  })
})
