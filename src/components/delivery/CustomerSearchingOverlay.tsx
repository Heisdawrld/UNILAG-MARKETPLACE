'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Clock, Radio } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCustomerDeliveryStore } from '@/store/customer-delivery-store'

interface SearchingOverlayProps {
  onCancel: () => void
}

export default function SearchingOverlay({ onCancel }: SearchingOverlayProps) {
  const isSearching = useCustomerDeliveryStore((s) => s.isSearching)
  const searchStartTime = useCustomerDeliveryStore((s) => s.searchStartTime)
  const offers = useCustomerDeliveryStore((s) => s.offers)
  const setCurrentView = useCustomerDeliveryStore((s) => s.setCurrentView)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!searchStartTime) return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - searchStartTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [searchStartTime])

  // Auto-timeout after 60s — onCancel from parent already handles server-side cancellation
  useEffect(() => {
    if (elapsedSeconds >= 60 && offers.length === 0) {
      onCancel()
    }
  }, [elapsedSeconds, offers.length, onCancel]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSearching) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4 text-center"
    >
      {/* Pulsing animation */}
      <div className="relative flex items-center justify-center py-8">
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-24 h-24 rounded-full bg-blue-500/20"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          className="absolute w-16 h-16 rounded-full bg-blue-500/30"
        />
        <div className="relative w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
          <Search className="w-6 h-6 text-white" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold">Finding Runners</h3>
        <p className="text-sm text-muted-foreground mt-1">
          We're notifying nearby runners about your delivery request
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{elapsedSeconds}s</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">Searching</span>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="max-w-xs mx-auto">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${Math.min((elapsedSeconds / 60) * 100, 100)}%` }}
            className="h-full bg-blue-500 rounded-full"
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>0s</span>
          <span>60s timeout</span>
        </div>
      </div>

      {/* Offers received indicator */}
      {offers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-emerald-500/10 border-emerald-500/20">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{offers.length}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{offers.length} Runner{offers.length > 1 ? 's' : ''} Available</p>
                  <p className="text-xs text-muted-foreground">Tap to view offers</p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600"
                onClick={() => setCurrentView('offers')}
              >
                View
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Button
        variant="ghost"
        className="text-xs text-muted-foreground"
        onClick={onCancel}
      >
        Cancel Search
      </Button>
    </motion.div>
  )
}
