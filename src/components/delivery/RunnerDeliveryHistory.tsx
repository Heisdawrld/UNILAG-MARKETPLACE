'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Star, CheckCircle2, XCircle, History } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useRunnerStore, type DeliveryHistoryItem } from '@/store/runner-store'

const CATEGORY_LABELS: Record<string, string> = { food: '🍕 Food', documents: '📄 Documents', packages: '📦 Packages', groceries: '🛒 Groceries', laundry: '👕 Laundry', medication: '💊 Medication', electronics: '📱 Electronics', other: '📋 Other' }
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = { completed: { label: 'Completed', color: 'text-emerald-600', icon: CheckCircle2 }, cancelled: { label: 'Cancelled', color: 'text-red-500', icon: XCircle } }

export default function RunnerDeliveryHistory() {
  const deliveryHistory = useRunnerStore((s) => s.deliveryHistory)
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all')
  const filteredHistory = deliveryHistory.filter(item => filter === 'all' || item.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex bg-muted rounded-lg p-0.5">{(['all', 'completed', 'cancelled'] as const).map(f => (<button key={f} onClick={() => setFilter(f)} className={`flex-1 py-2 text-xs font-medium rounded-md transition-all capitalize ${filter === f ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>{f === 'all' ? 'All' : f}</button>))}</div>
      {filteredHistory.length === 0 ? (<div className="text-center py-12"><History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm font-medium text-muted-foreground">No delivery history</p><p className="text-xs text-muted-foreground">Your completed and cancelled deliveries will appear here</p></div>) : (
        <div className="space-y-2"><AnimatePresence>{filteredHistory.map((item, index) => { const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.completed; const StatusIcon = statusConfig.icon; return (<motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: index * 0.05 }}><Card><CardContent className="p-3"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-sm shrink-0">{CATEGORY_LABELS[item.category]?.split(' ')[0] || '📋'}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium truncate">{item.title}</p><StatusIcon className={`w-3.5 h-3.5 ${statusConfig.color} shrink-0`} /></div><div className="flex items-center gap-2 mt-0.5"><span className="text-xs text-muted-foreground">{CATEGORY_LABELS[item.category]?.split(' ').slice(1).join(' ') || item.category}</span>{item.estimatedDistanceMeters && <><span className="text-muted-foreground/50">·</span><span className="text-xs text-muted-foreground">{(item.estimatedDistanceMeters / 1000).toFixed(1)} km</span></>}{item.completedAt && <><span className="text-muted-foreground/50">·</span><span className="text-xs text-muted-foreground">{new Date(item.completedAt).toLocaleDateString()}</span></>}</div>{item.customerRating && <div className="flex items-center gap-1 mt-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3 h-3 ${i < item.customerRating! ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30'}`} />)}</div>}</div><div className="text-right shrink-0"><p className="text-sm font-bold">N{item.finalPrice.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">N{Math.round(item.finalPrice * 0.88).toLocaleString()} earned</p></div></div></CardContent></Card></motion.div>) })}</AnimatePresence></div>
      )}
    </div>
  )
}
