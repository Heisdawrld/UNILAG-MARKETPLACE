'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, MapPin, Package, Clock, ArrowLeft, Send, History } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCustomerDeliveryStore, type CustomerDeliveryView, type CustomerActiveDelivery } from '@/store/customer-delivery-store'
import { useCustomerSocket } from '@/hooks/use-customer-socket'
import CustomerDeliveryForm from '@/components/delivery/CustomerDeliveryForm'
import CustomerSearchingOverlay from '@/components/delivery/CustomerSearchingOverlay'
import CustomerOfferViewer from '@/components/delivery/CustomerOfferViewer'
import CustomerTrackingView from '@/components/delivery/CustomerTrackingView'
import CustomerDeliveryMap from '@/components/delivery/CustomerDeliveryMap'
import CustomerDeliveryHistory from '@/components/delivery/CustomerDeliveryHistory'

const VIEW_CONFIG: Record<CustomerDeliveryView, { label: string; icon: any }> = {
  form: { label: 'New Delivery', icon: Send },
  searching: { label: 'Searching', icon: Clock },
  offers: { label: 'Offers', icon: Truck },
  tracking: { label: 'Tracking', icon: MapPin },
  completed: { label: 'Completed', icon: Package },
  history: { label: 'History', icon: History },
}

export default function DeliveryPage() {
  const currentView = useCustomerDeliveryStore((s) => s.currentView)
  const setCurrentView = useCustomerDeliveryStore((s) => s.setCurrentView)
  const activeDelivery = useCustomerDeliveryStore((s) => s.activeDelivery)
  const setActiveDelivery = useCustomerDeliveryStore((s) => s.setActiveDelivery)
  const isSearching = useCustomerDeliveryStore((s) => s.isSearching)
  const setIsSearching = useCustomerDeliveryStore((s) => s.setIsSearching)
  const offers = useCustomerDeliveryStore((s) => s.offers)
  const isSocketConnected = useCustomerDeliveryStore((s) => s.isSocketConnected)
  const form = useCustomerDeliveryStore((s) => s.form)
  const resetForm = useCustomerDeliveryStore((s) => s.resetForm)

  const {
    isConnected, connectionError, retry, createDelivery, acceptOffer, rejectOffer,
    confirmDelivery, cancelDelivery, watchDelivery, unwatchDelivery,
  } = useCustomerSocket({ userId: null }) // Uses Clerk auth token automatically

  const [mapExpanded, setMapExpanded] = useState(false)

  // Seed mock history on first load
  useEffect(() => {
    const store = useCustomerDeliveryStore.getState()
    if (store.deliveryHistory.length === 0) {
      store.setDeliveryHistory([
        {
          id: 'chist-1', title: 'Food from Jaja Cafeteria', category: 'food',
          finalPrice: 1200, status: 'completed',
          completedAt: new Date(Date.now() - 86400000).toISOString(),
          runnerRating: 5, runnerReview: 'Fast delivery!',
          estimatedDistanceMeters: 800, runnerUsername: 'Tunde',
        },
        {
          id: 'chist-2', title: 'Assignment Printout', category: 'documents',
          finalPrice: 600, status: 'completed',
          completedAt: new Date(Date.now() - 172800000).toISOString(),
          runnerRating: 4, runnerReview: null,
          estimatedDistanceMeters: 500, runnerUsername: 'Chioma',
        },
        {
          id: 'chist-3', title: 'Groceries from Shoprite', category: 'groceries',
          finalPrice: 1800, status: 'cancelled',
          completedAt: null, runnerRating: null, runnerReview: null,
          estimatedDistanceMeters: 1500, runnerUsername: null,
        },
      ])
    }
  }, [])

  // Handle delivery creation
  const handleCreateDelivery = useCallback((data: any) => {
    createDelivery(data)
  }, [createDelivery])

  // Handle offer acceptance
  const handleAcceptOffer = useCallback((orderId: string, offerId: string) => {
    acceptOffer(orderId, offerId)
    const offer = offers.find(o => o.offerId === offerId)
    if (offer) {
      setActiveDelivery({
        orderId,
        status: 'runner_assigned',
        pickupLat: form.pickupLat ?? 0,
        pickupLng: form.pickupLng ?? 0,
        pickupAddress: form.pickupAddress,
        dropoffLat: form.dropoffLat ?? 0,
        dropoffLng: form.dropoffLng ?? 0,
        dropoffAddress: form.dropoffAddress,
        pickupCode: '',
        customerPrice: form.customerPrice,
        finalPrice: offer.runnerPrice,
        runnerId: offer.runnerId,
        runnerUsername: offer.runnerUsername,
        runnerAvatar: offer.runnerAvatar,
        runnerPhone: null,
        runnerTransportMode: offer.runnerTransportMode,
        estimatedDistanceMeters: null,
        estimatedDurationMinutes: offer.estimatedArrivalMinutes,
        createdAt: new Date().toISOString(),
        assignedAt: new Date().toISOString(),
      })
      watchDelivery(orderId)
    }
  }, [acceptOffer, offers, setActiveDelivery, watchDelivery, form])

  // Handle offer rejection
  const handleRejectOffer = useCallback((orderId: string, offerId: string) => {
    rejectOffer(orderId, offerId)
  }, [rejectOffer])

  // Handle delivery confirmation
  const handleConfirmDelivery = useCallback((orderId: string, rating: number, review?: string) => {
    confirmDelivery(orderId, rating, review)
    setActiveDelivery(null)
    resetForm()
    setCurrentView('form')
    unwatchDelivery(orderId)
  }, [confirmDelivery, setActiveDelivery, resetForm, setCurrentView, unwatchDelivery])

  // Handle cancellation
  const handleCancelDelivery = useCallback((orderId: string, reason: string) => {
    cancelDelivery(orderId, reason)
    setIsSearching(false)
    setActiveDelivery(null)
    resetForm()
    setCurrentView('form')
    unwatchDelivery(orderId)
  }, [cancelDelivery, setIsSearching, setActiveDelivery, resetForm, setCurrentView, unwatchDelivery])

  // Cancel search
  const handleCancelSearch = useCallback(() => {
    if (activeDelivery?.orderId) {
      cancelDelivery(activeDelivery.orderId, 'customer_cancelled')
    }
    setIsSearching(false)
    setActiveDelivery(null)
    setCurrentView('form')
  }, [cancelDelivery, setIsSearching, setActiveDelivery, setCurrentView, activeDelivery])

  // Auto-switch views
  useEffect(() => {
    if (isSearching && offers.length > 0 && currentView === 'searching') {
      setCurrentView('offers')
    }
  }, [isSearching, offers.length, currentView, setCurrentView])

  const showBackButton = currentView !== 'form'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 mr-1"
                onClick={() => {
                  if (activeDelivery) setCurrentView('tracking')
                  else setCurrentView('form')
                }}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm">Delivery</h1>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500' : connectionError ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] text-muted-foreground">
                  {isSocketConnected ? 'Live' : connectionError ? 'Reconnecting...' : 'Connecting...'}
                </span>
                {!isSocketConnected && (
                  <button
                    onClick={retry}
                    className="text-[10px] text-blue-500 hover:text-blue-600 font-medium ml-1"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeDelivery && (
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 rounded-full text-[10px]">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1 animate-pulse" />
                Active
              </Badge>
            )}
            {isSearching && (
              <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 rounded-full text-[10px]">
                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-1 animate-pulse" />
                Searching
              </Badge>
            )}
            {offers.length > 0 && (
              <Badge className="bg-emerald-500 text-white rounded-full text-[10px]">
                {offers.length} offer{offers.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className={`relative transition-all duration-300 ${mapExpanded ? 'h-[50vh]' : 'h-[220px]'}`}>
        <CustomerDeliveryMap className="w-full h-full" onExpand={() => setMapExpanded(!mapExpanded)} />
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-24 space-y-4">
        {/* Quick nav tabs */}
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {(['form', 'tracking', 'history'] as CustomerDeliveryView[]).map((view) => {
            const config = VIEW_CONFIG[view]
            const isActive = currentView === view || (currentView === 'searching' && view === 'form') || (currentView === 'offers' && view === 'form') || (currentView === 'completed' && view === 'tracking')
            const showBadge = view === 'tracking' && activeDelivery
            const showOfferBadge = view === 'form' && offers.length > 0
            return (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-all relative flex items-center justify-center gap-1.5 ${
                  isActive ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                }`}
              >
                <config.icon className="w-3.5 h-3.5" />
                {config.label}
                {showBadge && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                {showOfferBadge && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full" />}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          {currentView === 'form' && (
            <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CustomerDeliveryForm onSubmit={handleCreateDelivery} isSubmitting={isSearching} />
            </motion.div>
          )}

          {currentView === 'searching' && (
            <motion.div key="searching" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CustomerSearchingOverlay onCancel={handleCancelSearch} />
            </motion.div>
          )}

          {currentView === 'offers' && (
            <motion.div key="offers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CustomerOfferViewer
                onAccept={handleAcceptOffer}
                onReject={handleRejectOffer}
                onCancel={handleCancelSearch}
              />
            </motion.div>
          )}

          {(currentView === 'tracking' || currentView === 'completed') && (
            <motion.div key="tracking" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {activeDelivery ? (
                <CustomerTrackingView
                  onConfirmDelivery={handleConfirmDelivery}
                  onCancelDelivery={handleCancelDelivery}
                />
              ) : (
                <div className="text-center py-16">
                  <Package className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No Active Delivery</p>
                  <p className="text-xs text-muted-foreground mt-1">Create a delivery request to start tracking</p>
                  <Button variant="outline" className="mt-4" onClick={() => setCurrentView('form')}>
                    New Delivery
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CustomerDeliveryHistory />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t z-40 safe-bottom">
        <div className="max-w-2xl mx-auto flex">
          {(['form', 'tracking', 'history'] as CustomerDeliveryView[]).map((view) => {
            const config = VIEW_CONFIG[view]
            const isActive = currentView === view || (currentView === 'searching' && view === 'form') || (currentView === 'offers' && view === 'form') || (currentView === 'completed' && view === 'tracking')
            return (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-muted-foreground'
                }`}
              >
                <config.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{config.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
