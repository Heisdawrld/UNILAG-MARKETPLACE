'use client'

import dynamic from 'next/dynamic'
import { useCustomerDeliveryStore } from '@/store/customer-delivery-store'
import { Badge } from '@/components/ui/badge'
import { MapPin, Maximize2, Navigation } from 'lucide-react'

const CampusMap = dynamic(() => import('@/components/map/CampusMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted rounded-2xl flex items-center justify-center">
      <span className="text-xs text-muted-foreground">Loading map...</span>
    </div>
  ),
})

interface CustomerDeliveryMapProps {
  className?: string
  onExpand?: () => void
}

export default function CustomerDeliveryMap({ className = '', onExpand }: CustomerDeliveryMapProps) {
  const activeDelivery = useCustomerDeliveryStore((s) => s.activeDelivery)
  const runnerLat = useCustomerDeliveryStore((s) => s.runnerLat)
  const runnerLng = useCustomerDeliveryStore((s) => s.runnerLng)
  const form = useCustomerDeliveryStore((s) => s.form)
  const currentView = useCustomerDeliveryStore((s) => s.currentView)

  // Determine which pins to show based on state
  const pickupLat = activeDelivery?.pickupLat ?? (currentView === 'form' ? form.pickupLat : null)
  const pickupLng = activeDelivery?.pickupLng ?? (currentView === 'form' ? form.pickupLng : null)
  const dropoffLat = activeDelivery?.dropoffLat ?? (currentView === 'form' ? form.dropoffLat : null)
  const dropoffLng = activeDelivery?.dropoffLng ?? (currentView === 'form' ? form.dropoffLng : null)

  // Runner position for live tracking (shown as user location on map)
  const showRunnerLocation = activeDelivery && runnerLat && runnerLng

  return (
    <div className={`relative ${className}`}>
      <CampusMap
        pickupLat={pickupLat}
        pickupLng={pickupLng}
        dropoffLat={dropoffLat}
        dropoffLng={dropoffLng}
        userLat={showRunnerLocation ? runnerLat : null}
        userLng={showRunnerLocation ? runnerLng : null}
        showUserLocation={!!showRunnerLocation}
        interactive={true}
        className="h-full w-full rounded-2xl overflow-hidden"
      />
      <div className="absolute top-3 left-3 z-10">
        <Badge className="bg-background/90 text-foreground rounded-full text-[10px] backdrop-blur-sm shadow-md">
          <MapPin className="w-3 h-3 mr-1" />
          {activeDelivery
            ? activeDelivery.status === 'runner_en_route'
              ? 'Runner approaching'
              : activeDelivery.status === 'in_transit'
              ? 'In transit'
              : 'Active Delivery'
            : 'UNILAG Campus'}
        </Badge>
      </div>
      {showRunnerLocation && (
        <div className="absolute top-3 right-12 z-10">
          <Badge className="bg-emerald-500/90 text-white rounded-full text-[10px] backdrop-blur-sm shadow-md">
            <Navigation className="w-3 h-3 mr-1" />
            Runner Live
          </Badge>
        </div>
      )}
      {onExpand && (
        <button
          onClick={onExpand}
          className="absolute top-3 right-3 z-10 w-8 h-8 bg-background/90 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-md hover:bg-background transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
