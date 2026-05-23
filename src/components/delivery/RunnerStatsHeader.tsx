'use client'

import { Star, CheckCircle2, MapPin } from 'lucide-react'
import { useRunnerStore } from '@/store/runner-store'

export default function RunnerStatsHeader() {
  const totalCompleted = useRunnerStore((s) => s.totalCompleted)
  const runnerRating = useRunnerStore((s) => s.runnerRating)
  const earnings = useRunnerStore((s) => s.earnings)

  const stats = [
    { label: 'Completed', value: totalCompleted, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Rating', value: runnerRating > 0 ? runnerRating.toFixed(1) : '—', icon: Star, color: 'text-amber-500' },
    { label: 'Today', value: earnings.today > 0 ? `N${earnings.today.toLocaleString()}` : 'N0', icon: MapPin, color: 'text-primary' },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-muted/50 rounded-xl p-3 text-center">
          <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
          <p className="text-lg font-bold">{stat.value}</p>
          <p className="text-[10px] text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}
