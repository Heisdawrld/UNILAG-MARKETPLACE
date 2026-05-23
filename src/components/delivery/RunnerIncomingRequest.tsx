'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Clock, X, Check, ArrowUpDown, Navigation, Package, Timer, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useRunnerStore, type IncomingDeliveryRequest } from '@/store/runner-store'
import type { DeliveryCategory, UrgencyLevel } from '@/lib/delivery-types'

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  food: { label: 'Food', emoji: '🍕', color: 'bg-orange-500' }, documents: { label: 'Documents', emoji: '📄', color: 'bg-blue-500' },
  packages: { label: 'Packages', emoji: '📦', color: 'bg-purple-500' }, groceries: { label: 'Groceries', emoji: '🛒', color: 'bg-green-500' },
  laundry: { label: 'Laundry', emoji: '👕', color: 'bg-cyan-500' }, medication: { label: 'Medication', emoji: '💊', color: 'bg-red-500' },
  electronics: { label: 'Electronics', emoji: '📱', color: 'bg-indigo-500' }, other: { label: 'Other', emoji: '📋', color: 'bg-gray-500' },
}
const URGENCY_CONFIG: Record<string, { label: string; color: string; borderColor: string }> = {
  standard: { label: 'Standard', color: 'text-emerald-600', borderColor: 'border-emerald-500/30' },
  express: { label: 'Express', color: 'text-amber-600', borderColor: 'border-amber-500/30' },
  urgent: { label: 'Urgent', color: 'text-red-600', borderColor: 'border-red-500/30' },
}

interface RunnerIncomingRequestProps {
  onAccept: (orderId: string, customerPrice: number) => void
  onCounter: (orderId: string, runnerPrice: number, message?: string) => void
  onDecline: (orderId: string) => void
}

export default function RunnerIncomingRequest({ onAccept, onCounter, onDecline }: RunnerIncomingRequestProps) {
  const incomingRequests = useRunnerStore((s) => s.incomingRequests)
  const currentRequestId = useRunnerStore((s) => s.currentRequestId)
  const [counterPrice, setCounterPrice] = useState<number>(0)
  const [showCounterInput, setShowCounterInput] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(30)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const activeRequest = currentRequestId ? incomingRequests.find(r => r.orderId === currentRequestId) : incomingRequests[0]

  useEffect(() => {
    if (activeRequest) { setCounterPrice(Math.round(activeRequest.customerPrice * 1.15 / 100) * 100); setRemainingSeconds(30) }
  }, [activeRequest?.orderId])

  useEffect(() => {
    if (!activeRequest) return
    timerRef.current = setInterval(() => { setRemainingSeconds(prev => { if (prev <= 1) { onDecline(activeRequest.orderId); return 0 } return prev - 1 }) }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activeRequest?.orderId, onDecline])

  if (!activeRequest) return null
  const categoryConfig = CATEGORY_CONFIG[activeRequest.category] || CATEGORY_CONFIG.other
  const urgencyConfig = URGENCY_CONFIG[activeRequest.urgency] || URGENCY_CONFIG.standard
  const distanceKm = (activeRequest.estimatedDistanceMeters / 1000).toFixed(1)
  const timerPercent = (remainingSeconds / 30) * 100
  const timerColor = remainingSeconds > 15 ? 'bg-emerald-500' : remainingSeconds > 5 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <AnimatePresence>
      <motion.div key={activeRequest.orderId} initial={{ opacity: 0, y: 100, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 100, scale: 0.95 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="w-full">
        <Card className={`overflow-hidden border-2 ${urgencyConfig.borderColor} shadow-xl`}>
          <div className="h-1 bg-muted relative overflow-hidden"><motion.div className={`absolute inset-y-0 left-0 ${timerColor}`} initial={{ width: '100%' }} animate={{ width: `${timerPercent}%` }} transition={{ duration: 1, ease: 'linear' }} /></div>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 ${categoryConfig.color} rounded-lg flex items-center justify-center text-sm`}>{categoryConfig.emoji}</div>
                <div><p className="font-bold text-sm">{activeRequest.title}</p><div className="flex items-center gap-2"><Badge variant="secondary" className="text-[10px] h-4 px-1.5">{categoryConfig.label}</Badge><span className={`text-[10px] font-semibold ${urgencyConfig.color}`}>{urgencyConfig.label}</span></div></div>
              </div>
              <div className="flex items-center gap-1"><Timer className={`w-3.5 h-3.5 ${remainingSeconds <= 10 ? 'text-red-500' : 'text-muted-foreground'}`} /><span className={`text-sm font-mono font-bold ${remainingSeconds <= 10 ? 'text-red-500' : ''}`}>{remainingSeconds}s</span></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /><div><p className="text-xs font-medium">Pickup</p><p className="text-xs text-muted-foreground">{activeRequest.pickupAddress}</p></div></div>
              <div className="ml-2 w-0.5 h-3 bg-border" />
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /><div><p className="text-xs font-medium">Dropoff</p><p className="text-xs text-muted-foreground">{activeRequest.dropoffAddress}</p></div></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1"><Navigation className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs">{distanceKm} km</span></div>
              <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs">~{activeRequest.estimatedDurationMinutes} min</span></div>
              {activeRequest.surgeMultiplier > 1 && <Badge className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/30"><TrendingUp className="w-3 h-3 mr-0.5" />{activeRequest.surgeMultiplier}x</Badge>}
            </div>
            <div className="bg-muted/50 rounded-xl p-3"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Customer Offer</span><p className="text-2xl font-bold">N{activeRequest.customerPrice.toLocaleString()}</p></div></div>
            {showCounterInput && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                <div className="flex items-center gap-2"><span className="text-xs font-medium">Your Price:</span><div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">N</span><Input type="number" value={counterPrice} onChange={(e) => setCounterPrice(Number(e.target.value))} className="pl-7 h-10 text-lg font-bold" min={300} step={100} autoFocus /></div></div>
                <div className="flex gap-2">{[0.9, 1.0, 1.2, 1.5].map(mult => (<button key={mult} onClick={() => setCounterPrice(Math.round(activeRequest.customerPrice * mult / 100) * 100)} className="flex-1 py-1.5 rounded-lg text-[10px] font-medium bg-muted hover:bg-muted/80 transition-colors">x{mult}</button>))}</div>
              </motion.div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => onDecline(activeRequest.orderId)} variant="outline" className="flex-1 h-11 text-xs" size="lg"><X className="w-4 h-4 mr-1" />Decline</Button>
              {!showCounterInput ? (<Button onClick={() => setShowCounterInput(true)} variant="outline" className="flex-1 h-11 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-50" size="lg"><ArrowUpDown className="w-4 h-4 mr-1" />Counter</Button>) : (<Button onClick={() => { onCounter(activeRequest.orderId, counterPrice, 'Counter-offer'); setShowCounterInput(false) }} className="flex-1 h-11 text-xs bg-amber-500 hover:bg-amber-600" size="lg">Send N{counterPrice.toLocaleString()}</Button>)}
              <Button onClick={() => onAccept(activeRequest.orderId, activeRequest.customerPrice)} className="flex-1 h-11 text-xs bg-emerald-500 hover:bg-emerald-600" size="lg"><Check className="w-4 h-4 mr-1" />Accept</Button>
            </div>
            {incomingRequests.length > 1 && <p className="text-[10px] text-muted-foreground text-center">+{incomingRequests.length - 1} more request{incomingRequests.length - 1 > 1 ? 's' : ''} in queue</p>}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
