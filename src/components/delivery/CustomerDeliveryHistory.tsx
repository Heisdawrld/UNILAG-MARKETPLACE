'use client'

import { motion } from 'framer-motion'
import { Package, Star, MapPin, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCustomerDeliveryStore, type CustomerDeliveryHistoryItem } from '@/store/customer-delivery-store'
import type { DeliveryCategory } from '@/lib/delivery-types'

const CATEGORY_ICONS: Record<DeliveryCategory, string> = {
  food: '🍜', documents: '📄', packages: '📦', groceries: '🛒',
  laundry: '👕', medication: '💊', electronics: '📱', other: '📋',
}

function HistoryItemCard({ item }: { item: CustomerDeliveryHistoryItem }) {
  const isCompleted = item.status === 'completed'
  const isCancelled = item.status === 'cancelled'

  return (
    <Card className={`overflow-hidden ${isCancelled ? 'opacity-60' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isCompleted ? 'bg-emerald-500/10' : 'bg-red-500/10'
          }`}>
            <span className="text-lg">{CATEGORY_ICONS[item.category] || '📋'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">{item.title}</p>
              {item.finalPrice && (
                <p className="text-sm font-bold shrink-0 ml-2">N{item.finalPrice.toLocaleString()}</p>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={isCompleted ? 'default' : 'destructive'}
                className="text-[10px] h-4"
              >
                {isCompleted ? 'Completed' : 'Cancelled'}
              </Badge>
              {item.completedAt && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.completedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {item.runnerRating && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-xs">{item.runnerRating}/5</span>
                {item.runnerReview && (
                  <span className="text-xs text-muted-foreground truncate ml-1">"{item.runnerReview}"</span>
                )}
              </div>
            )}
            {item.estimatedDistanceMeters && (
              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                <MapPin className="w-2.5 h-2.5" />
                {(item.estimatedDistanceMeters / 1000).toFixed(1)}km
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CustomerDeliveryHistory() {
  const deliveryHistory = useCustomerDeliveryStore((s) => s.deliveryHistory)

  if (deliveryHistory.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <Package className="w-12 h-12 text-muted-foreground/30 mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">No delivery history yet</p>
        <p className="text-xs text-muted-foreground">Your past deliveries will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Delivery History</h3>
        <Badge variant="secondary" className="text-[10px]">{deliveryHistory.length} deliveries</Badge>
      </div>
      <div className="space-y-2">
        {deliveryHistory.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <HistoryItemCard item={item} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
