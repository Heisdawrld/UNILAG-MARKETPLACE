/**
 * image-service.test.ts — Tests for image service utilities
 *
 * Tests pure functions: parseImageArray, stringifyImageArray,
 * isCloudUrl, isDataUrl, isValidImageUrl, validateBase64Image
 * No database or external services required.
 */

import { describe, it, expect } from 'vitest'
import {
  parseImageArray,
  stringifyImageArray,
  isCloudUrl,
  isDataUrl,
  isValidImageUrl,
  validateBase64Image,
  validateImageUrls,
} from '@/lib/image-service'

// ── isCloudUrl ──

describe('isCloudUrl', () => {
  it('should return true for https URLs', () => {
    expect(isCloudUrl('https://example.com/image.jpg')).toBe(true)
  })

  it('should return true for http URLs', () => {
    expect(isCloudUrl('http://example.com/image.jpg')).toBe(true)
  })

  it('should return true for Uploadthing URLs', () => {
    expect(isCloudUrl('https://utfs.io/f/abc123')).toBe(true)
  })

  it('should return false for data URLs', () => {
    expect(isCloudUrl('data:image/png;base64,abc123')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isCloudUrl('')).toBe(false)
  })

  it('should return false for non-string input', () => {
    expect(isCloudUrl(null as any)).toBe(false)
    expect(isCloudUrl(undefined as any)).toBe(false)
    expect(isCloudUrl(123 as any)).toBe(false)
  })

  it('should return false for relative paths', () => {
    expect(isCloudUrl('/images/photo.jpg')).toBe(false)
    expect(isCloudUrl('./photo.jpg')).toBe(false)
  })
})

// ── isDataUrl ──

describe('isDataUrl', () => {
  it('should return true for data:image URLs', () => {
    expect(isDataUrl('data:image/png;base64,abc123')).toBe(true)
  })

  it('should return true for data:application URLs', () => {
    expect(isDataUrl('data:application/pdf;base64,abc')).toBe(true)
  })

  it('should return false for https URLs', () => {
    expect(isDataUrl('https://example.com/image.jpg')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isDataUrl('')).toBe(false)
  })

  it('should return false for non-string input', () => {
    expect(isDataUrl(null as any)).toBe(false)
    expect(isDataUrl(undefined as any)).toBe(false)
  })
})

// ── isValidImageUrl ──

describe('isValidImageUrl', () => {
  it('should return true for cloud URLs', () => {
    expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true)
  })

  it('should return true for data URLs', () => {
    expect(isValidImageUrl('data:image/png;base64,abc123')).toBe(true)
  })

  it('should return false for invalid URLs', () => {
    expect(isValidImageUrl('not-a-url')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isValidImageUrl('')).toBe(false)
  })

  it('should return false for non-string input', () => {
    expect(isValidImageUrl(null as any)).toBe(false)
    expect(isValidImageUrl(undefined as any)).toBe(false)
  })

  it('should return false for relative paths', () => {
    expect(isValidImageUrl('/images/photo.jpg')).toBe(false)
  })
})

// ── parseImageArray ──

describe('parseImageArray', () => {
  it('should parse a valid JSON array of URLs', () => {
    const result = parseImageArray('["https://a.com/1.jpg","https://b.com/2.jpg"]')
    expect(result).toEqual(['https://a.com/1.jpg', 'https://b.com/2.jpg'])
  })

  it('should return single URL as array when not JSON', () => {
    const result = parseImageArray('https://example.com/image.jpg')
    expect(result).toEqual(['https://example.com/image.jpg'])
  })

  it('should return empty array for empty string', () => {
    expect(parseImageArray('')).toEqual([])
  })

  it('should filter out empty strings from array', () => {
    const result = parseImageArray('["https://a.com/1.jpg","","https://b.com/2.jpg"]')
    expect(result).toEqual(['https://a.com/1.jpg', 'https://b.com/2.jpg'])
  })

  it('should filter out non-string items from array', () => {
    const result = parseImageArray('["https://a.com/1.jpg",123,null,true,"https://b.com/2.jpg"]')
    expect(result).toEqual(['https://a.com/1.jpg', 'https://b.com/2.jpg'])
  })

  it('should return empty array for non-array JSON', () => {
    expect(parseImageArray('{"key": "value"}')).toEqual([])
  })

  it('should return empty array for JSON number', () => {
    expect(parseImageArray('42')).toEqual([])
  })

  it('should handle data URLs in the array', () => {
    const dataUrl = 'data:image/png;base64,iVBOR'
    const result = parseImageArray(`["${dataUrl}"]`)
    expect(result).toEqual([dataUrl])
  })
})

