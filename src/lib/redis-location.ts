/**
 * redis-location.ts — Runner Location Helpers
 */

import { redis, isRedisAvailable } from './redis'
import { UNILAG_SERVICE_AREA } from './runner-dispatch'

export interface RunnerLocation {
  lat: number; lng: number; heading: number | null; speed: number | null; updatedAt: number
}

export interface NearbyRunner extends RunnerLocation {
  runnerId: string; distance: number; rating: number; tasksCompleted: number; transportMode: string
}

export interface RunnerSearchResult {
  found: boolean; runners: NearbyRunner[]; searchRadius: number; totalOnline: number
}

const LOCATION_TTL_SECONDS = 30
const STATUS_TTL_SECONDS = 60
const DEFAULT_SEARCH_RADIUS_METERS = 1000
const MAX_SEARCH_RADIUS_METERS = 3000
const SEARCH_RADIUS_STEP_METERS = 500

export async function setRunnerLocation(runnerId: string, lat: number, lng: number, heading?: number | null, speed?: number | null): Promise<void> {
  if (!isRedisAvailable()) return
  const now = Date.now()
  const locationKey = `runner:${runnerId}:location`
  const geoKey = 'runners:geo'
  const locationData: RunnerLocation = { lat, lng, heading: heading ?? null, speed: speed ?? null, updatedAt: now }
  const pipeline = redis.pipeline()
  pipeline.set(locationKey, JSON.stringify(locationData), { ex: LOCATION_TTL_SECONDS })
  if (lat >= UNILAG_SERVICE_AREA.minLat && lat <= UNILAG_SERVICE_AREA.maxLat && lng >= UNILAG_SERVICE_AREA.minLng && lng <= UNILAG_SERVICE_AREA.maxLng) {
    ;(pipeline as any).geoadd(geoKey, lng, lat, runnerId)
  }
  await pipeline.exec()
}

export async function removeRunnerLocation(runnerId: string): Promise<void> {
  if (!isRedisAvailable()) return
  const pipeline = redis.pipeline()
  pipeline.del(`runner:${runnerId}:location`)
  pipeline.zrem('runners:geo', runnerId)
  pipeline.del(`runner:${runnerId}:status`)
  pipeline.srem('runners:online', runnerId)
  await pipeline.exec()
}

export async function getRunnerLocation(runnerId: string): Promise<RunnerLocation | null> {
  if (!isRedisAvailable()) return null
  const data = await redis.get<string>(`runner:${runnerId}:location`)
  if (!data) return null
  try { return JSON.parse(data) as RunnerLocation } catch { return null }
}

export async function getRunnerLocations(runnerIds: string[]): Promise<Map<string, RunnerLocation>> {
  const result = new Map<string, RunnerLocation>()
  if (!isRedisAvailable() || runnerIds.length === 0) return result
  const pipeline = redis.pipeline()
  for (const id of runnerIds) pipeline.get(`runner:${id}:location`)
  const responses = await pipeline.exec() as (string | null)[]
  for (let i = 0; i < runnerIds.length; i++) {
    const data = responses[i]
    if (data) { try { result.set(runnerIds[i], JSON.parse(data) as RunnerLocation) } catch {} }
  }
  return result
}

