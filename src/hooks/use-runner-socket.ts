'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useSocket } from './use-socket'
import { useRunnerStore, type IncomingDeliveryRequest, type ActiveDelivery } from '@/store/runner-store'

interface UseRunnerSocketOptions { isRunner: boolean }

export function useRunnerSocket({ isRunner }: UseRunnerSocketOptions) {
  const { socket, isConnected, connectionError, retry } = useSocket({ autoConnect: true })
  const setSocketConnected = useRunnerStore((s) => s.setSocketConnected)
  const addIncomingRequest = useRunnerStore((s) => s.addIncomingRequest)
  const removeIncomingRequest = useRunnerStore((s) => s.removeIncomingRequest)
  const setActiveDelivery = useRunnerStore((s) => s.setActiveDelivery)
  const updateActiveDeliveryStatus = useRunnerStore((s) => s.updateActiveDeliveryStatus)
  const addRejectedOrderId = useRunnerStore((s) => s.addRejectedOrderId)
  const setCurrentView = useRunnerStore((s) => s.setCurrentView)
  const isOnline = useRunnerStore((s) => s.isOnline)
  const mountedRef = useRef(true)

  // Sync socket connection state to store
  useEffect(() => { setSocketConnected(isConnected) }, [isConnected, setSocketConnected])

  // Re-emit runner:status on reconnect (PWA background/foreground)
  useEffect(() => {
    if (isConnected && socket && isRunner && isOnline) {
      socket.emit('runner:status', { status: 'available' })
    }
  }, [isConnected, socket, isRunner, isOnline])

  useEffect(() => {
    if (!socket || !isRunner) return

    const handleDeliveryRequest = (data: any) => {
      if (!mountedRef.current) return
      addIncomingRequest({ ...data, receivedAt: Date.now() })
      try { new Audio('/notification.mp3').play().catch(() => {}) } catch {}
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    }

    const handleOfferAccepted = (data: any) => {
      if (!mountedRef.current) return
      removeIncomingRequest(data.orderId)
      // Use dropoff data from the event if available, otherwise store null and fetch later
      setActiveDelivery({
        orderId: data.orderId,
        status: 'runner_assigned',
        customerUsername: data.customerUsername,
        customerPhone: data.customerPhone ?? null,
        customerAvatar: data.customerAvatar ?? null,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        pickupAddress: data.pickupAddress,
        dropoffLat: data.dropoffLat ?? null as any,
        dropoffLng: data.dropoffLng ?? null as any,
        dropoffAddress: data.dropoffAddress ?? '',
        pickupCode: data.pickupCode ?? '',
        finalPrice: data.finalPrice ?? null,
        estimatedDistanceMeters: data.estimatedDistanceMeters ?? null,
        estimatedDurationMinutes: data.estimatedDurationMinutes ?? null,
        assignedAt: new Date().toISOString(),
      })
      setCurrentView('active')
      if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300])
    }

    const handleOfferRejected = (data: any) => {
      if (!mountedRef.current) return
      addRejectedOrderId(data.orderId)
      removeIncomingRequest(data.orderId)
    }

    const handleDeliveryStatus = (data: any) => {
      if (!mountedRef.current) return
      updateActiveDeliveryStatus(data.status)
      // Also update dropoff data if included in status event
      if (data.dropoffLat && data.dropoffLng) {
        const current = useRunnerStore.getState().activeDelivery
        if (current && current.orderId === data.orderId) {
          setActiveDelivery({
            ...current,
            dropoffLat: data.dropoffLat,
            dropoffLng: data.dropoffLng,
            dropoffAddress: data.dropoffAddress ?? current.dropoffAddress,
            finalPrice: data.finalPrice ?? current.finalPrice,
          })
        }
      }
      if (data.status === 'completed' || data.status === 'cancelled') {
        setTimeout(() => {
          if (mountedRef.current) {
            setActiveDelivery(null)
            setCurrentView('dashboard')
          }
        }, 3000)
      }
    }

    const handleError = (data: any) => { console.error('[runner-socket] Error:', data.message, data.code) }

    socket.on('delivery:request', handleDeliveryRequest)
    socket.on('delivery:offer-accepted', handleOfferAccepted)
    socket.on('delivery:offer-rejected', handleOfferRejected)
    socket.on('delivery:status', handleDeliveryStatus)
    socket.on('error', handleError)
    return () => {
      socket.off('delivery:request', handleDeliveryRequest)
      socket.off('delivery:offer-accepted', handleOfferAccepted)
      socket.off('delivery:offer-rejected', handleOfferRejected)
      socket.off('delivery:status', handleDeliveryStatus)
      socket.off('error', handleError)
    }
  }, [socket, isRunner, addIncomingRequest, removeIncomingRequest, setActiveDelivery, updateActiveDeliveryStatus, addRejectedOrderId, setCurrentView])

  useEffect(() => { return () => { mountedRef.current = false } }, [])

  const goOnline = useCallback(() => {
    if (!socket?.connected) return
    socket.emit('runner:status', { status: 'available' })
    useRunnerStore.getState().setIsOnline(true)
  }, [socket])

  const goOffline = useCallback(() => {
    if (!socket?.connected) return
    socket.emit('runner:status', { status: 'offline' })
    useRunnerStore.getState().setIsOnline(false)
    useRunnerStore.getState().clearIncomingRequests()
  }, [socket])

  const acceptRequest = useCallback((orderId: string, customerPrice: number) => {
    if (!socket?.connected) return
    socket.emit('delivery:offer', { orderId, runnerPrice: customerPrice })
    removeIncomingRequest(orderId)
  }, [socket, removeIncomingRequest])

  const counterOffer = useCallback((orderId: string, runnerPrice: number, message?: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:offer', { orderId, runnerPrice, estimatedArrivalMinutes: 5, message: message || undefined })
  }, [socket])

  const declineRequest = useCallback((orderId: string) => {
    addRejectedOrderId(orderId)
    removeIncomingRequest(orderId)
  }, [addRejectedOrderId, removeIncomingRequest])

  const confirmPickup = useCallback((orderId: string, pickupCode: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:pickup', { orderId, pickupCode })
  }, [socket])

  const confirmDropoff = useCallback((orderId: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:dropoff', { orderId })
  }, [socket])

  const cancelDelivery = useCallback((orderId: string, reason: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:cancel', { orderId, reason: reason as any })
  }, [socket])

  const startNavigation = useCallback(() => {
    const { activeDelivery } = useRunnerStore.getState()
    if (!activeDelivery || !socket?.connected) return
    socket.emit('delivery:runner-en-route', { orderId: activeDelivery.orderId })
    updateActiveDeliveryStatus('runner_en_route')
  }, [socket, updateActiveDeliveryStatus])

  const startTransit = useCallback(() => {
    const { activeDelivery } = useRunnerStore.getState()
    if (!activeDelivery || !socket?.connected) return
    socket.emit('delivery:in-transit', { orderId: activeDelivery.orderId })
    updateActiveDeliveryStatus('in_transit')
  }, [socket, updateActiveDeliveryStatus])

  return {
    socket, isConnected, connectionError, retry,
    goOnline, goOffline, acceptRequest, counterOffer, declineRequest,
    confirmPickup, confirmDropoff, cancelDelivery, startNavigation, startTransit,
  }
}
