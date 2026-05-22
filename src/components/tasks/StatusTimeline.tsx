'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Footprints, Hand, Bike, MapPin, Award } from 'lucide-react';

interface StatusTimelineProps {
  currentStatus: string;
}

const STEPS = [
  { key: 'open', label: 'Created', icon: Plus },
  { key: 'matched', label: 'Matched', icon: Users },
  { key: 'runner_heading_to_pickup', label: 'Heading', icon: Footprints },
  { key: 'picked_up', label: 'Picked Up', icon: Hand },
  { key: 'delivering', label: 'Delivery', icon: Bike },
  { key: 'arrived', label: 'Arrived', icon: MapPin },
  { key: 'completed', label: 'Done', icon: Award },
];

const STATUS_ORDER = STEPS.map((s) => s.key);

export default function StatusTimeline({ currentStatus }: StatusTimelineProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="w-full">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Delivery progress</p>
      <div className="flex items-start justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = index <= activeIndex && activeIndex > 0;
          const isCurrent = index === activeIndex;
          const isFuture = index > activeIndex;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 min-w-0">
              {/* Connecting line (left side) */}
              {index > 0 && (
                <div className="w-full absolute left-0 right-1/2 top-[14px] h-0.5 -z-10" style={{ display: 'none' }} />
              )}
              <div className="relative flex items-center w-full">
                {index > 0 && (
                  <div className="absolute right-1/2 left-0 h-0.5 -translate-y-1/2 top-[14px]">
                    <div
                      className={`h-full transition-colors ${
                        isCompleted || isCurrent ? 'bg-emerald-500' : 'bg-muted-foreground/20'
                      }`}
                    />
                  </div>
                )}
                {index < STEPS.length - 1 && (
                  <div className="absolute left-1/2 right-0 h-0.5 -translate-y-1/2 top-[14px]">
                    <div
                      className={`h-full transition-colors ${
                        isCompleted ? 'bg-emerald-500' : 'bg-muted-foreground/20'
                      }`}
                      style={isCurrent ? { background: 'linear-gradient(to right, #10b981 50%, transparent 50%)' } : undefined}
                    />
                  </div>
                )}

                {/* Dot */}
                <motion.div
                  animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mx-auto ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <step.icon className="w-3.5 h-3.5" />
                </motion.div>
              </div>

              {/* Label */}
              <span
                className={`text-[9px] mt-1.5 text-center font-medium whitespace-nowrap ${
                  isCompleted || isCurrent ? 'text-foreground' : 'text-muted-foreground/50'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
