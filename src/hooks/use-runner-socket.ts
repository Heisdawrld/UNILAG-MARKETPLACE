'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useSocket } from './use-socket'
import { useRunnerStore, type IncomingDeliveryRequest, type ActiveDelivery } from '@/store/runner-store'

interface UseRunnerSocketOptions { userId?: string | null; isRunner: boolean }

export function useRunnerSocket({ userId: _userId, isRunner }: UseRunnerSocketOptions) {
  // Socket auth now uses Clerk-based tokens — userId is no longer needed
  const { socket, isConnected, connectionError, retry } = useSocket({ autoConnect: true })
  const setSocketConnected = useRunnerStore((s) => s.setSocketConnected)
  const addIncomingRequest = useRunnerStore((s) => s.addIncomingRequest)
  const removeIncomingRequest = useRunnerStore((s) => s.removeIncomingRequest)
  const setActiveDelivery = useRunnerStore((s) => s.setActiveDelivery)
  const updateActiveDeliveryStatus = useRunnerStore((s) => s.updateActiveDeliveryStatus)
  const addRejectedOrderId = useRunnerStore((s) => s.addRejectedOrderId)
  const setCurrentView = useRunnerStore((s) => s.setCurrentView)
  const mountedRef = useRef(true)

  useEffect(() => { setSocketConnected(isConnected) }, [isConnected, setSocketConnected])

  useEffect(() => {
    if (!socket || !isRunner) return
    const handleDeliveryRequest = (data: any) => { if (!mountedRef.current) return; addIncomingRequest({ ...data, receivedAt: Date.now() }); try { new Audio('/notification.mp3').play().catch(() => {}) } catch {} if (navigator.vibrate) navigator.vibrate([200, 100, 200]) }
    const handleOfferAccepted = (data: any) => { if (!mountedRef.current) return; removeIncomingRequest(data.orderId); setActiveDelivery({ orderId: data.orderId, status: 'runner_assigned', customerUsername: data.customerUsername, customerPhone: data.customerPhone, customerAvatar: data.customerAvatar, pickupLat: data.pickupLat, pickupLng: data.pickupLng, pickupAddress: data.pickupAddress, dropoffLat: 0, dropoffLng: 0, dropoffAddress: '', pickupCode: data.pickupCode, finalPrice: null, estimatedDistanceMeters: null, estimatedDurationMinutes: null, assignedAt: new Date().toISOString() }); setCurrentView('active'); if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]) }
    const handleOfferRejected = (data: any) => { if (!mountedRef.current) return; addRejectedOrderId(data.orderId); removeIncomingRequest(data.orderId) }
    const handleDeliveryStatus = (data: any) => { if (!mountedRef.current) return; updateActiveDeliveryStatus(data.status); if (data.status === 'completed' || data.status === 'cancelled') setTimeout(() => { if (mountedRef.current) { setActiveDelivery(null); setCurrentView('dashboard') } }, 3000) }
    const handleError = (data: any) => { console.error('[runner-socket] Error:', data.message, data.code) }

    socket.on('delivery:request', handleDeliveryRequest)
    socket.on('delivery:offer-accepted', handleOfferAccepted)
    socket.on('delivery:offer-rejected', handleOfferRejected)
    socket.on('delivery:status', handleDeliveryStatus)
    socket.on('error', handleError)
    return () => { socket.off('delivery:request', handleDeliveryRequest); socket.off('delivery:offer-accepted', handleOfferAccepted); socket.off('delivery:offer-rejected', handleOfferRejected); socket.off('delivery:status', handleDeliveryStatus); socket.off('error', handleError) }
  }, [socket, isRunner, addIncomingRequest, removeIncomingRequest, setActiveDelivery, updateActiveDeliveryStatus, addRejectedOrderId, setCurrentView])

  useEffect(() => { return () => { mountedRef.current = false } }, [])

  const goOnline = useCallback(() => { if (!socket?.connected) return; socket.emit('runner:status', { status: 'available' }); useRunnerStore.getState().setIsOnline(true) }, [socket])
  const goOffline = useCallback(() => { if (!socket?.connected) return; socket.emit('runner:status', { status: 'offline' }); useRunnerStore.getState().setIsOnline(false); useRunnerStore.getState().clearIncomingRequests() }, [socket])
  const acceptRequest = useCallback((orderId: string, customerPrice: number) => { if (!socket?.connected) return; socket.emit('delivery:offer', { orderId, runnerPrice: customerPrice }); removeIncomingRequest(orderId) }, [socket, removeIncomingRequest])
  const counterOffer = useCallback((orderId: string, runnerPrice: number, message?: string) => { if (!socket?.connected) return; socket.emit('delivery:offer', { orderId, runnerPrice, estimatedArrivalMinutes: 5, message: message || undefined }) }, [socket])
  const declineRequest = useCallback((orderId: string) => { addRejectedOrderId(orderId); removeIncomingRequest(orderId) }, [addRejectedOrderId, removeIncomingRequest])
  const confirmPickup = useCallback((orderId: string, pickupCode: string) => { if (!socket?.connected) return; socket.emit('delivery:pickup', { orderId, pickupCode }) }, [socket])
  const confirmDropoff = useCallback((orderId: string) => { if (!socket?.connected) return; socket.emit('delivery:dropoff', { orderId }) }, [socket])
  const cancelDelivery = useCallback((orderId: string, reason: string) => { if (!socket?.connected) return; socket.emit('delivery:cancel', { orderId, reason: reason as any }) }, [socket])
  const startNavigation = useCallback(() => { const { activeDelivery } = useRunnerStore.getState(); if (!activeDelivery || !socket?.connected) return; updateActiveDeliveryStatus('runner_en_route') }, [socket, updateActiveDeliveryStatus])
  const startTransit = useCallback(() => { const { activeDelivery } = useRunnerStore.getState(); if (!activeDelivery || !socket?.connected) return; updateActiveDeliveryStatus('in_transit') }, [socket, updateActiveDeliveryStatus])

  return { socket, isConnected, connectionError, retry, goOnline, goOffline, acceptRequest, counterOffer, declineRequest, confirmPickup, confirmDropoff, cancelDelivery, startNavigation, startTransit }
}
