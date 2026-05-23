'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRunnerStore } from '@/store/runner-store'
import { useSocket } from './use-socket'
import { UNILAG_SERVICE_AREA } from '@/lib/runner-dispatch'

const UNILAG_CENTER = { lat: UNILAG_SERVICE_AREA.centerLat, lng: UNILAG_SERVICE_AREA.centerLng }

interface UseRunnerGpsOptions {
  enabled: boolean; updateInterval?: number; heartbeatInterval?: number; simulate?: boolean; highAccuracy?: boolean
}

export function useRunnerGps({ enabled, updateInterval = 3000, heartbeatInterval = 15000, simulate = false, highAccuracy = true }: UseRunnerGpsOptions) {
  const { socket, isConnected } = useSocket({ userId: null, autoConnect: false })
  const setLocation = useRunnerStore((s) => s.setLocation)
  const setGpsAccuracy = useRunnerStore((s) => s.setGpsAccuracy)
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const simulateLocation = useCallback(() => {
    const lat = UNILAG_CENTER.lat + (Math.random() - 0.5) * 0.004
    const lng = UNILAG_CENTER.lng + (Math.random() - 0.5) * 0.004
    const heading = Math.random() * 360
    const speed = 1 + Math.random() * 3
    setLocation(lat, lng, heading, speed)
    setGpsAccuracy(10 + Math.random() * 20)
    return { lat, lng, heading, speed }
  }, [setLocation, setGpsAccuracy])

  const streamLocation = useCallback((lat: number, lng: number, heading?: number | null, speed?: number | null) => {
    if (!socket?.connected) return
    socket.emit('runner:location', { lat, lng, heading: heading ?? null, speed: speed ?? null })
  }, [socket])

  useEffect(() => {
    if (!enabled || simulate) return
    if (!navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => { const { latitude, longitude, heading, speed, accuracy } = position.coords; setLocation(latitude, longitude, heading, speed); setGpsAccuracy(accuracy); streamLocation(latitude, longitude, heading, speed) },
      (error) => { console.error('[runner-gps] Error:', error.message) },
      { enableHighAccuracy: highAccuracy, maximumAge: 5000, timeout: 10000 }
    )
    return () => { if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null } }
  }, [enabled, simulate, highAccuracy, setLocation, setGpsAccuracy, streamLocation])

  useEffect(() => {
    if (!enabled) return
    if (simulate) {
      locationIntervalRef.current = setInterval(() => { const loc = simulateLocation(); streamLocation(loc.lat, loc.lng, loc.heading, loc.speed) }, updateInterval)
    } else {
      locationIntervalRef.current = setInterval(() => { const { currentLat, currentLng, currentHeading, currentSpeed } = useRunnerStore.getState(); if (currentLat && currentLng) streamLocation(currentLat, currentLng, currentHeading, currentSpeed) }, updateInterval)
    }
    return () => { if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null } }
  }, [enabled, simulate, updateInterval, simulateLocation, streamLocation])

  useEffect(() => {
    if (!enabled || !socket?.connected) return
    heartbeatIntervalRef.current = setInterval(() => { socket.emit('runner:heartbeat') }, heartbeatInterval)
    return () => { if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null } }
  }, [enabled, socket, heartbeatInterval])

  return { isStreaming: enabled, isSimulated: simulate }
}
