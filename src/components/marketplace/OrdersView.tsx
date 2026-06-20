'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, ShoppingBag, Clock, CheckCircle, XCircle, ChevronRight, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface OrderItem {
  id: string
  listingId: string
  listing: {
    id: string
    title: string
    price: number
    images: string
    condition: string
  }
  buyer: { id: string; username: string; avatar: string | null }
  seller: { id: string; username: string; avatar: string | null }
  amount: number
  platformFee: number
  sellerPayout: number
  status: string
  paymentMethod: string | null
  paymentStatus: string
  createdAt: string
  completedAt: string | null
  cancelledAt: string | null
}

type OrderFilter = 'all' | 'buying' | 'selling'

interface OrdersViewProps {
  user: { id: string; username: string; email: string; isRunner: boolean }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Package }> = {
  pending: { label: 'Pending', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Clock },
  paid: { label: 'Paid', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: CheckCircle },
  delivered: { label: 'Delivered', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: Package },
  completed: { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: XCircle },
  disputed: { label: 'Disputed', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30', icon: Clock },
}

function getImages(imagesStr: string): string[] {
  try { return JSON.parse(imagesStr) } catch { return [] }
}

export default function OrdersView({ user }: OrdersViewProps) {
  const { toast } = useToast()
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<OrderFilter>('all')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOrders() {
      try {
        const data = await api.get(`/api/orders?role=${filter === 'selling' ? 'seller' : 'buyer'}&limit=50`)
        if (data?.orders) setOrders(data.orders)
      } catch (err) {
        console.error('[orders] Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [filter])

  const handleConfirmDelivery = useCallback(async (orderId: string) => {
    setConfirmingId(orderId)
    try {
      const result = await api.patch(`/api/orders/${orderId}`, { action: 'confirm_delivery' })
      if (result?.success) {
        toast({ title: 'Order confirmed!', description: 'Payment has been released to the seller.' })
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completed', paymentStatus: 'released' } : o))
      }
    } catch (err) {
      toast({ title: 'Failed to confirm', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setConfirmingId(null)
    }
  }, [toast])

  const handleMarkDelivered = useCallback(async (orderId: string) => {
    setConfirmingId(orderId)
    try {
      const result = await api.patch(`/api/orders/${orderId}`, { action: 'mark_delivered' })
      if (result?.success) {
        toast({ title: 'Marked as delivered!', description: 'Waiting for buyer to confirm.' })
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o))
      }
    } catch (err) {
      toast({ title: 'Failed to update', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setConfirmingId(null)
    }
  }, [toast])

  const handleCancel = useCallback(async (orderId: string) => {
    try {
      const result = await api.patch(`/api/orders/${orderId}`, { action: 'cancel', reason: 'Cancelled by user' })
      if (result?.success) {
        toast({ title: 'Order cancelled' })
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
      }
    } catch (err) {
      toast({ title: 'Failed to cancel', variant: 'destructive' })
    }
  }, [toast])

  const filteredOrders = orders

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold">My Orders</h2>
          <p className="text-xs text-muted-foreground">Track your purchases and sales</p>
        </div>

        {/* Filter tabs */}
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {([
            { id: 'all' as OrderFilter, label: 'All' },
            { id: 'buying' as OrderFilter, label: 'Buying' },
            { id: 'selling' as OrderFilter, label: 'Selling' },
          ]).map(f => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setLoading(true) }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                filter === f.id ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-16">
            <ShoppingBag className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No orders yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {filter === 'buying' ? 'Items you buy will appear here' : filter === 'selling' ? 'Items you sell will appear here' : 'Your orders will appear here'}
            </p>
          </div>
        )}

        {/* Orders list */}
        {!loading && filteredOrders.map(order => {
          const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
          const StatusIcon = statusConfig.icon
          const images = getImages(order.listing.images)
          const isBuyer = order.buyer.id === user.id
          const isSeller = order.seller.id === user.id
          const otherUser = isBuyer ? order.seller : order.buyer

          return (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  {/* Product image */}
                  <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                    {images[0] ? (
                      <img src={images[0]} alt={order.listing.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{order.listing.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {isBuyer ? `From @${otherUser.username}` : `To @${otherUser.username}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold">₦{order.amount.toLocaleString()}</span>
                      <Badge className={`${statusConfig.color} rounded-full text-[10px]`}>
                        <StatusIcon className="w-3 h-3 mr-0.5" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {order.paymentMethod === 'cash' || order.paymentMethod === 'meet_and_pay'
                        ? 'Meet & Pay'
                        : order.paymentMethod === 'locked'
                          ? 'Payment pending setup'
                          : order.paymentMethod || 'Not paid yet'}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  {/* Buyer: Confirm delivery */}
                  {isBuyer && order.status === 'delivered' && (
                    <Button
                      size="sm"
                      className="flex-1 text-xs h-8 bg-emerald-500 hover:bg-emerald-600"
                      disabled={confirmingId === order.id}
                      onClick={() => handleConfirmDelivery(order.id)}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Confirm Receipt
                    </Button>
                  )}

                  {/* Seller: Mark as delivered */}
                  {isSeller && order.status === 'paid' && (
                    <Button
                      size="sm"
                      className="flex-1 text-xs h-8"
                      disabled={confirmingId === order.id}
                      onClick={() => handleMarkDelivered(order.id)}
                    >
                      <Package className="w-3 h-3 mr-1" />
                      Mark Delivered
                    </Button>
                  )}

                  {/* Cancel (before delivery) */}
                  {(order.status === 'pending' || order.status === 'paid') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 text-red-500"
                      onClick={() => handleCancel(order.id)}
                    >
                      Cancel
                    </Button>
                  )}

                  {/* Completed: Leave review */}
                  {order.status === 'completed' && (
                    <Button variant="outline" size="sm" className="flex-1 text-xs h-8">
                      <Star className="w-3 h-3 mr-1" />
                      Leave Review
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