export async function findNearbyRunners(lat: number, lng: number, maxResults: number = 10): Promise<RunnerSearchResult> {
  if (!isRedisAvailable()) return { found: false, runners: [], searchRadius: 0, totalOnline: 0 }
  let searchRadius = DEFAULT_SEARCH_RADIUS_METERS
  let runners: NearbyRunner[] = []
  const totalOnline = await redis.scard('runners:online')
  while (searchRadius <= MAX_SEARCH_RADIUS_METERS) {
    const geoResults = await (redis as any).georadius('runners:geo', lng, lat, searchRadius, 'm', 'WITHDIST', 'ASC') as Array<[string, string]>
    if (geoResults.length > 0) {
      const candidateIds = geoResults.map(([id]) => id)
      const statusPipeline = redis.pipeline()
      for (const id of candidateIds) statusPipeline.get(`runner:${id}:status`)
      const statuses = await statusPipeline.exec() as (string | null)[]
      const locations = await getRunnerLocations(candidateIds)
      for (let i = 0; i < candidateIds.length; i++) {
        const id = candidateIds[i]
        const status = statuses[i]
        const loc = locations.get(id)
        if (status === 'available' && loc) {
          runners.push({ runnerId: id, distance: parseFloat(geoResults[i][1]), lat: loc.lat, lng: loc.lng, heading: loc.heading, speed: loc.speed, updatedAt: loc.updatedAt, rating: 0, tasksCompleted: 0, transportMode: 'walking' })
        }
        if (runners.length >= maxResults) break
      }
      if (runners.length >= maxResults) break
    }
    searchRadius += SEARCH_RADIUS_STEP_METERS
  }
  runners.sort((a, b) => a.distance - b.distance || b.rating - a.rating || b.tasksCompleted - a.tasksCompleted)
  return { found: runners.length > 0, runners: runners.slice(0, maxResults), searchRadius, totalOnline }
}

export async function setRunnerStatus(runnerId: string, status: 'available' | 'busy' | 'offline'): Promise<void> {
  if (!isRedisAvailable()) return
  const pipeline = redis.pipeline()
  if (status === 'offline') {
    pipeline.del(`runner:${runnerId}:status`)
    pipeline.srem('runners:online', runnerId)
    pipeline.zrem('runners:geo', runnerId)
    pipeline.del(`runner:${runnerId}:location`)
  } else {
    pipeline.set(`runner:${runnerId}:status`, status, { ex: STATUS_TTL_SECONDS })
    pipeline.sadd('runners:online', runnerId)
    if (status === 'busy') pipeline.zrem('runners:geo', runnerId)
  }
  await pipeline.exec()
}

export async function getRunnerStatus(runnerId: string): Promise<'available' | 'busy' | 'offline'> {
  if (!isRedisAvailable()) return 'offline'
  const status = await redis.get<string>(`runner:${runnerId}:status`)
  if (status === 'available' || status === 'busy') return status
  return 'offline'
}

export async function addDeliveryWatcher(orderId: string, socketId: string): Promise<void> {
  if (!isRedisAvailable()) return
  await redis.sadd(`delivery:${orderId}:watchers`, socketId)
  await redis.expire(`delivery:${orderId}:watchers`, 7200)
}

export async function removeDeliveryWatcher(orderId: string, socketId: string): Promise<void> {
  if (!isRedisAvailable()) return
  await redis.srem(`delivery:${orderId}:watchers`, socketId)
}

export async function getDeliveryWatchers(orderId: string): Promise<string[]> {
  if (!isRedisAvailable()) return []
  return (await redis.smembers(`delivery:${orderId}:watchers`)) as string[]
}

export async function runnerHeartbeat(runnerId: string): Promise<void> {
  if (!isRedisAvailable()) return
  const pipeline = redis.pipeline()
  const currentStatus = await redis.get<string>(`runner:${runnerId}:status`)
  if (currentStatus) pipeline.set(`runner:${runnerId}:status`, currentStatus, { ex: STATUS_TTL_SECONDS })
  const currentLocation = await redis.get<string>(`runner:${runnerId}:location`)
  if (currentLocation) pipeline.set(`runner:${runnerId}:location`, currentLocation, { ex: LOCATION_TTL_SECONDS })
  if (currentStatus === 'available' || currentStatus === 'busy') pipeline.sadd('runners:online', runnerId)
  await pipeline.exec()
}

export async function getRunnerStats(): Promise<{ totalOnline: number; available: number; busy: number }> {
  if (!isRedisAvailable()) return { totalOnline: 0, available: 0, busy: 0 }
  const totalOnline = await redis.scard('runners:online')
  const onlineIds = (await redis.smembers('runners:online')) as string[]
  let available = 0, busy = 0
  if (onlineIds.length > 0) {
    const pipeline = redis.pipeline()
    for (const id of onlineIds) pipeline.get(`runner:${id}:status`)
    const statuses = await pipeline.exec() as (string | null)[]
    for (const status of statuses) { if (status === 'available') available++; else if (status === 'busy') busy++ }
  }
  return { totalOnline, available, busy }
}
