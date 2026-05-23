/**
 * image-service.ts — Unified image handling with graceful degradation
 *
 * If Uploadthing is configured → images go to cloud, URLs stored in DB
 * If Uploadthing is NOT configured → falls back to base64 (legacy mode)
 *
 * All image fields in the DB can contain EITHER:
 * - A cloud URL (https://utfs.io/...) from Uploadthing
 * - A base64 data URL (data:image/...) from legacy mode
 * - A JSON stringified array of the above
 *
 * This service normalizes access to both formats.
 */

// ── Check if Uploadthing is available ──
export function isUploadthingAvailable(): boolean {
  return !!process.env.UPLOADTHING_TOKEN && process.env.UPLOADTHING_TOKEN !== ''
}

// ── Image URL detection ──

export function isCloudUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('https://') || url.startsWith('http://')
}

export function isDataUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('data:')
}

export function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return isCloudUrl(url) || isDataUrl(url)
}

// ── Parse image arrays from JSON strings ──

export function parseImageArray(imagesJson: string): string[] {
  if (!imagesJson) return []
  try {
    const parsed = JSON.parse(imagesJson)
    if (Array.isArray(parsed)) {
      return parsed.filter((url: unknown) => typeof url === 'string' && url.length > 0)
    }
  } catch {
    // Not valid JSON — might be a single URL
    if (typeof imagesJson === 'string' && imagesJson.length > 0) {
      return [imagesJson]
    }
  }
  return []
}

export function stringifyImageArray(urls: string[]): string {
  return JSON.stringify(urls.filter(url => url && url.length > 0))
}

// ── Image size validation ──

const MAX_BASE64_SIZE = 2.5 * 1024 * 1024 // 2.5MB base64 string
const MAX_IMAGE_COUNT = 5

export function validateBase64Image(dataUrl: string, maxSize: number = MAX_BASE64_SIZE): { valid: boolean; error?: string } {
  if (!dataUrl.startsWith('data:image/')) {
    return { valid: false, error: 'Only image files are allowed' }
  }
  if (dataUrl.length > maxSize) {
    const sizeMB = (dataUrl.length / 1024 / 1024).toFixed(1)
    return { valid: false, error: `Image too large (${sizeMB}MB). Max 2.5MB.` }
  }
  return { valid: true }
}

export function validateImageUrls(urls: string[], maxCount: number = MAX_IMAGE_COUNT): { valid: boolean; error?: string } {
  if (urls.length > maxCount) {
    return { valid: false, error: `Maximum ${maxCount} images allowed` }
  }
  for (const url of urls) {
    if (!isValidImageUrl(url)) {
      return { valid: false, error: 'Invalid image URL format' }
    }
  }
  return { valid: true }
}

// ── Shared client-side compression ──

export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.82,
  format: 'webp',
}

/**
 * Compress an image file client-side using Canvas
 * Returns a base64 data URL
 */
export function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const { maxWidth, maxHeight, quality, format } = { ...DEFAULT_OPTIONS, ...options }
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // Scale down if needed
        if (width > maxWidth!) {
          height = (height * maxWidth!) / width
          width = maxWidth!
        }
        if (height > maxHeight!) {
          width = (width * maxHeight!) / height
          height = maxHeight!
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        const mimeType = `image/${format}`
        const dataUrl = canvas.toDataURL(mimeType, quality)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Upload images using Uploadthing or fall back to base64
 * Returns an array of URLs (cloud URLs or base64 data URLs)
 */
export async function uploadImages(
  files: File[],
  endpoint: string,
  options: CompressOptions = {}
): Promise<string[]> {
  // If Uploadthing is available, use it (client-side only)
  if (isUploadthingAvailable() && typeof window !== 'undefined') {
    try {
      const { generateReactHelpers } = await import('@uploadthing/react')
      const { uploadFiles } = generateReactHelpers()
      const uploads = await uploadFiles(endpoint as any, { files })
      return uploads.map((u: any) => u.url)
    } catch (err) {
      console.warn('[image-service] Uploadthing upload failed, falling back to base64:', err)
    }
  }

  // Fallback: compress and return base64 data URLs
  const compressed = await Promise.all(
    files.map(file => compressImageFile(file, options))
  )
  return compressed
}

/**
 * Upload a single image using Uploadthing or fall back to base64
 */
export async function uploadSingleImage(
  file: File,
  endpoint: string,
  options: CompressOptions = {}
): Promise<string> {
  const urls = await uploadImages([file], endpoint, options)
  return urls[0] || ''
}
