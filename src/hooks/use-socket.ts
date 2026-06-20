'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'
import type { ClientToServerEvents, ServerToClientEvents } from '@/lib/delivery-types'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socketInstance: TypedSocket | null = null

export function useSocket({ autoConnect = true }: { autoConnect?: boolean } = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const socketRef = useRef<TypedSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const isConnectingRef = useRef(false)
  const MAX_RETRIES = 5

  const { isSignedIn, isLoaded } = useAuth()

  const cleanupSocket = useCallback(() => {
    if (socketInstance) {
      socketInstance.removeAllListeners()
      socketInstance.disconnect()
      socketInstance = null
    }
    socketRef.current = null
    setIsConnected(false)
    isConnectingRef.current = false
  }, [])

  const connectSocket = useCallback((socketUrl: string, token: string) => {
    cleanupSocket()

    socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },  // ONLY signed token — no userId fallback
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
    }) as TypedSocket

    socketInstance.on('connect', () => {
      setIsConnected(true)
      setConnectionError(null)
      retryCountRef.current = 0
      isConnectingRef.current = false
    })

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false)
      if (reason === 'io server disconnect') {
        setConnectionError('Session expired — reconnecting...')
        // Force reconnect with fresh token
        setTimeout(() => connect(), 2000)
      }
    })

    socketInstance.on('connect_error', (err) => {
      console.warn('[socket] Connection error:', err.message)
      setIsConnected(false)
      isConnectingRef.current = false

      const msg = err.message || ''
      if (msg.includes('Authentication failed') || msg.includes('expired token')) {
        setConnectionError('Session expired — reconnecting...')
        // Get a fresh token and retry
        setTimeout(() => connect(), 3000)
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
        setTimeout(() => connect(), 2000)
      }
    })

    socketRef.current = socketInstance
  }, [cleanupSocket])

  const connect = useCallback(async () => {
    if (isConnectingRef.current) return // Prevent double-connect
    if (socketInstance?.connected) return

    if (!isSignedIn) {
      setConnectionError('Sign in to use delivery')
      return
    }

    if (retryCountRef.current >= MAX_RETRIES) {
      setConnectionError('Unable to connect — tap Retry')
      return
    }

    isConnectingRef.current = true
    setConnectionError('Connecting...')
    retryCountRef.current++

    try {
      const socketUrl = typeof window !== 'undefined' ? window.location.origin : ''

      // Fetch signed token from our API — NO fallback headers
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
        isConnectingRef.current = false

        // Exponential backoff
        const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30000)
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => connect(), delay)
        return
      }

      const { token } = await tokenRes.json()
      if (!token) {
        setConnectionError('Authentication failed')
        isConnectingRef.current = false
        return
      }

      connectSocket(socketUrl, token)
    } catch (err) {
      console.error('[socket] Connection failed:', err)
      setConnectionError('Network error — tap Retry')
      isConnectingRef.current = false

      const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30000)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => connect(), delay)
    }
  }, [isSignedIn, connectSocket])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
    cleanupSocket()
    retryCountRef.current = 0
  }, [cleanupSocket])

  const retry = useCallback(() => {
    retryCountRef.current = 0
    disconnect()
    connect()
  }, [disconnect, connect])

  useEffect(() => {
    if (autoConnect && isLoaded && isSignedIn) connect()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [autoConnect, isLoaded, isSignedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSignedIn && isLoaded) disconnect()
  }, [isSignedIn, isLoaded, disconnect])

  // Use state for socket to avoid stale ref during render
  const [socketState, setSocketState] = useState<TypedSocket | null>(null)
  useEffect(() => {
    setSocketState(socketRef.current)
    const interval = setInterval(() => {
      if (socketRef.current !== socketState) {
        setSocketState(socketRef.current)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { socket: socketState, isConnected, connectionError, connect, disconnect, retry }
}

export function getSocketInstance(): TypedSocket | null { return socketInstance }
