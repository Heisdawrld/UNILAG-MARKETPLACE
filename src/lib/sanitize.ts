/**
 * sanitize.ts — Input sanitization utilities
 * 
 * Prevents XSS, injection, and malformed data across the platform.
 * All user-facing text inputs should be sanitized before storage.
 */

// ── HTML/XSS sanitization ──

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,  // onclick=, onload=, etc.
  /data:\s*text\/html/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
]

/**
 * Strip XSS vectors from a string
 */
export function sanitizeHtml(input: string): string {
  let cleaned = input
  for (const pattern of XSS_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }
  return cleaned
}

/**
 * Strip all HTML tags from a string
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

// ── String sanitization ──

/**
 * Sanitize a plain text field (strip HTML, trim, normalize whitespace)
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return ''
  return stripHtml(input)
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)
}

/**
 * Sanitize a username (alphanumeric + underscores only)
 */
export function sanitizeUsername(input: string, maxLength: number = 30): string {
  if (!input || typeof input !== 'string') return ''
  return input.replace(/[^a-zA-Z0-9_]/g, '').slice(0, maxLength)
}

/**
 * Sanitize a phone number (digits, +, -, spaces only)
 */
export function sanitizePhone(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input.replace(/[^0-9+\-\s()]/g, '').trim().slice(0, 20)
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input.trim().toLowerCase().replace(/[^a-zA-Z0-9@._+\-]/g, '').slice(0, 254)
}

/**
 * Sanitize a URL (only allow http/https protocols)
 */
export function sanitizeUrl(input: string): string {
  if (!input || typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (!/^https?:\/\//i.test(trimmed)) return ''
  return trimmed.slice(0, 2048)
}

/**
 * Sanitize a description/rich text field (allow basic formatting, strip XSS)
 */
export function sanitizeDescription(input: string, maxLength: number = 5000): string {
  if (!input || typeof input !== 'string') return ''
  return sanitizeHtml(input)
    .trim()
    .slice(0, maxLength)
}

/**
 * Sanitize a numeric string
 */
export function sanitizeNumeric(input: string | number): number {
  const num = typeof input === 'string' ? parseFloat(input) : input
  if (!Number.isFinite(num)) return 0
  return num
}

/**
 * Sanitize a price (positive number with 2 decimal places max)
 */
export function sanitizePrice(input: string | number, min: number = 0, max: number = 10000000): number {
  const num = sanitizeNumeric(input)
  if (num < min) return min
  if (num > max) return max
  return Math.round(num * 100) / 100
}

/**
 * Sanitize a category/slug (lowercase, hyphens, no special chars)
 */
export function sanitizeSlug(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input.toLowerCase().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-').slice(0, 50)
}

/**
 * Sanitize a category from a known list
 */
export function sanitizeEnum<T extends string>(input: string, allowed: readonly T[], fallback: T): T {
  if (allowed.includes(input as T)) return input as T
  return fallback
}

// ── Object sanitization ──

/**
 * Recursively sanitize all string values in an object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T, maxDepth: number = 5): T {
  if (maxDepth <= 0) return obj
  
  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeHtml(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeHtml(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item, maxDepth - 1) :
        item
      )
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, maxDepth - 1)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized as T
}
