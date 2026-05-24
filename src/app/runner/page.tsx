'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, TrendingUp, History, MapPin, Package } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRunnerStore, type RunnerView } from '@/store/runner-store'
import { useRunnerSocket } from '@/hooks/use-runner-socket'
import { useRunnerGps } from '@/hooks/use-runner-gps'
import RunnerOnlineToggle from '@/components/delivery/RunnerOnlineToggle'
import RunnerIncomingRequest from '@/components/delivery/RunnerIncomingRequest'
import RunnerActiveDelivery from '@/components/delivery/RunnerActiveDelivery'
import RunnerDeliveryMap from '@/components/delivery/RunnerDeliveryMap'
import RunnerEarnings from '@/components/delivery/RunnerEarnings'
import RunnerDeliveryHistory from '@/components/delivery/RunnerDeliveryHistory'
import RunnerStatsHeader from '@/components/delivery/RunnerStatsHeader'

const VIEW_TABS: { id: RunnerView; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: MapPin },
  { id: 'active', label: 'Delivery', icon: Package },
  { id: 'earnings', label: 'Earnings', icon: TrendingUp },
  { id: 'history', label: 'History', icon: History },
]

export default function RunnerPage() {
  const isOnline = useRunnerStore((s) => s.isOnline)
  const currentView = useRunnerStore((s) => s.currentView)
  const setCurrentView = useRunnerStore((s) => s.setCurrentView)
  const activeDelivery = useRunnerStore((s) => s.activeDelivery)
  const incomingRequests = useRunnerStore((s) => s.incomingRequests)
  const isSocketConnected = useRunnerStore((s) => s.isSocketConnected)

  const { isConnected, connectionError, retry, goOnline, goOffline, acceptRequest, counterOffer, declineRequest, confirmPickup, confirmDropoff, cancelDelivery, startNavigation, startTransit } = useRunnerSocket({ userId: null, isRunner: true }) // Uses Clerk auth token automatically
  const { isSimulated } = useRunnerGps({ enabled: isOnline, simulate: true, updateInterval: 3000, heartbeatInterval: 15000 })
  const [mapExpanded, setMapExpanded] = useState(false)

  const handleToggleOnline = useCallback((online: boolean) => { if (online) goOnline(); else goOffline() }, [goOnline, goOffline])

  useEffect(() => { if (activeDelivery && currentView === 'dashboard') setCurrentView('active') }, [activeDelivery, currentView, setCurrentView])

  useEffect(() => {
    const store = useRunnerStore.getState()
    store.setEarnings({ today: 4200, week: 18700, month: 52300, totalDeliveries: 12, avgRating: 4.7, pendingPayout: 3200 })
    store.setStats(12, 4.7)
    store.setDeliveryHistory([
      { id: 'hist-1', title: 'Food Delivery from Jaja', category: 'food', finalPrice: 1500, status: 'completed', completedAt: new Date(Date.now() - 86400000).toISOString(), customerRating: 5, customerReview: 'Great service!', estimatedDistanceMeters: 800 },
      { id: 'hist-2', title: 'Document Pickup', category: 'documents', finalPrice: 800, status: 'completed', completedAt: new Date(Date.now() - 172800000).toISOString(), customerRating: 4, customerReview: null, estimatedDistanceMeters: 600 },
      { id: 'hist-3', title: 'Package to Moremi', category: 'packages', finalPrice: 1200, status: 'cancelled', completedAt: null, customerRating: null, customerReview: null, estimatedDistanceMeters: 1200 },
    ])
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center"><Truck className="w-4 h-4 text-white" /></div>
            <div><h1 className="font-bold text-sm">Runner Dashboard</h1><div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} /><span className="text-[10px] text-muted-foreground">{isSocketConnected ? 'Live' : connectionError ? 'Reconnecting...' : 'Offline'}</span>{!isSocketConnected && <button onClick={retry} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium ml-1">Retry</button>}{isSimulated && isOnline && <Badge variant="secondary" className="text-[8px] h-3.5 px-1 ml-1">SIM GPS</Badge>}</div></div>
          </div>
          <div className="flex items-center gap-2">{isOnline && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 rounded-full text-[10px]"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1 animate-pulse" />Online</Badge>}{incomingRequests.length > 0 && <Badge className="bg-orange-500 text-white rounded-full text-[10px]">{incomingRequests.length} new</Badge>}</div>
        </div>
      </div>

      <div className={`relative transition-all duration-300 ${mapExpanded ? 'h-[50vh]' : 'h-[220px]'}`}><RunnerDeliveryMap className="w-full h-full" onExpand={() => setMapExpanded(!mapExpanded)} /></div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-24 space-y-4">
        <RunnerOnlineToggle isConnected={isConnected} onToggle={handleToggleOnline} />

        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {VIEW_TABS.map(tab => { const isActive = currentView === tab.id; const showBadge = tab.id === 'active' && activeDelivery; const showRequestBadge = tab.id === 'dashboard' && incomingRequests.length > 0; return (<button key={tab.id} onClick={() => setCurrentView(tab.id)} className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-all relative flex items-center justify-center gap-1.5 ${isActive ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}><tab.icon className="w-3.5 h-3.5" />{tab.label}{showBadge && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full" />}{showRequestBadge && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full" />}</button>) })}
        </div>

        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (<motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4"><RunnerStatsHeader />{isOnline && incomingRequests.length > 0 ? (<div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-semibold text-sm">Incoming Requests</h3><Badge variant="secondary" className="text-[10px]">{incomingRequests.length} available</Badge></div><RunnerIncomingRequest onAccept={acceptRequest} onCounter={counterOffer} onDecline={declineRequest} /></div>) : isOnline ? (<div className="text-center py-12"><Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm font-medium text-muted-foreground">Waiting for requests...</p><p className="text-xs text-muted-foreground">New delivery requests from nearby students will appear here</p><div className="flex items-center justify-center gap-2 mt-3"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /><span className="text-xs text-emerald-600">Listening for requests</span></div></div>) : (<div className="text-center py-12"><MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm font-medium text-muted-foreground">Go online to start receiving requests</p><p className="text-xs text-muted-foreground">Toggle the switch above to start earning</p></div>)}</motion.div>)}
          {currentView === 'active' && (<motion.div key="active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>{activeDelivery ? <RunnerActiveDelivery onStartNavigation={startNavigation} onConfirmPickup={confirmPickup} onStartTransit={startTransit} onConfirmDropoff={confirmDropoff} onCancel={cancelDelivery} /> : <div className="text-center py-16"><Package className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" /><p className="text-lg font-medium text-muted-foreground">No Active Delivery</p><p className="text-xs text-muted-foreground mt-1">Accept a delivery request to get started</p><Button variant="outline" className="mt-4" onClick={() => setCurrentView('dashboard')}>View Requests</Button></div>}</motion.div>)}
          {currentView === 'earnings' && (<motion.div key="earnings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><RunnerEarnings /></motion.div>)}
          {currentView === 'history' && (<motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><RunnerDeliveryHistory /></motion.div>)}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t z-40 safe-bottom"><div className="max-w-2xl mx-auto flex">{VIEW_TABS.map(tab => { const isActive = currentView === tab.id; return (<button key={tab.id} onClick={() => setCurrentView(tab.id)} className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-emerald-600' : 'text-muted-foreground'}`}><tab.icon className="w-5 h-5" /><span className="text-[10px] font-medium">{tab.label}</span></button>) })}</div></div>
    </div>
  )
}
