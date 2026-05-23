/**
 * sanitize.test.ts — Tests for input sanitization utilities
 *
 * Tests: sanitizeHtml, stripHtml, sanitizeText, sanitizeUsername,
 * sanitizePhone, sanitizeEmail, sanitizeUrl, sanitizeDescription,
 * sanitizeNumeric, sanitizePrice, sanitizeSlug, sanitizeEnum, sanitizeObject
 * No database or external services required.
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeHtml,
  stripHtml,
  sanitizeText,
  sanitizeUsername,
  sanitizePhone,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeDescription,
  sanitizeNumeric,
  sanitizePrice,
  sanitizeSlug,
  sanitizeEnum,
  sanitizeObject,
} from '@/lib/sanitize'

// ── sanitizeHtml ──

describe('sanitizeHtml', () => {
  it('should strip script tags', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>Hello')).toBe('Hello')
  })

  it('should strip iframe tags', () => {
    expect(sanitizeHtml('<iframe src="evil.com"></iframe>Content')).toBe('Content')
  })

  it('should strip object tags', () => {
    expect(sanitizeHtml('<object data="evil.swf"></object>Safe')).toBe('Safe')
  })

  it('should strip embed tags', () => {
    expect(sanitizeHtml('<embed src="evil.swf">Safe')).toBe('Safe')
  })

  it('should strip javascript: protocol', () => {
    expect(sanitizeHtml('javascript:alert("xss")')).toBe('alert("xss")')
  })

  it('should strip event handlers (onclick, onload, etc.)', () => {
    expect(sanitizeHtml('onclick=alert("xss")')).toBe('alert("xss")')
    expect(sanitizeHtml('onload=evil()')).toBe('evil()')
    expect(sanitizeHtml('onerror=bad()')).toBe('bad()')
  })

  it('should strip data:text/html protocol', () => {
    // data:text/html is stripped, but <script> tags are stripped separately by other patterns
    const result = sanitizeHtml('data:text/html,<script>alert(1)</script>')
    expect(result).not.toContain('data:text/html')
    expect(result).not.toContain('<script>')
    // The comma before the script tag remains, script content is stripped
    expect(result).toBe(',')
  })

  it('should strip data:text/html prefix leaving trailing content', () => {
    // The regex only strips "data:text/html" not the comma after it
    const result = sanitizeHtml('data:text/html,payload')
    expect(result).not.toContain('data:text/html')
    expect(result).toBe(',payload')
  })

  it('should strip vbscript: protocol', () => {
    expect(sanitizeHtml('vbscript:MsgBox("xss")')).toBe('MsgBox("xss")')
  })

  it('should strip CSS expression() keyword', () => {
    // The regex strips 'expression(' but leaves the closing paren and content
    const result = sanitizeHtml('expression(alert("xss"))')
    expect(result).not.toContain('expression')
    // Remaining: alert("xss"))
    expect(result).toBe('alert("xss"))')
  })

  it('should preserve normal text', () => {
    expect(sanitizeHtml('Hello, world!')).toBe('Hello, world!')
  })

  it('should handle multiple XSS patterns in one string', () => {
    const result = sanitizeHtml('<script>xss</script>Normal text<iframe>bad</iframe>more')
    expect(result).toBe('Normal textmore')
  })
})

// ── stripHtml ──

describe('stripHtml', () => {
  it('should strip all HTML tags', () => {
    expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World')
  })

  it('should strip self-closing tags', () => {
    expect(stripHtml('Line 1<br/>Line 2')).toBe('Line 1Line 2')
  })

  it('should strip tags with attributes', () => {
    expect(stripHtml('<a href="https://example.com">Link</a>')).toBe('Link')
  })

  it('should preserve text without tags', () => {
    expect(stripHtml('No HTML here')).toBe('No HTML here')
  })

  it('should handle empty string', () => {
    expect(stripHtml('')).toBe('')
  })

  it('should strip div, span, and other tags', () => {
    expect(stripHtml('<div class="test"><span>Hello</span></div>')).toBe('Hello')
  })
})

// ── sanitizeText ──

describe('sanitizeText', () => {
  it('should strip HTML and trim text', () => {
    expect(sanitizeText('  <b>Hello</b> World  ')).toBe('Hello World')
  })

  it('should normalize whitespace', () => {
    expect(sanitizeText('Hello    World   Test')).toBe('Hello World Test')
  })

  it('should truncate to maxLength', () => {
    expect(sanitizeText('Hello World', 5)).toBe('Hello')
  })

  it('should return empty string for non-string input', () => {
    expect(sanitizeText(null as any)).toBe('')
    expect(sanitizeText(undefined as any)).toBe('')
  })

  it('should return empty string for empty input', () => {
    expect(sanitizeText('')).toBe('')
  })

  it('should use default maxLength of 1000', () => {
    const longText = 'a'.repeat(2000)
    expect(sanitizeText(longText).length).toBe(1000)
  })
})

// ── sanitizeUsername ──

describe('sanitizeUsername', () => {
  it('should keep alphanumeric and underscores', () => {
    expect(sanitizeUsername('john_doe123')).toBe('john_doe123')
  })

  it('should remove special characters', () => {
    expect(sanitizeUsername('john@doe!')).toBe('johndoe')
  })

  it('should remove spaces', () => {
    expect(sanitizeUsername('john doe')).toBe('johndoe')
  })

  it('should truncate to maxLength (default 30)', () => {
    expect(sanitizeUsername('a'.repeat(50)).length).toBe(30)
  })

  it('should return empty string for non-string input', () => {
    expect(sanitizeUsername(null as any)).toBe('')
    expect(sanitizeUsername(undefined as any)).toBe('')
  })

  it('should keep uppercase letters', () => {
    expect(sanitizeUsername('JohnDoe')).toBe('JohnDoe')
  })
})

// ── sanitizePhone ──

describe('sanitizePhone', () => {
  it('should keep digits, +, -, spaces, and parentheses', () => {
    expect(sanitizePhone('+234 (801) 234-5678')).toBe('+234 (801) 234-5678')
  })

  it('should remove letters and special characters', () => {
    expect(sanitizePhone('call+234-801-234-5678now')).toBe('+234-801-234-5678')
  })

  it('should truncate to 20 characters', () => {
    const longPhone = '+234 801 234 5678 9999 0000'
    expect(sanitizePhone(longPhone).length).toBeLessThanOrEqual(20)
  })

  it('should return empty string for non-string input', () => {
    expect(sanitizePhone(null as any)).toBe('')
  })
})

// ── sanitizeEmail ──

describe('sanitizeEmail', () => {
  it('should lowercase and trim email', () => {
    expect(sanitizeEmail('  John@Example.COM  ')).toBe('john@example.com')
  })

  it('should remove invalid characters', () => {
    expect(sanitizeEmail('john.doe+label@example.com')).toBe('john.doe+label@example.com')
  })

  it('should remove spaces from email', () => {
    expect(sanitizeEmail('john doe@example.com')).toBe('johndoe@example.com')
  })

  it('should truncate to 254 characters', () => {
    const longEmail = 'a'.repeat(300) + '@test.com'
    expect(sanitizeEmail(longEmail).length).toBeLessThanOrEqual(254)
  })

  it('should return empty string for non-string input', () => {
    expect(sanitizeEmail(null as any)).toBe('')
  })
})

// ── sanitizeUrl ──

describe('sanitizeUrl', () => {
  it('should accept https URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com')
  })

  it('should accept http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com')
  })

  it('should reject non-http protocols', () => {
    expect(sanitizeUrl('ftp://example.com')).toBe('')
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
  })

  it('should reject relative URLs', () => {
    expect(sanitizeUrl('/path/to/page')).toBe('')
  })

  it('should trim whitespace', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com')
  })

  it('should truncate to 2048 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(3000)
    expect(sanitizeUrl(longUrl).length).toBeLessThanOrEqual(2048)
  })

  it('should return empty string for non-string input', () => {
    expect(sanitizeUrl(null as any)).toBe('')
  })

  it('should be case-insensitive for protocol check', () => {
    expect(sanitizeUrl('HTTPS://example.com')).toBe('HTTPS://example.com')
  })
})

// ── sanitizeDescription ──

describe('sanitizeDescription', () => {
  it('should sanitize XSS but keep safe HTML tags', () => {
    // sanitizeDescription uses sanitizeHtml which strips XSS patterns but NOT safe HTML like <b>
    // To fully strip HTML tags, use stripHtml or sanitizeText instead
    expect(sanitizeDescription('<b>Bold</b> text')).toBe('<b>Bold</b> text')
    expect(sanitizeDescription('<script>xss</script>Clean text')).toBe('Clean text')
  })

  it('should strip script tags', () => {
    expect(sanitizeDescription('<script>alert(1)</script>Description')).toBe('Description')
  })

  it('should truncate to maxLength', () => {
    expect(sanitizeDescription('Long description', 5)).toBe('Long ')
  })

  it('should use default maxLength of 5000', () => {
    const longDesc = 'a'.repeat(10000)
    expect(sanitizeDescription(longDesc).length).toBe(5000)
  })

  it('should return empty string for non-string input', () => {
    expect(sanitizeDescription(null as any)).toBe('')
  })
})

// ── sanitizeNumeric ──

describe('sanitizeNumeric', () => {
  it('should return number as-is', () => {
    expect(sanitizeNumeric(42)).toBe(42)
    expect(sanitizeNumeric(3.14)).toBe(3.14)
    expect(sanitizeNumeric(-100)).toBe(-100)
  })

  it('should parse numeric strings', () => {
    expect(sanitizeNumeric('42')).toBe(42)
    expect(sanitizeNumeric('3.14')).toBe(3.14)
  })

  it('should return 0 for non-numeric strings', () => {
    expect(sanitizeNumeric('abc')).toBe(0)
    expect(sanitizeNumeric('')).toBe(0)
  })

  it('should return 0 for NaN', () => {
    expect(sanitizeNumeric(NaN)).toBe(0)
  })

  it('should return 0 for Infinity', () => {
    expect(sanitizeNumeric(Infinity)).toBe(0)
    expect(sanitizeNumeric(-Infinity)).toBe(0)
  })
})

// ── sanitizePrice ──

describe('sanitizePrice', () => {
  it('should return price rounded to 2 decimal places', () => {
    expect(sanitizePrice(99.999)).toBe(100)
    expect(sanitizePrice(10.125)).toBe(10.13)
  })

  it('should enforce minimum', () => {
    expect(sanitizePrice(-50, 0, 10000)).toBe(0)
    expect(sanitizePrice(50, 100, 10000)).toBe(100)
  })

  it('should enforce maximum', () => {
    expect(sanitizePrice(15000, 0, 10000)).toBe(10000)
  })

  it('should handle string input', () => {
    expect(sanitizePrice('500')).toBe(500)
    expect(sanitizePrice('99.99')).toBe(99.99)
  })

  it('should use default min (0) and max (10,000,000)', () => {
    expect(sanitizePrice(-1)).toBe(0)
    expect(sanitizePrice(20000000)).toBe(10000000)
  })

  it('should handle invalid string input', () => {
    expect(sanitizePrice('not-a-number')).toBe(0)
  })
})

// ── sanitizeSlug ──

describe('sanitizeSlug', () => {
  it('should lowercase and replace special chars with hyphens', () => {
    expect(sanitizeSlug('Hello World')).toBe('hello-world')
  })

  it('should collapse multiple hyphens', () => {
    expect(sanitizeSlug('Hello   World')).toBe('hello-world')
  })

  it('should keep alphanumeric, hyphens, and underscores', () => {
    expect(sanitizeSlug('my-category_123')).toBe('my-category_123')
  })

  it('should truncate to 50 characters', () => {
    expect(sanitizeSlug('a'.repeat(100)).length).toBe(50)
  })

  it('should return empty string for non-string input', () => {
    expect(sanitizeSlug(null as any)).toBe('')
  })
})

// ── sanitizeEnum ──

describe('sanitizeEnum', () => {
  const allowedCategories = ['food', 'documents', 'packages'] as const

  it('should return the value if it is in the allowed list', () => {
    expect(sanitizeEnum('food', allowedCategories, 'food')).toBe('food')
    expect(sanitizeEnum('documents', allowedCategories, 'food')).toBe('documents')
  })

  it('should return fallback if value is not in allowed list', () => {
    expect(sanitizeEnum('furniture', allowedCategories, 'food')).toBe('food')
    expect(sanitizeEnum('', allowedCategories, 'food')).toBe('food')
  })

  it('should be case-sensitive', () => {
    expect(sanitizeEnum('Food', allowedCategories, 'food')).toBe('food')
    expect(sanitizeEnum('FOOD', allowedCategories, 'food')).toBe('food')
  })
})

// ── sanitizeObject ──

describe('sanitizeObject', () => {
  it('should sanitize all string values in an object', () => {
    const result = sanitizeObject({
      name: '<script>alert("xss")</script>John',
      email: 'test@example.com',
      age: 25,
    })
    expect(result.name).toBe('John')
    expect(result.email).toBe('test@example.com')
    expect(result.age).toBe(25)
  })

  it('should sanitize nested objects', () => {
    const result = sanitizeObject({
      user: {
        bio: '<iframe>evil</iframe>Clean bio',
      },
    })
    expect(result.user.bio).toBe('Clean bio')
  })

  it('should sanitize arrays of strings', () => {
    const result = sanitizeObject({
      tags: ['<script>xss</script>clean', 'normal'],
    })
    expect(result.tags).toEqual(['clean', 'normal'])
  })

  it('should preserve numbers and booleans', () => {
    const result = sanitizeObject({
      count: 42,
      active: true,
      name: 'test',
    })
    expect(result.count).toBe(42)
    expect(result.active).toBe(true)
    expect(result.name).toBe('test')
  })

  it('should respect maxDepth', () => {
    const deep = { level1: { level2: { level3: '<script>xss</script>' } } }
    const result = sanitizeObject(deep, 2)
    // At depth 2, level3 object is not sanitized
    expect(result.level1.level2.level3).toBe('<script>xss</script>')
  })

  it('should handle null and undefined values', () => {
    const result = sanitizeObject({
      name: 'test',
      value: null,
      other: undefined,
    })
    expect(result.name).toBe('test')
    expect(result.value).toBeNull()
    expect(result.other).toBeUndefined()
  })
})
