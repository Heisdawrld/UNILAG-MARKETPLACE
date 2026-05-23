'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigation, CheckCircle2, MapPin, Phone, Package, Clock, ShieldCheck, Hash, Truck, Handshake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useRunnerStore, type ActiveDelivery } from '@/store/runner-store'
import type { DeliveryOrderStatus } from '@/lib/delivery-types'

const STATUS_STEPS: { status: DeliveryOrderStatus; label: string; icon: any; description: string }[] = [
  { status: 'runner_assigned', label: 'Assigned', icon: CheckCircle2, description: 'Head to pickup location' },
  { status: 'runner_en_route', label: 'En Route', icon: Navigation, description: 'Navigate to pickup' },
  { status: 'picked_up', label: 'Picked Up', icon: Package, description: 'Item collected' },
  { status: 'in_transit', label: 'In Transit', icon: Truck, description: 'Delivering to destination' },
  { status: 'delivered', label: 'Delivered', icon: Handshake, description: 'Waiting for confirmation' },
]

function getStatusStepIndex(status: DeliveryOrderStatus): number { const idx = STATUS_STEPS.findIndex(s => s.status === status); return idx >= 0 ? idx : 0 }

interface RunnerActiveDeliveryProps {
  onStartNavigation: () => void; onConfirmPickup: (orderId: string, pickupCode: string) => void
  onStartTransit: () => void; onConfirmDropoff: (orderId: string) => void; onCancel: (orderId: string, reason: string) => void
}

