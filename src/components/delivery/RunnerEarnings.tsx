'use client'

import { useState } from 'react'
import { TrendingUp, DollarSign, Star, Package, Clock, Wallet, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRunnerStore } from '@/store/runner-store'
import RunnerWithdrawalForm from '@/components/delivery/RunnerWithdrawalForm'

export default function RunnerEarnings() {
  const earnings = useRunnerStore((s) => s.earnings)
  const totalCompleted = useRunnerStore((s) => s.totalCompleted)
  const runnerRating = useRunnerStore((s) => s.runnerRating)
  const [showWithdrawal, setShowWithdrawal] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)

  const avgEarningPerDelivery = earnings.totalDeliveries > 0 ? Math.round(earnings.week / earnings.totalDeliveries) : 0
  const availableBalance = earnings.month - earnings.pendingPayout

  // Success state after withdrawal
  if (withdrawSuccess) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Withdrawal Requested!</h3>
          <p className="text-sm text-muted-foreground">
            Your payout is being processed. You&apos;ll receive your funds within 1-2 business hours.
          </p>
        </div>
        <Button
          className="w-full"
          variant="outline"
          onClick={() => { setWithdrawSuccess(false); setShowWithdrawal(false) }}
        >
          Back to Earnings
        </Button>
      </div>
    )
  }

  // Withdrawal form
  if (showWithdrawal) {
    return (
      <RunnerWithdrawalForm
        onBack={() => setShowWithdrawal(false)}
        onSuccess={() => setWithdrawSuccess(true)}
      />
    )
  }

  // Default earnings view
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-800 dark:to-emerald-950 text-white border-0">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              <span className="text-sm font-medium opacity-90">Total Earnings</span>
            </div>
            <Badge className="bg-white/20 text-white border-0 rounded-full text-[10px]">This Month</Badge>
          </div>
          <p className="text-4xl font-bold mb-1">₦{earnings.month.toLocaleString()}</p>
          <p className="text-sm opacity-80">{earnings.totalDeliveries} deliveries completed</p>

          {/* Withdraw button */}
          {availableBalance >= 1000 && (
            <Button
              onClick={() => setShowWithdrawal(true)}
              className="w-full mt-4 bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm h-10 font-semibold"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Withdraw Funds
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs text-muted-foreground">Today</span>
            </div>
            <p className="text-xl font-bold">₦{earnings.today.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs text-muted-foreground">This Week</span>
            </div>
            <p className="text-xl font-bold">₦{earnings.week.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-xs text-muted-foreground">Rating</span>
            </div>
            <p className="text-xl font-bold">{runnerRating > 0 ? runnerRating.toFixed(1) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-xs text-muted-foreground">Deliveries</span>
            </div>
            <p className="text-xl font-bold">{totalCompleted}</p>
          </CardContent>
        </Card>
      </div>

      {avgEarningPerDelivery > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg. per Delivery</p>
                <p className="text-lg font-bold">₦{avgEarningPerDelivery.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Platform Fee (12%)</p>
                <p className="text-sm font-medium text-muted-foreground">Already deducted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {earnings.pendingPayout > 0 && (
        <Card className="border-2 border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Payout</p>
                <p className="text-2xl font-bold text-emerald-600">₦{earnings.pendingPayout.toLocaleString()}</p>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                <Clock className="w-3 h-3 mr-1" />Processing
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available balance card with withdraw option */}
      <Card className="border-2 border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Available for Withdrawal</p>
              <p className="text-2xl font-bold">₦{availableBalance.toLocaleString()}</p>
              {availableBalance < 1000 && availableBalance > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">Min. ₦1,000 to withdraw</p>
              )}
            </div>
            {availableBalance >= 1000 ? (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setShowWithdrawal(true)}
              >
                <Wallet className="w-3.5 h-3.5 mr-1" />
                Withdraw
              </Button>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                <Clock className="w-3 h-3 mr-1" />
                {availableBalance === 0 ? 'No balance' : 'Below minimum'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {earnings.totalDeliveries === 0 && (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No earnings yet</p>
          <p className="text-xs text-muted-foreground">Complete your first delivery to start earning!</p>
        </div>
      )}
    </div>
  )
}
