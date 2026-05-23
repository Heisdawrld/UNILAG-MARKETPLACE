/**
 * uploadthing.ts — File router for image uploads
 *
 * Handles all image uploads for the UNILAG Marketplace:
 * - Listing images (up to 5 per listing)
 * - Store logos and banners
 * - User avatars
 * - Runner profile photos and student ID images
 * - Delivery item images
 * - Chat message images
 *
 * Graceful degradation: If UPLOADTHING_TOKEN is not set,
 * the app falls back to base64 image storage (legacy mode).
 */

import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { requireAuth } from '@/lib/auth-guard'
import { logger } from '@/lib/utils'

const f = createUploadthing()

export const ourFileRouter = {
  // ── Listing images: up to 5, 4MB each ──
  listingImage: f({
    image: { maxFileSize: '4MB', maxFileCount: 5 },
  })
    .middleware(async () => {
      const { userId, errorResponse } = await requireAuth()
      if (errorResponse) throw new Error('Unauthorized')
      return { userId: userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      logger.log('[uploadthing] Listing image uploaded:', file.name, 'by', metadata.userId)
      return { url: file.url, fileKey: file.key }
    }),

  // ── Store logo/banner: 1 image, 2MB ──
  storeImage: f({
    image: { maxFileSize: '2MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId, errorResponse } = await requireAuth()
      if (errorResponse) throw new Error('Unauthorized')
      return { userId: userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      logger.log('[uploadthing] Store image uploaded:', file.name, 'by', metadata.userId)
      return { url: file.url, fileKey: file.key }
    }),

  // ── User avatar: 1 image, 2MB ──
  avatar: f({
    image: { maxFileSize: '2MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId, errorResponse } = await requireAuth()
      if (errorResponse) throw new Error('Unauthorized')
      return { userId: userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      logger.log('[uploadthing] Avatar uploaded:', file.name, 'by', metadata.userId)
      return { url: file.url, fileKey: file.key }
    }),

  // ── Runner documents: up to 2 (profile photo + student ID), 4MB each ──
  runnerDocument: f({
    image: { maxFileSize: '4MB', maxFileCount: 2 },
  })
    .middleware(async () => {
      const { userId, errorResponse } = await requireAuth()
      if (errorResponse) throw new Error('Unauthorized')
      return { userId: userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      logger.log('[uploadthing] Runner doc uploaded:', file.name, 'by', metadata.userId)
      return { url: file.url, fileKey: file.key }
    }),

  // ── Delivery item images: up to 3, 2MB each ──
  deliveryImage: f({
    image: { maxFileSize: '2MB', maxFileCount: 3 },
  })
    .middleware(async () => {
      const { userId, errorResponse } = await requireAuth()
      if (errorResponse) throw new Error('Unauthorized')
      return { userId: userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      logger.log('[uploadthing] Delivery image uploaded:', file.name, 'by', metadata.userId)
      return { url: file.url, fileKey: file.key }
    }),

  // ── Chat message image: 1 image, 4MB ──
  messageImage: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId, errorResponse } = await requireAuth()
      if (errorResponse) throw new Error('Unauthorized')
      return { userId: userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      logger.log('[uploadthing] Message image uploaded:', file.name, 'by', metadata.userId)
      return { url: file.url, fileKey: file.key }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
