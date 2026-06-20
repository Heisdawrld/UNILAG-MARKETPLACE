'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, Package, MapPin, Clock, Star, ChevronRight, Zap, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCustomerDeliveryStore, UNILAG_LANDMARKS } from '@/store/customer-delivery-store'
import { useCustomerSocket } from '@/hooks/use-customer-socket'
import { useToast } from '@/hooks/use-toast'
import { DELIVERY_CATEGORY_BASELINES, URGENCY_MULTIPLIERS } from '@/lib/delivery-types'
import type { DeliveryCategory, UrgencyLevel } from '@/lib/delivery-types'
import type { ViewTab } from '@/lib/types'

const CATEGORIES: { id: DeliveryCategory; label: string; emoji: string }[] = [
  { id: 'food', label: 'Food', emoji: '🍜' },
  { id: 'documents', label: 'Docs', emoji: '📄' },
  { id: 'packages', label: 'Pkg', emoji: '📦' },
  { id: 'groceries', label: 'Grocery', emoji: '🛒' },
  { id: 'laundry', label: 'Laundry', emoji: '👕' },
  { id: 'medication', label: 'Meds', emoji: '💊' },
  { id: 'electronics', label: 'Tech', emoji: '📱' },
  { id: 'other', label: 'Other', emoji: '📋' },
]

const URGENCY_OPTIONS: { id: UrgencyLevel; label: string; desc: string }[] = [
  { id: 'standard', label: 'Standard', desc: '30-45min' },
  { id: 'express', label: 'Express', desc: '15-20min' },
  { id: 'urgent', label: 'Urgent', desc: 'ASAP' },
]

interface DeliveryTabViewProps {
  user: { id: string; username: string; email: string; isRunner: boolean }
}

