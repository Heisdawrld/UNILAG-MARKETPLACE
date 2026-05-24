'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'
import type { ClientToServerEvents, ServerToClientEvents } from '@/lib/delivery-types'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface UseSocketOptions {
  /** @deprecated No longer needed — uses Clerk auth automatically */
  userId?: string | null
  autoConnect?: boolean
}

let socketInstance: TypedSocket | null = null

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export function useSocket({ userId: _userId, autoConnect = true }: UseSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const socketRef = useRef<TypedSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 10
  const { isSignedIn, isLoaded } = useAuth()

  const cleanupSocket = useCallback(() => {
    if (socketInstance) {
      socketInstance.removeAllListeners()
      socketInstance.disconnect()
      socketInstance = null
      socketRef.current = null
    }
    setIsConnected(false)
  }, [])

  const connectSocket = useCallback((socketUrl: string, authData: Record<string, string>) => {
    cleanupSocket()

    socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: authData,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    }) as TypedSocket

    socketInstance.on('connect', () => {
      setIsConnected(true)
      setConnectionError(null)
      retryCountRef.current = 0
    })

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false)
      if (reason === 'io server disconnect') {
        // Server disconnected us — probably auth issue, try reconnecting with fresh token
        setConnectionError('Session expired — reconnecting...')
      }
    })

    socketInstance.on('connect_error', (err) => {
      console.warn('[socket] Connection error:', err.message)
      setIsConnected(false)

      // Parse the error to give a friendlier message
      const msg = err.message || ''
      if (msg.includes('Authentication failed') || msg.includes('expired token')) {
        setConnectionError('Session expired')
      } else if (msg.includes('Authentication required')) {
        setConnectionError('Sign in required')
      } else {
        setConnectionError('Connecting...')
      }
    })

    socketInstance.on('error', (data) => {
      console.error('[socket] Error:', data.message, data.code)
      // If token expired, reconnect with a fresh token
      if (data.code === 'AUTH_EXPIRED' || data.message?.includes('expired')) {
        cleanupSocket()
        // Will auto-reconnect on next render cycle
      }
    })

    socketRef.current = socketInstance
  }, [cleanupSocket])

  const connect = useCallback(async () => {
    // If Clerk isn't configured (demo mode), try legacy userId auth
    if (!isClerkConfigured) {
      if (socketInstance?.connected) return

      try {
        const socketUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
        connectSocket(socketUrl, { userId: 'demo-user' })
      } catch (err) {
        console.error('[socket] Demo connection failed:', err)
        setConnectionError('Connection failed')
      }
      return
    }

    // Clerk-authenticated flow
    if (!isSignedIn) {
      setConnectionError('Sign in to connect')
      return
    }
    if (socketInstance?.connected) return

    // Don't retry infinitely — exponential backoff
    if (retryCountRef.current >= MAX_RETRIES) {
      setConnectionError('Unable to connect — tap to retry')
      return
    }

    try {
      setConnectionError('Connecting...')
      // Fetch a signed Socket.io auth token from our API
      const tokenRes = await fetch('/api/auth/socket-token')
      if (!tokenRes.ok) {
        let errorMsg: string
        if (tokenRes.status === 401) {
          errorMsg = 'Sign in required'
        } else if (tokenRes.status === 429) {
          errorMsg = 'Rate limited — retrying soon'
        } else {
          // 500, 503, etc. — try the demo fallback
          console.warn('[socket] Token endpoint returned', tokenRes.status, '— trying fallback')
          const socketUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
          connectSocket(socketUrl, { userId: `clerk_fallback_${Date.now()}` })
          setConnectionError('Limited connection')
          return
        }
        console.error('[socket] Failed to get auth token:', tokenRes.status)
        setConnectionError(errorMsg)
        // Exponential backoff retry
        retryCountRef.current++
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 30000)
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => connect(), delay)
        return
      }
      const { token } = await tokenRes.json()

      const socketUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      connectSocket(socketUrl, { token })
    } catch (err) {
      console.error('[socket] Connection failed:', err)
      setConnectionError('Connection failed')
      retryCountRef.current++
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 30000)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => connect(), delay)
    }
  }, [isSignedIn, connectSocket])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
    cleanupSocket()
    retryCountRef.current = 0
  }, [cleanupSocket])

  // Manual retry — resets backoff
  const retry = useCallback(() => {
    retryCountRef.current = 0
    disconnect()
    connect()
  }, [disconnect, connect])

  useEffect(() => {
    if (autoConnect && isLoaded) connect()
  }, [autoConnect, isLoaded, isSignedIn, connect])

  useEffect(() => {
    if (isClerkConfigured && !isSignedIn) disconnect()
  }, [isSignedIn, disconnect])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [])

  return { socket: socketRef.current, isConnected, connectionError, connect, disconnect, retry }
}

export function getSocketInstance(): TypedSocket | null { return socketInstance }