export default function RunnerActiveDelivery({ onStartNavigation, onConfirmPickup, onStartTransit, onConfirmDropoff, onCancel }: RunnerActiveDeliveryProps) {
  const activeDelivery = useRunnerStore((s) => s.activeDelivery)
  const [pickupCodeInput, setPickupCodeInput] = useState('')
  const [pickupCodeError, setPickupCodeError] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  useEffect(() => {
    if (!activeDelivery) return
    const assignedAt = new Date(activeDelivery.assignedAt).getTime()
    const interval = setInterval(() => { setElapsedMinutes(Math.round((Date.now() - assignedAt) / 60000)) }, 10000)
    return () => clearInterval(interval)
  }, [activeDelivery?.assignedAt])

  if (!activeDelivery) return null
  const currentStepIndex = getStatusStepIndex(activeDelivery.status)

  const handlePickupConfirm = () => { if (pickupCodeInput.length !== 4) { setPickupCodeError(true); return }; onConfirmPickup(activeDelivery.orderId, pickupCodeInput) }

  return (
    <div className="space-y-4">
      <motion.div className={`rounded-2xl p-4 ${activeDelivery.status === 'delivered' ? 'bg-green-500/10 border border-green-500/20' : activeDelivery.status === 'cancelled' ? 'bg-red-500/10 border border-red-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`} layout>
        <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Delivery Status</p><p className="text-lg font-bold capitalize">{activeDelivery.status.replace(/_/g, ' ')}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Elapsed</p><p className="text-lg font-bold">{elapsedMinutes}m</p></div></div>
      </motion.div>

      <Card><CardContent className="p-4"><div className="space-y-3">{STATUS_STEPS.map((step, index) => {
        const isCompleted = index < currentStepIndex; const isCurrent = index === currentStepIndex
        return (<div key={step.status} className="flex items-start gap-3"><div className="relative flex flex-col items-center"><div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-muted'}`}>{isCompleted ? <CheckCircle2 className="w-4 h-4 text-white" /> : <step.icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-muted-foreground'}`} />}</div>{index < STATUS_STEPS.length - 1 && <div className={`w-0.5 h-6 ${isCompleted ? 'bg-emerald-500' : 'bg-muted'}`} />}</div><div className="pb-2"><p className={`text-sm font-medium ${isCompleted ? 'text-emerald-600' : isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p><p className="text-xs text-muted-foreground">{step.description}</p></div></div>)
      })}</div></CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /><div className="flex-1"><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm font-medium">{activeDelivery.pickupAddress}</p></div>{(activeDelivery.status === 'runner_assigned' || activeDelivery.status === 'runner_en_route') && <a href={`https://www.google.com/maps/dir/?api=1&destination=${activeDelivery.pickupLat},${activeDelivery.pickupLng}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="h-7 text-[10px]"><Navigation className="w-3 h-3 mr-1" />Navigate</Button></a>}</div>
        <div className="ml-2 w-0.5 h-4 bg-border" />
        <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /><div className="flex-1"><p className="text-xs text-muted-foreground">Dropoff</p><p className="text-sm font-medium">{activeDelivery.dropoffAddress}</p></div></div>
      </CardContent></Card>

      <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center"><span className="text-sm font-bold text-orange-600">{activeDelivery.customerUsername.charAt(0).toUpperCase()}</span></div><div><p className="text-sm font-semibold">{activeDelivery.customerUsername}</p><p className="text-xs text-muted-foreground">Customer</p></div>{activeDelivery.customerPhone && <a href={`tel:${activeDelivery.customerPhone}`} className="ml-auto"><Button size="sm" variant="outline" className="h-8 gap-1.5"><Phone className="w-3.5 h-3.5" />Call</Button></a>}</div></CardContent></Card>

      {activeDelivery.status === 'runner_en_route' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-amber-500/30 bg-amber-50 dark:bg-amber-950/20"><CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-amber-500" /><p className="text-sm font-bold">Pickup Verification</p></div>
            <p className="text-xs text-muted-foreground">Ask the customer for their 4-digit pickup code.</p>
            <div className="flex items-center gap-2"><div className="relative flex-1"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={pickupCodeInput} onChange={(e) => { setPickupCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setPickupCodeError(false) }} placeholder="0000" className={`pl-9 h-12 text-center text-xl font-mono tracking-widest ${pickupCodeError ? 'border-red-500' : ''}`} maxLength={4} inputMode="numeric" /></div><Button onClick={handlePickupConfirm} className="h-12 px-6 bg-amber-500 hover:bg-amber-600" disabled={pickupCodeInput.length !== 4}>Verify</Button></div>
            {pickupCodeError && <p className="text-xs text-red-500 text-center">Enter a valid 4-digit code</p>}
          </CardContent></Card>
        </motion.div>
      )}

      <div className="space-y-2">
        {activeDelivery.status === 'runner_assigned' && <Button onClick={onStartNavigation} className="w-full h-14 text-sm font-bold bg-blue-500 hover:bg-blue-600" size="lg"><Navigation className="w-5 h-5 mr-2" />Head to Pickup</Button>}
        {activeDelivery.status === 'picked_up' && <Button onClick={onStartTransit} className="w-full h-14 text-sm font-bold bg-orange-500 hover:bg-orange-600" size="lg"><Truck className="w-5 h-5 mr-2" />Start Transit to Dropoff</Button>}
        {activeDelivery.status === 'in_transit' && <Button onClick={() => onConfirmDropoff(activeDelivery.orderId)} className="w-full h-14 text-sm font-bold bg-emerald-500 hover:bg-emerald-600" size="lg"><CheckCircle2 className="w-5 h-5 mr-2" />Confirm Dropoff</Button>}
        {activeDelivery.status === 'delivered' && (<div className="text-center py-4"><CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" /><p className="text-lg font-bold">Delivery Complete!</p><p className="text-sm text-muted-foreground">Waiting for customer confirmation...</p>{activeDelivery.finalPrice && <div className="mt-3 bg-green-50 dark:bg-green-950/20 rounded-xl p-3 inline-block"><p className="text-xs text-muted-foreground">You earned</p><p className="text-2xl font-bold text-green-600">N{Math.round(activeDelivery.finalPrice * 0.88).toLocaleString()}</p></div>}</div>)}
      </div>

      {['runner_assigned', 'runner_en_route'].includes(activeDelivery.status) && !showCancelConfirm && <Button variant="ghost" className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setShowCancelConfirm(true)}>Cancel Delivery</Button>}
      {showCancelConfirm && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 space-y-3"><p className="text-sm font-medium text-red-600">Are you sure?</p><p className="text-xs text-muted-foreground">Cancelling after assignment may affect your rating.</p><div className="flex gap-2"><Button variant="outline" className="flex-1 text-xs" onClick={() => setShowCancelConfirm(false)}>Keep Delivery</Button><Button variant="destructive" className="flex-1 text-xs" onClick={() => { onCancel(activeDelivery.orderId, 'runner_cancelled'); setShowCancelConfirm(false) }}>Yes, Cancel</Button></div></motion.div>)}
    </div>
  )
}