export default function DeliveryTabView({ user }: DeliveryTabViewProps) {
  const { toast } = useToast()
  const form = useCustomerDeliveryStore((s) => s.form)
  const updateForm = useCustomerDeliveryStore((s) => s.updateForm)
  const activeDelivery = useCustomerDeliveryStore((s) => s.activeDelivery)
  const searchOrderId = useCustomerDeliveryStore((s) => s.searchOrderId)
  const offers = useCustomerDeliveryStore((s) => s.offers)
  const isSearching = useCustomerDeliveryStore((s) => s.isSearching)
  const isSocketConnected = useCustomerDeliveryStore((s) => s.isSocketConnected)
  const resetForm = useCustomerDeliveryStore((s) => s.resetForm)
  const currentView = useCustomerDeliveryStore((s) => s.currentView)

  const { isConnected, connectionError, retry, createDelivery, acceptOffer, rejectOffer, confirmDelivery, cancelDelivery } = useCustomerSocket()

  const [step, setStep] = useState<'quick' | 'form' | 'searching' | 'offers' | 'tracking'>(
    activeDelivery ? 'tracking' : 'quick'
  )

  // Sync step with activeDelivery and currentView from store
  useEffect(() => {
    if (activeDelivery) {
      setStep('tracking')
    } else if (currentView === 'offers' && offers.length > 0) {
      setStep('offers')
    } else if (currentView === 'searching' || isSearching) {
      setStep('searching')
    } else if (step === 'tracking' && !activeDelivery) {
      setStep('quick')
    }
  }, [activeDelivery, currentView, isSearching, offers.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedPrice = Math.round(
    ((DELIVERY_CATEGORY_BASELINES[form.category].min + DELIVERY_CATEGORY_BASELINES[form.category].max) / 2) * URGENCY_MULTIPLIERS[form.urgency]
  )

  // Sync suggestedPrice with form.customerPrice when category/urgency changes
  useEffect(() => {
    const newPrice = Math.round(
      ((DELIVERY_CATEGORY_BASELINES[form.category].min + DELIVERY_CATEGORY_BASELINES[form.category].max) / 2) * URGENCY_MULTIPLIERS[form.urgency]
    )
    // Only auto-update if the user hasn't manually changed the price from the default
    if (form.customerPrice === 1000 || form.customerPrice === 0) {
      updateForm({ customerPrice: newPrice })
    }
  }, [form.category, form.urgency]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFormValid = form.pickupLat && form.pickupLng && form.dropoffLat && form.dropoffLng
    && form.pickupAddress && form.dropoffAddress && form.title && form.customerPrice > 0

  const handleQuickRequest = useCallback((category: DeliveryCategory) => {
    updateForm({ category })
    setStep('form')
  }, [updateForm])

  const handleSubmit = useCallback(() => {
    if (!isFormValid) return
    if (!isSocketConnected) {
      toast({ title: 'Delivery service offline', description: 'Please wait for connection and try again.', variant: 'destructive' })
      return
    }
    createDelivery({
      pickupLat: form.pickupLat!, pickupLng: form.pickupLng!, pickupAddress: form.pickupAddress,
      dropoffLat: form.dropoffLat!, dropoffLng: form.dropoffLng!, dropoffAddress: form.dropoffAddress,
      customerPrice: form.customerPrice, category: form.category, urgency: form.urgency,
      title: form.title, description: form.description, itemImages: form.itemImages,
    })
    setStep('searching')
  }, [isFormValid, isSocketConnected, createDelivery, form])

  const handleAcceptOffer = useCallback((offerId: string) => {
    // Use searchOrderId (which is set when delivery:create response comes back)
    // Falls back to activeDelivery?.orderId for edge cases
    const orderId = searchOrderId ?? activeDelivery?.orderId ?? ''
    if (!orderId) {
      toast({ title: 'Error', description: 'Could not find order — please try again', variant: 'destructive' })
      return
    }
    acceptOffer(orderId, offerId)
    setStep('tracking')
  }, [acceptOffer, searchOrderId, activeDelivery, toast])

  // If there's an active delivery, show tracking
  if (activeDelivery) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center">
                <Truck className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-sm">Active Delivery</h2>
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] text-muted-foreground">{isSocketConnected ? 'Live' : 'Offline'}</span>
                </div>
              </div>
            </div>
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 rounded-full text-[10px]">
              {activeDelivery.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {/* Status steps */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium truncate">{activeDelivery.pickupAddress}</span>
              </div>
              <div className="ml-2 w-0.5 h-3 bg-border" />
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                <span className="font-medium truncate">{activeDelivery.dropoffAddress}</span>
              </div>
            </CardContent>
          </Card>

          {/* Pickup code */}
          {['runner_assigned', 'runner_en_route'].includes(activeDelivery.status) && (
            <Card className="border-2 border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Your Pickup Code</p>
                <p className="text-2xl font-mono font-bold tracking-[0.3em] text-amber-600">{activeDelivery.pickupCode}</p>
              </CardContent>
            </Card>
          )}

          {/* Runner info */}
          {activeDelivery.runnerUsername && (
            <Card>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <span className="text-white font-bold">{activeDelivery.runnerUsername.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{activeDelivery.runnerUsername}</p>
                  <p className="text-xs text-muted-foreground">Your runner</p>
                </div>
                {activeDelivery.finalPrice && (
                  <Badge variant="secondary">₦{activeDelivery.finalPrice.toLocaleString()}</Badge>
                )}
              </CardContent>
            </Card>
          )}

          {/* Delivered state */}
          {activeDelivery.status === 'delivered' && (
            <div className="text-center py-6 space-y-3">
              <Package className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="font-bold">Delivered!</p>
              <Link href="/delivery">
                <Button className="bg-emerald-500 hover:bg-emerald-600">
                  Rate & Confirm Delivery
                </Button>
              </Link>
            </div>
          )}

          {/* Link to full page */}
          <Link href="/delivery" className="block">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Open full tracking view</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    )
  }

  // Offers view
  if (step === 'offers' && offers.length > 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm">Runner Offers</h2>
            <Badge className="bg-emerald-500 text-white rounded-full text-[10px]">{offers.length}</Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {offers.map((offer) => (
            <Card key={offer.offerId} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold">{offer.runnerUsername.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{offer.runnerUsername}</p>
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs">{offer.runnerRating.toFixed(1)}</span>
                      <span className="text-[10px] text-muted-foreground">{offer.runnerTasksCompleted} deliveries</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">₦{offer.runnerPrice.toLocaleString()}</p>
                    {offer.runnerPrice !== form.customerPrice && (
                      <span className={`text-[10px] ${offer.runnerPrice > form.customerPrice ? 'text-red-500' : 'text-emerald-500'}`}>
                        {offer.runnerPrice > form.customerPrice ? '+' : ''}₦{(offer.runnerPrice - form.customerPrice).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => {
                    const orderId = searchOrderId ?? activeDelivery?.orderId ?? ''
                    if (orderId) rejectOffer(orderId, offer.offerId)
                  }}>Decline</Button>
                  <Button size="sm" className="flex-1 text-xs h-8 bg-emerald-500 hover:bg-emerald-600" onClick={() => handleAcceptOffer(offer.offerId)}>Accept</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Searching view
  if (step === 'searching') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto"
          >
            <Truck className="w-8 h-8 text-blue-500" />
          </motion.div>
          <div>
            <p className="font-bold">Finding Runners</p>
            <p className="text-xs text-muted-foreground">Notifying nearby runners...</p>
          </div>
          {offers.length > 0 && (
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setStep('offers')}>
              View {offers.length} Offer{offers.length > 1 ? 's' : ''}
            </Button>
          )}
          <Button variant="ghost" className="text-xs text-red-500 block mx-auto" onClick={() => {
            // Cancel on server if we have an orderId
            const orderId = searchOrderId ?? activeDelivery?.orderId
            if (orderId && isSocketConnected) {
              cancelDelivery(orderId, 'customer_cancelled')
            }
            useCustomerDeliveryStore.getState().setIsSearching(false)
            useCustomerDeliveryStore.getState().setSearchOrderId(null)
            setStep('quick')
          }}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Form view
  if (step === 'form') {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 pb-2 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setStep('quick')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-bold text-sm">Request Delivery</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Category</label>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => updateForm({ category: cat.id })}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    form.category === cat.id ? 'bg-primary text-primary-foreground shadow' : 'bg-muted'
                  }`}
                >
                  <span>{cat.emoji}</span>{cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pickup */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-500" /> Pickup</label>
            <Input
              placeholder="Where from?"
              value={form.pickupAddress}
              onChange={(e) => updateForm({ pickupAddress: e.target.value })}
              className="h-9 text-sm"
            />
            <div className="flex gap-1 overflow-x-auto pb-1">
              {UNILAG_LANDMARKS.slice(0, 5).map((lm) => (
                <button
                  key={lm.label}
                  onClick={() => updateForm({ pickupLat: lm.lat, pickupLng: lm.lng, pickupAddress: lm.label + ', UNILAG' })}
                  className={`text-[10px] px-2 py-1 rounded-md whitespace-nowrap ${
                    form.pickupAddress.startsWith(lm.label) ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : 'bg-muted'
                  }`}
                >
                  {lm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dropoff */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1"><MapPin className="w-3 h-3 text-red-500" /> Dropoff</label>
            <Input
              placeholder="Where to?"
              value={form.dropoffAddress}
              onChange={(e) => updateForm({ dropoffAddress: e.target.value })}
              className="h-9 text-sm"
            />
            <div className="flex gap-1 overflow-x-auto pb-1">
              {UNILAG_LANDMARKS.slice(0, 5).map((lm) => (
                <button
                  key={lm.label}
                  onClick={() => updateForm({ dropoffLat: lm.lat, dropoffLng: lm.lng, dropoffAddress: lm.label + ', UNILAG' })}
                  className={`text-[10px] px-2 py-1 rounded-md whitespace-nowrap ${
                    form.dropoffAddress.startsWith(lm.label) ? 'bg-red-500/10 text-red-600 border border-red-500/30' : 'bg-muted'
                  }`}
                >
                  {lm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">What are you sending?</label>
            <Input
              placeholder="e.g. Food from Jaja"
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          {/* Urgency */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Urgency</label>
            <div className="grid grid-cols-3 gap-2">
              {URGENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => updateForm({ urgency: opt.id })}
                  className={`p-2 rounded-lg text-center transition-all ${
                    form.urgency === opt.id ? 'bg-primary text-primary-foreground shadow' : 'bg-muted'
                  }`}
                >
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[10px] opacity-70">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Your offer</label>
            <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">₦{suggestedPrice.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Suggested price · Runners may counter-offer</p>
            </div>
            <Input
              type="number"
              value={form.customerPrice || ''}
              onChange={(e) => updateForm({ customerPrice: parseInt(e.target.value) || 0 })}
              className="h-9 text-sm"
              placeholder="Custom price"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="w-full h-12 text-sm font-bold"
          >
            <Zap className="w-4 h-4 mr-2" />
            Request Delivery — ₦{(form.customerPrice || suggestedPrice).toLocaleString()}
          </Button>
        </div>
      </div>
    )
  }

  // Quick select view (default)
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Delivery</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-emerald-500' : connectionError ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} />
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
          <Link href="/delivery">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              Full View <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>

        {/* Quick category grid */}
        {!isSocketConnected && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5">
              <Truck className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Delivery service connecting</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                We&apos;re connecting you to nearby runners. You can still browse while we reconnect.
              </p>
              <button
                onClick={retry}
                className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold mt-1 hover:underline"
              >
                Retry connection
              </button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">What do you need delivered?</p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleQuickRequest(cat.id)}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-left"
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className="text-sm font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* How it works */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold">How it works</p>
            <div className="space-y-1.5">
              {[
                { step: '1', text: 'Choose category & set pickup/dropoff' },
                { step: '2', text: 'Set your price — runners may counter-offer' },
                { step: '3', text: 'Accept the best offer & track live' },
                { step: '4', text: 'Share pickup code, confirm delivery' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">{item.step}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Runner link */}
        <Link href="/runner" className="block">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Become a Runner</p>
                  <p className="text-[10px] text-muted-foreground">Earn money delivering on campus</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
