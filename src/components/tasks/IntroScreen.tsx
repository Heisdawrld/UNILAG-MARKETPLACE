'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Package, Sparkles, ShieldCheck } from 'lucide-react';
import CampusMap, { type RunnerLocation } from '@/components/map/CampusMap';
import { TASK_CATEGORIES } from '@/lib/types';

interface IntroScreenProps {
  onCustomerEntry: () => void;
  onRunnerEntry: () => void;
  onCategorySelect?: (category: string) => void;
  runnerLocations: RunnerLocation[];
}

const CATEGORY_ICONS: Record<string, string> = {
  Delivery: '📦',
  'Food Pickup': '🍔',
  Printing: '🖨️',
  Tutoring: '📚',
  Shopping: '🛍️',
  'Queue Holding': '⏳',
  Cleaning: '✨',
  'Moving Help': '📦',
  Miscellaneous: '📋',
};

export default function IntroScreen({ onCustomerEntry, onRunnerEntry, onCategorySelect, runnerLocations }: IntroScreenProps) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      {/* Map background */}
      <div className="absolute inset-0">
        <CampusMap
          runners={runnerLocations}
          showUserLocation={false}
          interactive={false}
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/50 to-background/95" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-between min-h-[calc(100vh-4rem)] px-4 pt-8 pb-6">
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Glass card */}
          <div className="backdrop-blur-xl bg-background/70 rounded-[2rem] border shadow-2xl p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Campus Runner</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Student delivery,{' '}
                <span className="text-primary">campus speed</span>
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Get anything delivered across UNILAG — food, documents, laundry. Post a request or become a runner.
              </p>
            </div>

            {/* Feature bullets */}
            <div className="space-y-2.5">
              {[
                { icon: Package, text: 'Deliver anything on campus, fast' },
                { icon: Sparkles, text: 'Real-time runner tracking on live map' },
                { icon: ShieldCheck, text: 'Verified student runners & fair pricing' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-3 pt-1">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCustomerEntry}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
              >
                Post a Request
                <ChevronRight className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onRunnerEntry}
                className="w-full h-14 rounded-2xl border-2 font-bold text-base flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors"
              >
                Become a Runner
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Category chips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md mt-6"
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center mb-3">
            Popular requests
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {TASK_CATEGORIES.slice(0, 6).map((category) => (
              <button
                key={category}
                onClick={() => {
                  onCustomerEntry();
                  onCategorySelect?.(category);
                }}
                className="px-4 py-2 rounded-full bg-background/60 backdrop-blur-sm border text-sm font-medium hover:bg-primary/10 hover:border-primary/30 transition-colors"
              >
                {CATEGORY_ICONS[category] || '📋'} {category}
              </button>
            ))}
          </div>

          {/* Runner count badge */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            {runnerLocations.length > 0
              ? `${runnerLocations.length} runner${runnerLocations.length !== 1 ? 's' : ''} active on campus now`
              : 'Runners come online throughout the day'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
