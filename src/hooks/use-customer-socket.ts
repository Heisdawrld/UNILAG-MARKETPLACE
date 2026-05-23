'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useSocket } from './use-socket'
import { useCustomerDeliveryStore, type DeliveryOfferFromRunner, type CustomerActiveDelivery } from '@/store/customer-delivery-store'
import type { DeliveryCategory, DeliveryOrderStatus, TransportMode, UrgencyLevel } from '@/lib/delivery-types'

interface UseCustomerSocketOptions { userId?: string | null }

export function useCustomerSocket({ userId: _userId }: UseCustomerSocketOptions) {
  // Socket auth now uses Clerk-based tokens — userId is no longer needed
  const { socket, isConnected } = useSocket({ autoConnect: true })
  const setSocketConnected = useCustomerDeliveryStore((s) => s.setSocketConnected)
  const addOffer = useCustomerDeliveryStore((s) => s.addOffer)
  const removeOffer = useCustomerDeliveryStore((s) => s.removeOffer)
  const clearOffers = useCustomerDeliveryStore((s) => s.clearOffers)
  const setActiveDelivery = useCustomerDeliveryStore((s) => s.setActiveDelivery)
  const updateActiveDeliveryStatus = useCustomerDeliveryStore((s) => s.updateActiveDeliveryStatus)
  const updateRunnerLocation = useCustomerDeliveryStore((s) => s.updateRunnerLocation)
  const setCurrentView = useCustomerDeliveryStore((s) => s.setCurrentView)
  const setIsSearching = useCustomerDeliveryStore((s) => s.setIsSearching)
  const setShowRatingModal = useCustomerDeliveryStore((s) => s.setShowRatingModal)
  const mountedRef = useRef(true)

  useEffect(() => { setSocketConnected(isConnected) }, [isConnected, setSocketConnected])

  useEffect(() => {
    if (!socket) return

    const handleOfferReceived = (data: any) => {
      if (!mountedRef.current) return
      const offer: DeliveryOfferFromRunner = {
        offerId: data.offerId, orderId: data.orderId, runnerId: data.runnerId,
        runnerUsername: data.runnerUsername, runnerAvatar: data.runnerAvatar,
        runnerRating: data.runnerRating, runnerTasksCompleted: data.runnerTasksCompleted,
        runnerTransportMode: data.runnerTransportMode as TransportMode,
        runnerPrice: data.runnerPrice, estimatedArrivalMinutes: data.estimatedArrivalMinutes,
        message: data.message, expiresAt: data.expiresAt, receivedAt: Date.now(),
      }
      addOffer(offer)
      // Auto-switch to offers view if we're still searching
      const currentView = useCustomerDeliveryStore.getState().currentView
      if (currentView === 'searching') setCurrentView('offers')
      // Vibrate feedback
      try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]) } catch {}
    }

    const handleDeliveryStatus = (data: any) => {
      if (!mountedRef.current) return
      const status = data.status as DeliveryOrderStatus
      updateActiveDeliveryStatus(status)

      if (status === 'runner_assigned') {
        // Will be handled by the status update + we need to load full delivery details
        setIsSearching(false)
        clearOffers()
        setCurrentView('tracking')
      } else if (status === 'picked_up') {
        setCurrentView('tracking')
      } else if (status === 'delivered') {
        setCurrentView('completed')
        setShowRatingModal(true)
      } else if (status === 'cancelled') {
        setIsSearching(false)
        clearOffers()
        setActiveDelivery(null)
        setCurrentView('form')
      }
    }

    const handleRunnerLocationUpdate = (data: any) => {
      if (!mountedRef.current) return
      updateRunnerLocation(data.lat, data.lng, data.heading, data.speed)
    }

    const handleDeliveryEta = (data: any) => {
      // Future: update ETA in store
    }

    const handleDeliveryUnavailable = (data: any) => {
      if (!mountedRef.current) return
      setIsSearching(false)
      setCurrentView('form')
    }

    const handleError = (data: any) => {
      console.error('[customer-socket] Error:', data.message, data.code)
    }

    socket.on('delivery:offer-received', handleOfferReceived)
    socket.on('delivery:status', handleDeliveryStatus)
    socket.on('runner:location-update', handleRunnerLocationUpdate)
    socket.on('delivery:eta', handleDeliveryEta)
    socket.on('delivery:unavailable', handleDeliveryUnavailable)
    socket.on('error', handleError)

    return () => {
      socket.off('delivery:offer-received', handleOfferReceived)
      socket.off('delivery:status', handleDeliveryStatus)
      socket.off('runner:location-update', handleRunnerLocationUpdate)
      socket.off('delivery:eta', handleDeliveryEta)
      socket.off('delivery:unavailable', handleDeliveryUnavailable)
      socket.off('error', handleError)
    }
  }, [socket, addOffer, removeOffer, clearOffers, setActiveDelivery, updateActiveDeliveryStatus, updateRunnerLocation, setCurrentView, setIsSearching, setShowRatingModal])

  useEffect(() => { return () => { mountedRef.current = false } }, [])

  // ── Actions ──

  const createDelivery = useCallback((data: {
    pickupLat: number; pickupLng: number; pickupAddress: string
    dropoffLat: number; dropoffLng: number; dropoffAddress: string
    customerPrice: number; category: DeliveryCategory; urgency: UrgencyLevel
    title: string; description: string; itemImages?: string[]
  }) => {
    if (!socket?.connected) return
    setIsSearching(true)
    useCustomerDeliveryStore.getState().setSearchStartTime(Date.now())
    socket.emit('delivery:create', data)
  }, [socket, setIsSearching])

  const acceptOffer = useCallback((orderId: string, offerId: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:accept-offer', { orderId, offerId })
  }, [socket])

  const rejectOffer = useCallback((orderId: string, offerId: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:reject-offer', { orderId, offerId })
    removeOffer(offerId)
  }, [socket, removeOffer])

  const confirmDelivery = useCallback((orderId: string, rating: number, review?: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:confirm', { orderId, rating, review })
    setShowRatingModal(false)
  }, [socket, setShowRatingModal])

  const cancelDelivery = useCallback((orderId: string, reason: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:cancel', { orderId, reason: reason as any })
  }, [socket])

  const watchDelivery = useCallback((orderId: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:watch', { orderId })
  }, [socket])

  const unwatchDelivery = useCallback((orderId: string) => {
    if (!socket?.connected) return
    socket.emit('delivery:unwatch', { orderId })
  }, [socket])

  return {
    socket, isConnected,
    createDelivery, acceptOffer, rejectOffer,
    confirmDelivery, cancelDelivery,
    watchDelivery, unwatchDelivery,
  }
}
