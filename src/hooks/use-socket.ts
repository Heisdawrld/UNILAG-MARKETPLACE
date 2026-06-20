'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'
import type { ClientToServerEvents, ServerToClientEvents } from '@/lib/delivery-types'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

// ── Connection state machine ──
type ConnectionState = 'idle' | 'fetching_token' | 'connecting' | 'connected' | 'error'

// Module-level shared socket — but with reference counting to avoid race conditions
let socketInstance: TypedSocket | null = null
let refCount = 0

export function useSocket({ autoConnect = true }: { autoConnect?: boolean } = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [socketState, setSocketState] = useState<TypedSocket | null>(null)
  const socketRef = useRef<TypedSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const connectionStateRef = useRef<ConnectionState>('idle')
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const MAX_RETRIES = 5
  const CONNECTION_TIMEOUT_MS = 20000 // 20s watchdog

  const { isSignedIn, isLoaded } = useAuth()

  // Use refs for callbacks to avoid stale closures in setTimeout
  const connectRef = useRef<() => void>(() => {})
  const cleanupSocket = useCallback(() => {
    if (watchdogTimerRef.current) { clearTimeout(watchdogTimerRef.current); watchdogTimerRef.current = null }
    if (socketInstance) {
      socketInstance.removeAllListeners()
      socketInstance.disconnect()
      socketInstance = null
    }
    socketRef.current = null
    setSocketState(null)
    setIsConnected(false)
    connectionStateRef.current = 'idle'
  }, [])

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
    if (watchdogTimerRef.current) { clearTimeout(watchdogTimerRef.current); watchdogTimerRef.current = null }
  }, [])

  const connectSocket = useCallback((socketUrl: string, token: string) => {
    // Clean up any existing socket
    if (socketInstance) {
      socketInstance.removeAllListeners()
      socketInstance.disconnect()
      socketInstance = null
    }

    connectionStateRef.current = 'connecting'

    socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
    }) as TypedSocket

    socketInstance.on('connect', () => {
      setIsConnected(true)
      setConnectionError(null)
      setSocketState(socketInstance)
      retryCountRef.current = 0
      connectionStateRef.current = 'connected'
      if (watchdogTimerRef.current) { clearTimeout(watchdogTimerRef.current); watchdogTimerRef.current = null }
    })

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false)
      setSocketState(null)
      connectionStateRef.current = 'error'
      if (reason === 'io server disconnect') {
        setConnectionError('Session expired — reconnecting...')
        setTimeout(() => connectRef.current(), 2000)
      }
    })

    socketInstance.on('connect_error', (err) => {
      console.warn('[socket] Connection error:', err.message)
      setIsConnected(false)
      setSocketState(null)
      connectionStateRef.current = 'error'
      if (watchdogTimerRef.current) { clearTimeout(watchdogTimerRef.current); watchdogTimerRef.current = null }

      const msg = err.message || ''
      if (msg.includes('Authentication failed') || msg.includes('expired token')) {
        setConnectionError('Session expired — reconnecting...')
        setTimeout(() => connectRef.current(), 3000)
      } else if (msg.includes('Authentication required')) {
        setConnectionError('Sign in required')
      } else {
        setConnectionError('Unable to connect — tap Retry')
      }
    })

    socketInstance.on('error', (data: any) => {
      console.error('[socket] Error:', data?.message, data?.code)
      if (data?.code === 'AUTH_EXPIRED' || data?.message?.includes('expired')) {
        cleanupSocket()
        setTimeout(() => connectRef.current(), 2000)
      }
    })

    socketRef.current = socketInstance

    // ── Connection watchdog: if we're still "connecting" after timeout, force reset ──
    watchdogTimerRef.current = setTimeout(() => {
      if (connectionStateRef.current === 'connecting' || connectionStateRef.current === 'fetching_token') {
        console.warn('[socket] Connection watchdog triggered — forcing reset')
        connectionStateRef.current = 'error'
        setConnectionError('Connection timed out — tap Retry')
        setIsConnected(false)
        setSocketState(null)
        // Don't destroy the socket — let socket.io's own reconnection logic work
        // Just update the UI state
      }
    }, CONNECTION_TIMEOUT_MS)
  }, [cleanupSocket])

  const connect = useCallback(async () => {
    // Prevent double-connect using state machine
    if (connectionStateRef.current === 'connecting' || connectionStateRef.current === 'fetching_token') return
    if (socketInstance?.connected) return

    if (!isSignedIn) {
      setConnectionError('Sign in to use delivery')
      return
    }

    if (retryCountRef.current >= MAX_RETRIES) {
      setConnectionError('Unable to connect — tap Retry')
      return
    }

    connectionStateRef.current = 'fetching_token'
    setConnectionError('Connecting...')
    retryCountRef.current++

    try {
      const socketUrl = typeof window !== 'undefined' ? window.location.origin : ''

      const tokenRes = await fetch('/api/auth/socket-token')

      if (!tokenRes.ok) {
        const errorMsg = tokenRes.status === 401
          ? 'Sign in required'
          : tokenRes.status === 429
            ? 'Too many requests — wait a moment'
            : tokenRes.status === 503
              ? 'Service temporarily unavailable'
              : 'Connection failed'

        setConnectionError(errorMsg)
        connectionStateRef.current = 'error'

        const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30000)
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay)
        return
      }

      const { token } = await tokenRes.json()
      if (!token) {
        setConnectionError('Authentication failed')
        connectionStateRef.current = 'error'
        return
      }

      // Reset retry count on successful token fetch
      retryCountRef.current = 0
      connectSocket(socketUrl, token)
    } catch (err) {
      console.error('[socket] Connection failed:', err)
      setConnectionError('Network error — tap Retry')
      connectionStateRef.current = 'error'

      const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30000)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay)
    }
  }, [isSignedIn, connectSocket])

  // Keep ref updated
  connectRef.current = connect

  const disconnect = useCallback(() => {
    clearTimers()
    cleanupSocket()
    retryCountRef.current = 0
  }, [cleanupSocket, clearTimers])

  const retry = useCallback(() => {
    retryCountRef.current = 0
    connectionStateRef.current = 'idle'
    disconnect()
    // Use setTimeout to ensure disconnect completes before reconnecting
    setTimeout(() => connectRef.current(), 100)
  }, [disconnect])

  // Auto-connect when signed in
  useEffect(() => {
    if (autoConnect && isLoaded && isSignedIn) {
      connectRef.current()
    }
    return () => {
      clearTimers()
    }
  }, [autoConnect, isLoaded, isSignedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Disconnect when signed out
  useEffect(() => {
    if (!isSignedIn && isLoaded) disconnect()
  }, [isSignedIn, isLoaded, disconnect])

  // Reference counting for cleanup
  useEffect(() => {
    refCount++
    return () => {
      refCount--
      // Only destroy the shared socket when ALL consumers unmount
      if (refCount <= 0 && socketInstance) {
        socketInstance.removeAllListeners()
        socketInstance.disconnect()
        socketInstance = null
      }
    }
  }, [])

  return { socket: socketState, isConnected, connectionError, connect, disconnect, retry }
}

export function getSocketInstance(): TypedSocket | null { return socketInstance }