// ── stringifyImageArray ──

describe('stringifyImageArray', () => {
  it('should stringify an array of URLs', () => {
    const result = stringifyImageArray(['https://a.com/1.jpg', 'https://b.com/2.jpg'])
    expect(result).toBe('["https://a.com/1.jpg","https://b.com/2.jpg"]')
  })

  it('should filter out empty strings', () => {
    const result = stringifyImageArray(['https://a.com/1.jpg', '', 'https://b.com/2.jpg'])
    expect(JSON.parse(result)).toEqual(['https://a.com/1.jpg', 'https://b.com/2.jpg'])
  })

  it('should filter out null/undefined values', () => {
    const result = stringifyImageArray(['https://a.com/1.jpg', null as any, undefined as any])
    expect(JSON.parse(result)).toEqual(['https://a.com/1.jpg'])
  })

  it('should handle empty array', () => {
    const result = stringifyImageArray([])
    expect(result).toBe('[]')
  })

  it('should be the inverse of parseImageArray for valid arrays', () => {
    const original = ['https://a.com/1.jpg', 'https://b.com/2.jpg']
    const stringified = stringifyImageArray(original)
    const parsed = parseImageArray(stringified)
    expect(parsed).toEqual(original)
  })
})

// ── validateBase64Image ──

describe('validateBase64Image', () => {
  it('should accept a valid base64 image data URL', () => {
    const result = validateBase64Image('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
    expect(result.valid).toBe(true)
  })

  it('should reject non-image data URLs', () => {
    const result = validateBase64Image('data:application/pdf;base64,abc123')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Only image files')
  })

  it('should reject non-data-URL strings', () => {
    const result = validateBase64Image('https://example.com/image.jpg')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Only image files')
  })

  it('should reject empty string', () => {
    const result = validateBase64Image('')
    expect(result.valid).toBe(false)
  })

  it('should reject oversized images', () => {
    // Create a data URL that exceeds default max size (2.5MB)
    const largeBase64 = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024)  // 3MB
    const result = validateBase64Image(largeBase64)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('too large')
  })

  it('should accept image at exactly max size boundary', () => {
    // Create a data URL at exactly 2.5MB
    const exactSizeBase64 = 'data:image/png;base64,' + 'A'.repeat(2.5 * 1024 * 1024 - 'data:image/png;base64,'.length)
    const result = validateBase64Image(exactSizeBase64, 2.5 * 1024 * 1024)
    expect(result.valid).toBe(true)
  })

  it('should accept different image types', () => {
    const types = ['png', 'jpeg', 'jpg', 'webp', 'gif', 'svg+xml']
    for (const type of types) {
      const result = validateBase64Image(`data:image/${type};base64,abc123`)
      expect(result.valid).toBe(true)
    }
  })

  it('should use custom max size when provided', () => {
    // Create a data URL that is 500KB
    const mediumBase64 = 'data:image/png;base64,' + 'A'.repeat(500 * 1024)
    // Should be rejected with 400KB max
    const resultReject = validateBase64Image(mediumBase64, 400 * 1024)
    expect(resultReject.valid).toBe(false)

    // Should be accepted with 600KB max
    const resultAccept = validateBase64Image(mediumBase64, 600 * 1024)
    expect(resultAccept.valid).toBe(true)
  })
})

// ── validateImageUrls ──

describe('validateImageUrls', () => {
  it('should accept valid image URLs within limit', () => {
    const result = validateImageUrls([
      'https://example.com/1.jpg',
      'data:image/png;base64,abc',
    ])
    expect(result.valid).toBe(true)
  })

  it('should reject more than 5 images (default max)', () => {
    const urls = Array(6).fill('https://example.com/image.jpg')
    const result = validateImageUrls(urls)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Maximum')
  })

  it('should accept exactly 5 images', () => {
    const urls = Array(5).fill('https://example.com/image.jpg')
    const result = validateImageUrls(urls)
    expect(result.valid).toBe(true)
  })

  it('should reject invalid image URLs', () => {
    const result = validateImageUrls(['not-a-valid-url'])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid image URL')
  })

  it('should accept empty array', () => {
    const result = validateImageUrls([])
    expect(result.valid).toBe(true)
  })

  it('should use custom max count', () => {
    const urls = Array(8).fill('https://example.com/image.jpg')
    // Should be rejected with default (5)
    expect(validateImageUrls(urls).valid).toBe(false)
    // Should be accepted with custom max (10)
    expect(validateImageUrls(urls, 10).valid).toBe(true)
  })
})
