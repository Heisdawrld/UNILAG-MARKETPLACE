'use client'

import dynamic from 'next/dynamic'
import { useRunnerStore } from '@/store/runner-store'
import { Badge } from '@/components/ui/badge'
import { MapPin, Maximize2 } from 'lucide-react'

// Dynamic import with ssr: false to prevent Leaflet window error
const CampusMap = dynamic(() => import('@/components/map/CampusMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted rounded-2xl flex items-center justify-center">
      <span className="text-xs text-muted-foreground">Loading map...</span>
    </div>
  ),
})

interface RunnerDeliveryMapProps { className?: string; onExpand?: () => void }

export default function RunnerDeliveryMap({ className = '', onExpand }: RunnerDeliveryMapProps) {
  const activeDelivery = useRunnerStore((s) => s.activeDelivery)
  const currentLat = useRunnerStore((s) => s.currentLat)
  const currentLng = useRunnerStore((s) => s.currentLng)

  return (
    <div className={`relative ${className}`}>
      <CampusMap
        pickupLat={activeDelivery?.pickupLat ?? null}
        pickupLng={activeDelivery?.pickupLng ?? null}
        dropoffLat={activeDelivery?.dropoffLat ?? null}
        dropoffLng={activeDelivery?.dropoffLng ?? null}
        userLat={currentLat}
        userLng={currentLng}
        showUserLocation={true}
        interactive={true}
        className="h-full w-full rounded-2xl overflow-hidden"
      />
      <div className="absolute top-3 left-3 z-10">
        <Badge className="bg-background/90 text-foreground rounded-full text-[10px] backdrop-blur-sm shadow-md">
          <MapPin className="w-3 h-3 mr-1" />
          {activeDelivery ? (activeDelivery.status === 'runner_en_route' ? 'Head to Pickup' : activeDelivery.status === 'in_transit' ? 'In Transit' : 'Active Delivery') : 'UNILAG Campus'}
        </Badge>
      </div>
      {onExpand && (
        <button onClick={onExpand} className="absolute top-3 right-3 z-10 w-8 h-8 bg-background/90 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-md hover:bg-background transition-colors">
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
