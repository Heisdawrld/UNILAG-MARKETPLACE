'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Clock, Zap, CheckCircle2, X, Bike, Footprints, Car, ChevronDown, MessageSquare, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCustomerDeliveryStore, type DeliveryOfferFromRunner } from '@/store/customer-delivery-store'
import type { TransportMode } from '@/lib/delivery-types'

const TRANSPORT_ICONS: Record<TransportMode, any> = {
  walking: Footprints, bicycle: Bike, motorcycle: Zap, car: Car,
}

function OfferCard({
  offer,
  onAccept,
  onReject,
  isBest,
  customerPrice,
}: {
  offer: DeliveryOfferFromRunner
  onAccept: (offerId: string) => void
  onReject: (offerId: string) => void
  isBest: boolean
  customerPrice: number
}) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const isExpired = timeLeft <= 0

  useEffect(() => {
    const expires = new Date(offer.expiresAt).getTime()
    const tick = () => {
      const remaining = Math.max(0, Math.round((expires - Date.now()) / 1000))
      setTimeLeft(remaining)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [offer.expiresAt])

  const diff = offer.runnerPrice - customerPrice
  const TransportIcon = TRANSPORT_ICONS[offer.runnerTransportMode] || Footprints

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: isExpired ? 0.5 : 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <Card className={`overflow-hidden transition-all ${isBest ? 'ring-2 ring-emerald-500 border-emerald-500/30' : ''} ${isExpired ? 'opacity-50' : ''}`}>
        {isBest && (
          <div className="bg-emerald-500 text-white text-[10px] font-bold text-center py-1">
            BEST OFFER
          </div>
        )}
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Runner avatar */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0 shadow-md">
              {offer.runnerAvatar ? (
                <img src={offer.runnerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white font-bold text-lg">{offer.runnerUsername.charAt(0).toUpperCase()}</span>
              )}
            </div>

            {/* Runner info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{offer.runnerUsername}</p>
                <Badge variant="secondary" className="text-[10px] h-4">
                  <TransportIcon className="w-2.5 h-2.5 mr-0.5" />
                  {offer.runnerTransportMode}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-medium">{offer.runnerRating.toFixed(1)}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{offer.runnerTasksCompleted} deliveries</span>
                {offer.estimatedArrivalMinutes && (
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="w-2.5 h-2.5" />
                    ~{offer.estimatedArrivalMinutes}min
                  </div>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="text-right shrink-0">
              <p className="text-xl font-bold">₦{offer.runnerPrice.toLocaleString()}</p>
              {diff !== 0 && (
                <Badge variant={diff > 0 ? 'destructive' : 'default'} className="text-[10px] h-4">
                  {diff > 0 ? '+' : ''}₦{diff.toLocaleString()}
                </Badge>
              )}
            </div>
          </div>

          {/* Message */}
          {offer.message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2"
            >
              <div className="flex items-start gap-1.5 bg-muted rounded-lg p-2">
                <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{offer.message}</p>
              </div>
            </motion.div>
          )}

          {/* Timer + Actions */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={`text-xs font-medium ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}>
                {isExpired ? 'Expired' : `${timeLeft}s left`}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => onReject(offer.offerId)}
                disabled={isExpired}
              >
                <X className="w-3 h-3 mr-1" />Decline
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600"
                onClick={() => onAccept(offer.offerId)}
                disabled={isExpired}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />Accept
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

interface CustomerOfferViewerProps {
  onAccept: (orderId: string, offerId: string) => void
  onReject: (orderId: string, offerId: string) => void
  onCancel: () => void
}

export default function CustomerOfferViewer({ onAccept, onReject, onCancel }: CustomerOfferViewerProps) {
  const offers = useCustomerDeliveryStore((s) => s.offers)
  const searchOrderId = useCustomerDeliveryStore((s) => s.searchOrderId)
  const activeDelivery = useCustomerDeliveryStore((s) => s.activeDelivery)
  const customerPrice = activeDelivery?.customerPrice ?? 0

  // Sort offers: lowest price first, then by rating
  const sortedOffers = useMemo(() => {
    return [...offers].sort((a, b) => {
      // Prefer offers closest to customer price (or lower)
      const diffA = Math.abs(a.runnerPrice - customerPrice)
      const diffB = Math.abs(b.runnerPrice - customerPrice)
      if (diffA !== diffB) return diffA - diffB
      return b.runnerRating - a.runnerRating
    })
  }, [offers, customerPrice])

  if (offers.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto" />
        </motion.div>
        <p className="text-sm font-medium">Waiting for runners to respond...</p>
        <p className="text-xs text-muted-foreground">Nearby runners are reviewing your request</p>
        <Button variant="ghost" className="text-xs text-red-500" onClick={onCancel}>
          Cancel Request
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">Runner Offers</h3>
          <p className="text-xs text-muted-foreground">{offers.length} runner{offers.length > 1 ? 's' : ''} available</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          Your offer: ₦{customerPrice.toLocaleString()}
        </Badge>
      </div>

      <AnimatePresence>
        {sortedOffers.map((offer, index) => (
          <OfferCard
            key={offer.offerId}
            offer={offer}
            onAccept={(offerId) => onAccept(searchOrderId ?? activeDelivery?.orderId ?? '', offerId)}
            onReject={(offerId) => onReject(searchOrderId ?? activeDelivery?.orderId ?? '', offerId)}
            isBest={index === 0 && sortedOffers.length > 1}
            customerPrice={customerPrice}
          />
        ))}
      </AnimatePresence>

      <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={onCancel}>
        Cancel Request
      </Button>
    </div>
  )
}
