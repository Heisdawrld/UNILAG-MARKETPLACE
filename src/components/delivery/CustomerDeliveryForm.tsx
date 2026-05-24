'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Package, Clock, Zap, ChevronDown, Info, DollarSign, Navigation2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useCustomerDeliveryStore, UNILAG_LANDMARKS } from '@/store/customer-delivery-store'
import { DELIVERY_CATEGORY_BASELINES, URGENCY_MULTIPLIERS } from '@/lib/delivery-types'
import type { DeliveryCategory, UrgencyLevel } from '@/lib/delivery-types'

const CATEGORIES: { id: DeliveryCategory; label: string; icon: string; emoji: string }[] = [
  { id: 'food', label: 'Food', icon: 'food', emoji: '🍜' },
  { id: 'documents', label: 'Documents', icon: 'doc', emoji: '📄' },
  { id: 'packages', label: 'Packages', icon: 'pkg', emoji: '📦' },
  { id: 'groceries', label: 'Groceries', icon: 'grocery', emoji: '🛒' },
  { id: 'laundry', label: 'Laundry', icon: 'laundry', emoji: '👕' },
  { id: 'medication', label: 'Medication', icon: 'meds', emoji: '💊' },
  { id: 'electronics', label: 'Electronics', icon: 'tech', emoji: '📱' },
  { id: 'other', label: 'Other', icon: 'other', emoji: '📋' },
]

const URGENCY_OPTIONS: { id: UrgencyLevel; label: string; description: string; color: string }[] = [
  { id: 'standard', label: 'Standard', description: '30-45 min', color: 'bg-emerald-500' },
  { id: 'express', label: 'Express', description: '15-20 min', color: 'bg-orange-500' },
  { id: 'urgent', label: 'Urgent', description: 'ASAP', color: 'bg-red-500' },
]

interface CustomerDeliveryFormProps {
  onSubmit: (data: {
    pickupLat: number; pickupLng: number; pickupAddress: string
    dropoffLat: number; dropoffLng: number; dropoffAddress: string
    customerPrice: number; category: string; urgency: string
    title: string; description: string; itemImages?: string[]
  }) => void
  isSubmitting?: boolean
}

