'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, Radio, MapPin, Star, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import CampusMap, { type RunnerLocation } from '@/components/map/CampusMap';
import CategoryChips from './CategoryChips';
import RequestCard from './RequestCard';
import { Task, User as UserType } from '@/lib/types';
import { formatLiveSyncLabel, sortMarketplaceTasks, type MarketplaceSortMode } from './task-utils';

interface RunnerDashboardProps {
  user: UserType;
  marketplaceTasks: Task[];
  runnerLocations: RunnerLocation[];
  lastSyncedAt: Date | null;
  liveActivityCount: number;
  refreshingMarketplace: boolean;
  isAvailable: boolean;
  categoryFilter: string;
  marketplaceSort: MarketplaceSortMode;
  loading: boolean;
  onToggleAvailability: (available: boolean) => void;
  onSelectTask: (taskId: string) => void;
  onRefresh: () => void;
  onCategoryFilter: (category: string) => void;
  onSortChange: (mode: MarketplaceSortMode) => void;
  onViewIntro: () => void;
  onShowLiveMap: () => void;
}

export default function RunnerDashboard({
  user,
  marketplaceTasks,
  runnerLocations,
  lastSyncedAt,
  liveActivityCount,
  refreshingMarketplace,
  isAvailable,
  categoryFilter,
  marketplaceSort,
  loading,
  onToggleAvailability,
  onSelectTask,
  onRefresh,
  onCategoryFilter,
  onSortChange,
  onViewIntro,
  onShowLiveMap,
}: RunnerDashboardProps) {
  const sortedTasks = useMemo(() => sortMarketplaceTasks(marketplaceTasks, marketplaceSort), [marketplaceTasks, marketplaceSort]);

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 safe-top bg-background/95 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] border-primary/30 text-primary">
                  Runner
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-300/40 rounded-full text-[10px]">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Approved
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <h1 className="font-bold text-xl">Dashboard</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] flex items-center gap-1">
                    <Radio className={`w-3 h-3 ${isAvailable ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    {formatLiveSyncLabel(lastSyncedAt)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={onRefresh} disabled={refreshingMarketplace} className="h-9 w-9 p-0">
                <RefreshCcw className={`w-4 h-4 ${refreshingMarketplace ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="sm" variant="outline" onClick={onShowLiveMap} className="h-9 gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Map
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-4 px-4 pt-4">
        {/* Compact map */}
        <button
          onClick={onShowLiveMap}
          className="w-full h-[180px] rounded-2xl overflow-hidden relative group cursor-pointer"
        >
          <CampusMap
            runners={runnerLocations}
            showUserLocation
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none">
            <Badge className="bg-background/90 text-foreground rounded-full text-[10px] backdrop-blur-sm">
              {marketplaceTasks.length} open request{marketplaceTasks.length !== 1 ? 's' : ''} nearby
            </Badge>
          </div>
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Badge className="bg-background/90 rounded-full px-4 py-2 text-xs backdrop-blur-sm">
              Tap to expand map
            </Badge>
          </div>
        </button>

        {/* Availability toggle */}
        <motion.div
          className={`rounded-2xl p-4 cursor-pointer transition-colors ${
            isAvailable
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-muted/40 border'
          }`}
          onClick={() => onToggleAvailability(!isAvailable)}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
              <div>
                <p className={`font-semibold text-sm ${isAvailable ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                  {isAvailable ? 'Available for requests' : 'Taking a break'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAvailable
                    ? 'You can receive new runner requests now'
                    : 'Toggle to go online and start receiving requests'}
                </p>
              </div>
            </div>
            <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-1 ${
              isAvailable ? 'bg-emerald-500 justify-end' : 'bg-muted-foreground/20 justify-start'
            }`}>
              <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Completed', value: user.tasksCompleted, icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'Rating', value: user.runnerRating.toFixed(1), icon: Star, color: 'text-amber-500' },
            { label: 'Open nearby', value: marketplaceTasks.length, icon: MapPin, color: 'text-primary' },
          ].map((stat) => (
            <div key={stat.label} className="bg-muted/50 rounded-xl p-3 text-center">
              <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Live activity */}
        {liveActivityCount > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex justify-center">
            <Badge className="rounded-full px-4 py-1.5 bg-emerald-100 text-emerald-700 text-xs">
              +{liveActivityCount} new request{liveActivityCount !== 1 ? 's' : ''}
            </Badge>
          </motion.div>
        )}

        {/* Category chips */}
        <CategoryChips selected={categoryFilter} onSelect={onCategoryFilter} />

        {/* Marketplace requests */}
        <section className="space-y-2">
          <h3 className="font-semibold text-sm">
            {marketplaceSort === 'urgent' ? 'Urgent requests' : 'Open requests nearby'}
          </h3>
          {loading ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No open requests yet</p>
              <p className="text-sm">Check back soon — students post requests throughout the day.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {sortedTasks.map((task) => (
                <RequestCard key={task.id} task={task} onClick={() => onSelectTask(task.id)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
