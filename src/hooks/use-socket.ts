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
  const { isSignedIn, isLoaded } = useAuth()

  const connect = useCallback(async () => {
    // If Clerk isn't configured (demo mode), try legacy userId auth
    if (!isClerkConfigured) {
      if (socketInstance?.connected) return

      try {
        const socketUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
        socketInstance = io(socketUrl, {
          transports: ['websocket', 'polling'],
          auth: { userId: 'demo-user' },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          timeout: 10000,
        }) as TypedSocket

        socketInstance.on('connect', () => { setIsConnected(true); setConnectionError(null) })
        socketInstance.on('disconnect', () => { setIsConnected(false) })
        socketInstance.on('connect_error', (err) => {
          console.warn('[socket] Connection error:', err.message)
          setConnectionError('Unable to reach server')
        })
        socketRef.current = socketInstance
      } catch (err) {
        console.error('[socket] Demo connection failed:', err)
        setConnectionError('Connection failed')
      }
      return
    }

    // Clerk-authenticated flow
    if (!isSignedIn) return
    if (socketInstance?.connected) return

    try {
      setConnectionError(null)
      // Fetch a signed Socket.io auth token from our API
      const tokenRes = await fetch('/api/auth/socket-token')
      if (!tokenRes.ok) {
        const errMsg = tokenRes.status === 401 ? 'Not authenticated' : `Auth failed (${tokenRes.status})`
        console.error('[socket] Failed to get auth token:', tokenRes.status)
        setConnectionError(errMsg)
        // Retry after delay
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => connect(), 5000)
        return
      }
      const { token } = await tokenRes.json()

      const socketUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      socketInstance = io(socketUrl, {
        transports: ['websocket', 'polling'],
        auth: { token }, // Send signed token instead of raw userId
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      }) as TypedSocket

      socketInstance.on('connect', () => { setIsConnected(true); setConnectionError(null) })
      socketInstance.on('disconnect', () => { setIsConnected(false) })
      socketInstance.on('connect_error', (err) => {
        console.warn('[socket] Connection error:', err.message)
        setConnectionError('Unable to reach server')
      })
      socketInstance.on('error', (data) => {
        console.error('[socket] Error:', data.message, data.code)
        // If token expired, reconnect with a fresh token
        if (data.code === 'AUTH_EXPIRED' || data.message?.includes('expired')) {
          socketInstance?.disconnect()
          socketInstance = null
          socketRef.current = null
          // Will auto-reconnect on next render cycle
        }
      })
      socketRef.current = socketInstance
    } catch (err) {
      console.error('[socket] Connection failed:', err)
      setConnectionError('Connection failed')
    }
  }, [isSignedIn])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
    if (socketInstance) { socketInstance.disconnect(); socketInstance = null; socketRef.current = null; setIsConnected(false) }
  }, [])

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

  return { socket: socketRef.current, isConnected, connectionError, connect, disconnect }
}

export function getSocketInstance(): TypedSocket | null { return socketInstance }
