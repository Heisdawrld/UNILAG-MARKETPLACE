'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Power, Wifi, WifiOff, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useRunnerStore } from '@/store/runner-store'

interface RunnerOnlineToggleProps { isConnected: boolean; onToggle: (online: boolean) => void }

export default function RunnerOnlineToggle({ isConnected, onToggle }: RunnerOnlineToggleProps) {
  const isOnline = useRunnerStore((s) => s.isOnline)
  const transportMode = useRunnerStore((s) => s.transportMode)
  const currentLat = useRunnerStore((s) => s.currentLat)
  const locationUpdatedAt = useRunnerStore((s) => s.locationUpdatedAt)
  const gpsActive = isOnline && currentLat !== null

  return (
    <div className="space-y-3">
      <motion.div className={`rounded-2xl p-5 cursor-pointer transition-all select-none ${isOnline ? 'bg-emerald-500/10 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/5' : 'bg-muted/40 border-2 border-transparent'}`} onClick={() => onToggle(!isOnline)} whileTap={{ scale: 0.97 }} layout>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <motion.div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`} animate={isOnline ? { scale: [1, 1.05, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }}>
                <Power className={`w-5 h-5 ${isOnline ? 'text-white' : 'text-muted-foreground'}`} />
              </motion.div>
              {isOnline && <motion.div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-background" animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} />}
            </div>
            <div>
              <p className={`font-bold text-base ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>{isOnline ? "You're Online" : 'Go Online'}</p>
              <p className="text-xs text-muted-foreground">{isOnline ? `Receiving ${transportMode} delivery requests` : 'Toggle to start receiving delivery requests'}</p>
            </div>
          </div>
          <div className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${isOnline ? 'bg-emerald-500 justify-end' : 'bg-muted-foreground/20 justify-start'}`}>
            <motion.div className="w-6 h-6 bg-white rounded-full shadow-md" layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
          </div>
        </div>
        <AnimatePresence>
          {isOnline && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-emerald-500/20">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">{isConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-red-500" />}<span className="text-[10px] text-muted-foreground">{isConnected ? 'Connected' : 'Reconnecting...'}</span></div>
                <div className="flex items-center gap-1.5"><Radio className={`w-3.5 h-3.5 ${gpsActive ? 'text-emerald-500' : 'text-amber-500'}`} /><span className="text-[10px] text-muted-foreground">{gpsActive ? 'GPS Active' : 'Waiting for GPS...'}</span></div>
                {locationUpdatedAt && <span className="text-[10px] text-muted-foreground ml-auto">Updated {Math.round((Date.now() - locationUpdatedAt) / 1000)}s ago</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