export default function CustomerDeliveryForm({ onSubmit, isSubmitting = false }: CustomerDeliveryFormProps) {
  const form = useCustomerDeliveryStore((s) => s.form)
  const updateForm = useCustomerDeliveryStore((s) => s.updateForm)
  const getSuggestedPrice = useCustomerDeliveryStore((s) => s.getSuggestedPrice)

  const [showPickupLandmarks, setShowPickupLandmarks] = useState(false)
  const [showDropoffLandmarks, setShowDropoffLandmarks] = useState(false)
  const [priceMode, setPriceMode] = useState<'manual' | 'suggested'>('suggested')

  const suggestedPrice = useMemo(() => getSuggestedPrice(), [form.category, form.urgency])
  const baseline = DELIVERY_CATEGORY_BASELINES[form.category]
  const urgencyMultiplier = URGENCY_MULTIPLIERS[form.urgency]

  const isFormValid = form.pickupLat && form.pickupLng && form.dropoffLat && form.dropoffLng
    && form.pickupAddress && form.dropoffAddress && form.title && form.customerPrice > 0

  const handleSelectPickupLandmark = (landmark: typeof UNILAG_LANDMARKS[0]) => {
    updateForm({ pickupLat: landmark.lat, pickupLng: landmark.lng, pickupAddress: landmark.label + ', UNILAG' })
    setShowPickupLandmarks(false)
  }

  const handleSelectDropoffLandmark = (landmark: typeof UNILAG_LANDMARKS[0]) => {
    updateForm({ dropoffLat: landmark.lat, dropoffLng: landmark.lng, dropoffAddress: landmark.label + ', UNILAG' })
    setShowDropoffLandmarks(false)
  }

  const handleSubmit = () => {
    if (!isFormValid) return
    const finalPrice = priceMode === 'suggested' ? suggestedPrice : form.customerPrice
    onSubmit({
      pickupLat: form.pickupLat!, pickupLng: form.pickupLng!, pickupAddress: form.pickupAddress,
      dropoffLat: form.dropoffLat!, dropoffLng: form.dropoffLng!, dropoffAddress: form.dropoffAddress,
      customerPrice: finalPrice, category: form.category, urgency: form.urgency,
      title: form.title, description: form.description, itemImages: form.itemImages,
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Request a Delivery</h2>
        <p className="text-sm text-muted-foreground">Get a runner to pick up and deliver anything on campus</p>
      </div>

      {/* Category Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">What are you sending?</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => updateForm({ category: cat.id })}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all text-center ${
                form.category === cat.id
                  ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <span className="text-lg">{cat.emoji}</span>
              <span className="text-[10px] font-medium">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pickup Location */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-emerald-500" /> Pickup Location
        </label>
        <div className="relative">
          <Input
            placeholder="Where should the runner pick up from?"
            value={form.pickupAddress}
            onChange={(e) => updateForm({ pickupAddress: e.target.value })}
            className="pr-10"
          />
          <button
            onClick={() => setShowPickupLandmarks(!showPickupLandmarks)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showPickupLandmarks ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <AnimatePresence>
          {showPickupLandmarks && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {UNILAG_LANDMARKS.map((lm) => (
                  <button
                    key={lm.label}
                    onClick={() => handleSelectPickupLandmark(lm)}
                    className={`text-left text-xs p-2 rounded-lg transition-colors ${
                      form.pickupAddress.startsWith(lm.label)
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <MapPin className="w-3 h-3 inline mr-1 text-emerald-500" />{lm.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {form.pickupAddress && !form.pickupLat && (
          <p className="text-[10px] text-amber-600 flex items-center gap-1">
            <Info className="w-3 h-3" />Tap a landmark above or your location won't be precise
          </p>
        )}
      </div>

      {/* Dropoff Location */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Navigation2 className="w-4 h-4 text-red-500" /> Dropoff Location
        </label>
        <div className="relative">
          <Input
            placeholder="Where should it be delivered to?"
            value={form.dropoffAddress}
            onChange={(e) => updateForm({ dropoffAddress: e.target.value })}
            className="pr-10"
          />
          <button
            onClick={() => setShowDropoffLandmarks(!showDropoffLandmarks)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropoffLandmarks ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <AnimatePresence>
          {showDropoffLandmarks && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {UNILAG_LANDMARKS.map((lm) => (
                  <button
                    key={lm.label}
                    onClick={() => handleSelectDropoffLandmark(lm)}
                    className={`text-left text-xs p-2 rounded-lg transition-colors ${
                      form.dropoffAddress.startsWith(lm.label)
                        ? 'bg-red-500/10 border border-red-500/30'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <Navigation2 className="w-3 h-3 inline mr-1 text-red-500" />{lm.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {form.dropoffAddress && !form.dropoffLat && (
          <p className="text-[10px] text-amber-600 flex items-center gap-1">
            <Info className="w-3 h-3" />Tap a landmark above or your location won't be precise
          </p>
        )}
      </div>

      {/* Title & Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Package className="w-4 h-4" /> Delivery Details
        </label>
        <Input
          placeholder="e.g. Food from Jaja Cafeteria"
          value={form.title}
          onChange={(e) => updateForm({ title: e.target.value })}
        />
        <Textarea
          placeholder="Any special instructions? (optional)"
          value={form.description}
          onChange={(e) => updateForm({ description: e.target.value })}
          className="min-h-[60px] text-sm"
        />
      </div>

      {/* Urgency */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> How urgent?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {URGENCY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => updateForm({ urgency: opt.id })}
              className={`p-3 rounded-xl text-center transition-all ${
                form.urgency === opt.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <div className={`w-2 h-2 rounded-full mx-auto mb-1.5 ${opt.color} ${form.urgency === opt.id ? 'opacity-100' : 'opacity-50'}`} />
              <p className="text-xs font-semibold">{opt.label}</p>
              <p className="text-[10px] opacity-80">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" /> Your Offer Price
            </label>
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setPriceMode('suggested')}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${priceMode === 'suggested' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
              >
                Suggested
              </button>
              <button
                onClick={() => setPriceMode('manual')}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${priceMode === 'manual' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
              >
                Custom
              </button>
            </div>
          </div>

          {priceMode === 'suggested' ? (
            <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Suggested price</p>
              <p className="text-3xl font-bold text-emerald-600">₦{suggestedPrice.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Based on {form.category} delivery · {form.urgency} urgency
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₦</span>
                <Input
                  type="number"
                  value={form.customerPrice}
                  onChange={(e) => updateForm({ customerPrice: parseInt(e.target.value) || 0 })}
                  className="pl-8 text-lg font-bold"
                  min={baseline.min}
                  max={baseline.max * 3}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Range: ₦{baseline.min.toLocaleString()} - ₦{baseline.max.toLocaleString()}</span>
                <span>{urgencyMultiplier}x urgency</span>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/50 rounded-lg p-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>Runners may counter-offer with a different price. You pick the best offer. 12% platform fee applies.</p>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!isFormValid || isSubmitting}
        className="w-full h-14 text-sm font-bold"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2" />
            Finding Runners...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5 mr-2" />
            Request Delivery — ₦{(priceMode === 'suggested' ? suggestedPrice : form.customerPrice).toLocaleString()}
          </>
        )}
      </Button>
    </div>
  )
}
