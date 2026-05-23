'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Navigation, CheckCircle2, MapPin, Phone, Package, Clock, ShieldCheck, Truck, Handshake,
  Star, MessageSquare, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useCustomerDeliveryStore, type CustomerActiveDelivery } from '@/store/customer-delivery-store'
import type { DeliveryOrderStatus } from '@/lib/delivery-types'

const STATUS_STEPS: { status: DeliveryOrderStatus; label: string; icon: any; description: string }[] = [
  { status: 'runner_assigned', label: 'Runner Found', icon: CheckCircle2, description: 'Runner heading to you' },
  { status: 'runner_en_route', label: 'En Route', icon: Navigation, description: 'Runner on the way' },
  { status: 'picked_up', label: 'Picked Up', icon: Package, description: 'Item collected' },
  { status: 'in_transit', label: 'In Transit', icon: Truck, description: 'Delivering to you' },
  { status: 'delivered', label: 'Delivered', icon: Handshake, description: 'Arrived at dropoff' },
]

function getStatusStepIndex(status: DeliveryOrderStatus): number {
  const idx = STATUS_STEPS.findIndex(s => s.status === status)
  return idx >= 0 ? idx : 0
}

interface CustomerTrackingViewProps {
  onConfirmDelivery: (orderId: string, rating: number, review?: string) => void
  onCancelDelivery: (orderId: string, reason: string) => void
}

export default function CustomerTrackingView({ onConfirmDelivery, onCancelDelivery }: CustomerTrackingViewProps) {
  const activeDelivery = useCustomerDeliveryStore((s) => s.activeDelivery)
  const runnerLat = useCustomerDeliveryStore((s) => s.runnerLat)
  const runnerLng = useCustomerDeliveryStore((s) => s.runnerLng)
  const setShowRatingModal = useCustomerDeliveryStore((s) => s.setShowRatingModal)
  const setCurrentView = useCustomerDeliveryStore((s) => s.setCurrentView)
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  useEffect(() => {
    if (!activeDelivery) return
    const startTime = activeDelivery.assignedAt
      ? new Date(activeDelivery.assignedAt).getTime()
      : new Date(activeDelivery.createdAt).getTime()
    const interval = setInterval(() => {
      setElapsedMinutes(Math.round((Date.now() - startTime) / 60000))
    }, 10000)
    return () => clearInterval(interval)
  }, [activeDelivery?.assignedAt, activeDelivery?.createdAt])

  if (!activeDelivery) return null

  const currentStepIndex = getStatusStepIndex(activeDelivery.status)

  const handleConfirmDelivery = () => {
    onConfirmDelivery(activeDelivery.orderId, rating, review || undefined)
    setShowRating(false)
    setCurrentView('form')
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <motion.div
        layout
        className={`rounded-2xl p-4 ${
          activeDelivery.status === 'delivered' ? 'bg-green-500/10 border border-green-500/20' :
          activeDelivery.status === 'cancelled' ? 'bg-red-500/10 border border-red-500/20' :
          'bg-blue-500/10 border border-blue-500/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Delivery Status</p>
            <p className="text-lg font-bold capitalize">{activeDelivery.status.replace(/_/g, ' ')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Time</p>
            <p className="text-lg font-bold">{elapsedMinutes}m</p>
          </div>
        </div>
        {activeDelivery.finalPrice && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Delivery fee</span>
              <span className="text-sm font-bold">N{activeDelivery.finalPrice.toLocaleString()}</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Step tracker */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {STATUS_STEPS.map((step, index) => {
              const isCompleted = index < currentStepIndex
              const isCurrent = index === currentStepIndex
              return (
                <div key={step.status} className="flex items-start gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isCompleted ? 'bg-emerald-500' :
                      isCurrent ? 'bg-blue-500 ring-4 ring-blue-500/20' :
                      'bg-muted'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : (
                        <step.icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-muted-foreground'}`} />
                      )}
                    </div>
                    {index < STATUS_STEPS.length - 1 && (
                      <div className={`w-0.5 h-6 ${isCompleted ? 'bg-emerald-500' : 'bg-muted'}`} />
                    )}
                  </div>
                  <div className="pb-2">
                    <p className={`text-sm font-medium ${isCompleted ? 'text-emerald-600' : isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pickup/Dropoff summary */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Pickup</p>
              <p className="text-sm font-medium">{activeDelivery.pickupAddress}</p>
            </div>
          </div>
          <div className="ml-2 w-0.5 h-4 bg-border" />
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Dropoff</p>
              <p className="text-sm font-medium">{activeDelivery.dropoffAddress}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Runner info card */}
      {activeDelivery.runnerId && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md">
                {activeDelivery.runnerAvatar ? (
                  <img src={activeDelivery.runnerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">
                    {(activeDelivery.runnerUsername ?? '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{activeDelivery.runnerUsername}</p>
                <p className="text-xs text-muted-foreground">Your runner</p>
              </div>
              {activeDelivery.runnerPhone && (
                <a href={`tel:${activeDelivery.runnerPhone}`}>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5">
                    <Phone className="w-3.5 h-3.5" />Call
                  </Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pickup code (shown when runner is en route) */}
      {(activeDelivery.status === 'runner_assigned' || activeDelivery.status === 'runner_en_route') && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <p className="text-sm font-bold">Your Pickup Code</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this code with the runner when they arrive to verify pickup
              </p>
              <div className="flex items-center justify-center py-2">
                <div className="bg-white dark:bg-background rounded-xl px-6 py-3 shadow-inner border-2 border-dashed border-amber-500/30">
                  <p className="text-3xl font-mono font-bold tracking-[0.3em] text-amber-600">
                    {activeDelivery.pickupCode}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Delivered - Confirm & Rate */}
      {activeDelivery.status === 'delivered' && !showRating && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20">
            <CardContent className="p-4 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-lg font-bold">Item Delivered!</p>
              <p className="text-sm text-muted-foreground">
                Did you receive your delivery? Confirm to complete the order.
              </p>
              <Button
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 font-bold"
                onClick={() => setShowRating(true)}
              >
                Confirm Delivery
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Rating modal */}
      {showRating && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="text-center">
                <p className="font-bold">Rate your delivery</p>
                <p className="text-xs text-muted-foreground">How was your experience?</p>
              </div>

              {/* Star rating */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        star <= rating
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <Textarea
                placeholder="Leave a review (optional)"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                className="min-h-[60px] text-sm"
              />

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowRating(false)}>
                  Skip
                </Button>
                <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600" onClick={handleConfirmDelivery}>
                  Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Cancel button */}
      {!['delivered', 'completed', 'cancelled'].includes(activeDelivery.status) && !showCancelConfirm && (
        <Button
          variant="ghost"
          className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={() => setShowCancelConfirm(true)}
        >
          Cancel Delivery
        </Button>
      )}

      {showCancelConfirm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 space-y-3"
        >
          <p className="text-sm font-medium text-red-600">Cancel this delivery?</p>
          <p className="text-xs text-muted-foreground">Your runner will be notified. A cancellation fee may apply.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-xs" onClick={() => setShowCancelConfirm(false)}>
              Keep Delivery
            </Button>
            <Button
              variant="destructive"
              className="flex-1 text-xs"
              onClick={() => { onCancelDelivery(activeDelivery.orderId, 'customer_cancelled'); setShowCancelConfirm(false) }}
            >
              Yes, Cancel
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
