'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCcw, Search, Radio, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CampusMap, { type RunnerLocation } from '@/components/map/CampusMap';
import CategoryChips from './CategoryChips';
import RequestCard from './RequestCard';
import { Task, User as UserType, RunnerApplication } from '@/lib/types';
import { formatLiveSyncLabel, sortMarketplaceTasks, type MarketplaceSortMode } from './task-utils';

interface CustomerDashboardProps {
  user: UserType;
  tasks: Task[];
  myRequests: Task[];
  marketplaceTasks: Task[];
  runnerLocations: RunnerLocation[];
  lastSyncedAt: Date | null;
  liveActivityCount: number;
  refreshingMarketplace: boolean;
  currentApplication: RunnerApplication | null;
  categoryFilter: string;
  marketplaceSort: MarketplaceSortMode;
  loading: boolean;
  onCreateRequest: () => void;
  onSelectTask: (taskId: string) => void;
  onRefresh: () => void;
  onCategoryFilter: (category: string) => void;
  onSortChange: (mode: MarketplaceSortMode) => void;
  onBecomeRunner: () => void;
  onViewIntro: () => void;
  onShowLiveMap: () => void;
}

export default function CustomerDashboard({
  user,
  myRequests,
  marketplaceTasks,
  runnerLocations,
  lastSyncedAt,
  liveActivityCount,
  refreshingMarketplace,
  currentApplication,
  categoryFilter,
  marketplaceSort,
  loading,
  onCreateRequest,
  onSelectTask,
  onRefresh,
  onCategoryFilter,
  onSortChange,
  onBecomeRunner,
  onViewIntro,
  onShowLiveMap,
}: CustomerDashboardProps) {
  const [searchValue, setSearchValue] = useState('');
  const sortedTasks = useMemo(() => sortMarketplaceTasks(marketplaceTasks, marketplaceSort), [marketplaceTasks, marketplaceSort]);
  const isApprovedRunner = user.isRunner || currentApplication?.status === 'approved';

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 safe-top bg-background/95 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em]">
                  Runner
                </Badge>
                {isApprovedRunner && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-300/40 rounded-full text-[10px]">
                    Approved Runner
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <h1 className="font-bold text-xl">Requests</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-500" /> Live
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{formatLiveSyncLabel(lastSyncedAt)}</span>
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
              {!isApprovedRunner && (
                <Button size="sm" variant="outline" onClick={onBecomeRunner} className="h-9 gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Deliver
                </Button>
              )}
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
            showUserLocation={false}
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none">
            <Badge className="bg-background/90 text-foreground rounded-full text-[10px] backdrop-blur-sm">
              <MapPin className="w-3 h-3 mr-1" />
              {runnerLocations.length} runner{runnerLocations.length !== 1 ? 's' : ''} on campus
            </Badge>
          </div>
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Badge className="bg-background/90 rounded-full px-4 py-2 text-xs backdrop-blur-sm">
              Tap to expand map
            </Badge>
          </div>
        </button>

        {/* Live activity */}
        {liveActivityCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex justify-center"
          >
            <Badge className="rounded-full px-4 py-1.5 bg-emerald-100 text-emerald-700 text-xs">
              +{liveActivityCount} new offer{liveActivityCount !== 1 ? 's' : ''}
            </Badge>
          </motion.div>
        )}

        {/* Stats pills */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Open requests', value: marketplaceTasks.length },
            { label: 'Your posts', value: myRequests.length },
            { label: 'Runners online', value: runnerLocations.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search + sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search requests..."
              className="pl-9 h-10 rounded-xl text-sm"
            />
          </div>
          <Select value={marketplaceSort} onValueChange={(v) => onSortChange(v as MarketplaceSortMode)}>
            <SelectTrigger className="w-[130px] h-10 rounded-xl text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="live">Latest</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="best_budget">Best budget</SelectItem>
              <SelectItem value="highest_budget">Highest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category chips */}
        <CategoryChips selected={categoryFilter} onSelect={onCategoryFilter} />

        {/* Your recent requests */}
        {myRequests.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-semibold text-sm">Your requests</h3>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {myRequests.slice(0, 4).map((task) => (
                <RequestCard key={task.id} task={task} onClick={() => onSelectTask(task.id)} />
              ))}
            </div>
          </section>
        )}

        {/* Marketplace */}
        <section className="space-y-2">
          <h3 className="font-semibold text-sm">Open requests from campus</h3>
          {loading ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No open requests</p>
              <p className="text-sm">Be the first to post a runner request on campus.</p>
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

      {/* FAB — Post request */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onCreateRequest}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
