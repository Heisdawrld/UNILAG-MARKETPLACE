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

export function useSocket({ userId: _userId, autoConnect = true }: UseSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<TypedSocket | null>(null)
  const { isSignedIn, isLoaded } = useAuth()

  const connect = useCallback(async () => {
    if (!isSignedIn) return
    if (socketInstance?.connected) return

    try {
      // Fetch a signed Socket.io auth token from our API
      const tokenRes = await fetch('/api/auth/socket-token')
      if (!tokenRes.ok) {
        console.error('[socket] Failed to get auth token:', tokenRes.status)
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

      socketInstance.on('connect', () => { setIsConnected(true) })
      socketInstance.on('disconnect', () => { setIsConnected(false) })
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
    }
  }, [isSignedIn])

  const disconnect = useCallback(() => {
    if (socketInstance) { socketInstance.disconnect(); socketInstance = null; socketRef.current = null; setIsConnected(false) }
  }, [])

  useEffect(() => {
    if (autoConnect && isLoaded && isSignedIn) connect()
  }, [autoConnect, isLoaded, isSignedIn, connect])

  useEffect(() => {
    if (!isSignedIn) disconnect()
  }, [isSignedIn, disconnect])

  return { socket: socketRef.current, isConnected, connect, disconnect }
}

export function getSocketInstance(): TypedSocket | null { return socketInstance }
