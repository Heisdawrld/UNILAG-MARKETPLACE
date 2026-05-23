'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Package, MapPin, Truck, CheckCircle2, Clock, Star, ArrowLeft, Share2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { DeliveryOrderStatus } from '@/lib/delivery-types'

interface TrackingData {
  id: string
  status: DeliveryOrderStatus
  title: string
  category: string
  pickupAddress: string
  dropoffAddress: string
  estimatedDurationMinutes: number | null
  runnerName: string | null
  runnerAvatar: string | null
  runnerRating: number | null
  runnerTransport: string | null
  createdAt: string
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  created: { label: 'Created', color: 'bg-gray-500', icon: Package },
  searching: { label: 'Finding Runner', color: 'bg-blue-500', icon: Clock },
  runner_assigned: { label: 'Runner Found', color: 'bg-indigo-500', icon: CheckCircle2 },
  runner_en_route: { label: 'Runner En Route', color: 'bg-blue-500', icon: Truck },
  picked_up: { label: 'Picked Up', color: 'bg-orange-500', icon: Package },
  in_transit: { label: 'In Transit', color: 'bg-amber-500', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-emerald-500', icon: CheckCircle2 },
  completed: { label: 'Completed', color: 'bg-emerald-600', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-500', icon: Package },
}

export default function DeliveryTrackingPage() {
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchTracking = async () => {
      try {
        const result = await api.get(`/api/deliveries/${id}/track`)
        if (result?.id) {
          setData(result)
        } else {
          setError('Delivery not found')
        }
      } catch {
        setError('Failed to load tracking info')
      } finally {
        setLoading(false)
      }
    }
    fetchTracking()

    // Auto-refresh every 15s for live tracking
    const interval = setInterval(fetchTracking, 15000)
    return () => clearInterval(interval)
  }, [id])

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: `Delivery: ${data?.title}`, url })
      } catch {}
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading delivery tracking...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <Package className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Delivery Not Found</h1>
          <p className="text-sm text-muted-foreground">{error || 'This delivery may have been removed or the link is invalid.'}</p>
          <a href="/delivery">
            <Button className="mt-4" variant="outline">Go to Delivery</Button>
          </a>
        </div>
      </div>
    )
  }

  const statusInfo = STATUS_LABELS[data.status] || STATUS_LABELS.created
  const StatusIcon = statusInfo.icon
  const isActive = !['completed', 'cancelled'].includes(data.status)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/delivery">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </a>
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm">Delivery Tracking</h1>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.color} ${isActive ? 'animate-pulse' : ''}`} />
                <span className="text-[10px] text-muted-foreground">{statusInfo.label}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={handleShare}>
            <Share2 className="w-3.5 h-3.5" />
            <span className="text-xs">Share</span>
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-6 text-center ${
            data.status === 'completed' ? 'bg-emerald-500/10 border border-emerald-500/20' :
            data.status === 'cancelled' ? 'bg-red-500/10 border border-red-500/20' :
            'bg-blue-500/10 border border-blue-500/20'
          }`}
        >
          <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${statusInfo.color}`}>
            <StatusIcon className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-1">{statusInfo.label}</h2>
          <p className="text-sm text-muted-foreground">{data.title}</p>
          {isActive && (
            <p className="text-xs text-muted-foreground mt-2">
              This page auto-refreshes every 15 seconds
            </p>
          )}
        </motion.div>

        {/* Route */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium">{data.pickupAddress}</p>
              </div>
            </div>
            <div className="ml-2 w-0.5 h-4 bg-border" />
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Dropoff</p>
                <p className="text-sm font-medium">{data.dropoffAddress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Runner info */}
        {data.runnerName && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md">
                {data.runnerAvatar ? (
                  <img src={data.runnerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">{data.runnerName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="font-semibold text-sm">{data.runnerName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {data.runnerRating && (
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs">{data.runnerRating.toFixed(1)}</span>
                    </div>
                  )}
                  {data.runnerTransport && (
                    <Badge variant="secondary" className="text-[10px] h-4">{data.runnerTransport}</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Meta */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Order ID: {data.id.slice(0, 12)}...</p>
          <p>Requested {new Date(data.createdAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
