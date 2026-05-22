'use client';

import React from 'react';
import { ArrowLeft, Radio, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CampusMap, { type RunnerLocation } from '@/components/map/CampusMap';

interface LiveMapViewProps {
  runnerLocations: RunnerLocation[];
  onClose: () => void;
}

export default function LiveMapView({ runnerLocations, onClose }: LiveMapViewProps) {
  const availableCount = runnerLocations.filter((r) => r.runnerAvailabilityStatus === 'available').length;
  const busyCount = runnerLocations.filter((r) => r.runnerAvailabilityStatus === 'busy').length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="sticky top-0 z-30 safe-top bg-background/95 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">Live Campus Map</h1>
            <p className="text-xs text-muted-foreground">
              {runnerLocations.length} runner{runnerLocations.length !== 1 ? 's' : ''} on campus
              {availableCount > 0 && ` · ${availableCount} available`}
              {busyCount > 0 && ` · ${busyCount} busy`}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="rounded-full flex items-center gap-1">
          <Radio className="w-3 h-3 text-emerald-500 animate-pulse" /> Live
        </Badge>
      </div>

      {/* Map */}
      <div className="flex-1">
        <CampusMap
          runners={runnerLocations}
          showUserLocation
          className="h-full w-full"
        />
      </div>

      {/* Legend overlay */}
      <div className="absolute bottom-20 left-3 z-10 flex flex-col gap-1.5">
        {[
          { color: 'bg-emerald-500', label: 'Available' },
          { color: 'bg-orange-500', label: 'Busy' },
          { color: 'bg-slate-400', label: 'Offline' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-[11px] font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Campus info overlay */}
      <div className="absolute top-20 left-3 z-10">
        <div className="bg-background/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">UNILAG Campus</span>
          </div>
        </div>
      </div>
    </div>
  );
}
