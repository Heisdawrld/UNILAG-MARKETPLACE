'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const UNILAG_CENTER: [number, number] = [6.5154, 3.3915];
const UNILAG_BOUNDS: L.LatLngBoundsLiteral = [
  [6.496, 3.372],
  [6.535, 3.417],
];

const CAMPUS_POINTS: { id: string; label: string; lat: number; lng: number }[] = [
  { id: 'main-gate', label: 'Main Gate', lat: 6.5153, lng: 3.3901 },
  { id: 'jaja', label: 'Jaja Hall', lat: 6.5168, lng: 3.3965 },
  { id: 'moremi', label: 'Moremi Hall', lat: 6.521, lng: 3.3909 },
  { id: 'new-hall', label: 'New Hall', lat: 6.5202, lng: 3.3978 },
  { id: 'unilag-medical', label: 'Medical Centre', lat: 6.5185, lng: 3.3862 },
  { id: 'unilag-lagoon-front', label: 'Lagoon Front', lat: 6.5132, lng: 3.4039 },
  { id: 'unilag-sports-centre', label: 'Sports Centre', lat: 6.5222, lng: 3.3941 },
  { id: 'faculty-of-arts', label: 'Faculty of Arts', lat: 6.5171, lng: 3.3941 },
];

export interface RunnerLocation {
  id: string;
  username: string;
  avatar: string | null;
  runnerCurrentLat: number;
  runnerCurrentLng: number;
  runnerLocationUpdatedAt: string;
  runnerAvailabilityStatus: string;
  runnerRating: number;
}

interface CampusMapProps {
  runners?: RunnerLocation[];
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  userLat?: number | null;
  userLng?: number | null;
  selectedRunnerId?: string | null;
  onRunnerSelect?: (runnerId: string) => void;
  className?: string;
  showUserLocation?: boolean;
  interactive?: boolean;
}

export default function CampusMap({
  runners = [],
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  userLat,
  userLng,
  selectedRunnerId,
  onRunnerSelect,
  className = '',
  showUserLocation = true,
  interactive = true,
}: CampusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: UNILAG_CENTER,
      zoom: 15,
      maxBounds: UNILAG_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: interactive,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    // Add campus landmark markers
    CAMPUS_POINTS.forEach((point) => {
      const icon = L.divIcon({
        className: 'campus-landmark-marker',
        html: `<div style="width:8px;height:8px;background:#6366f1;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      });
      L.marker([point.lat, point.lng], { icon, interactive: true })
        .bindTooltip(point.label, { direction: 'top', offset: [0, -6] })
        .addTo(map);
    });

    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [interactive]);

  // Update runner markers
  useEffect(() => {
    if (!markersLayerRef.current || !mapReady) return;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    runners.forEach((runner) => {
      const isSelected = runner.id === selectedRunnerId;
      const isAvailable = runner.runnerAvailabilityStatus === 'available';
      const color = isAvailable ? '#22c55e' : runner.runnerAvailabilityStatus === 'busy' ? '#f97316' : '#94a3b8';

      const icon = L.divIcon({
        className: 'runner-marker',
        html: `
          <div style="
            width: ${isSelected ? '40px' : '32px'};
            height: ${isSelected ? '40px' : '32px'};
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            color: white;
            transition: all 0.2s ease;
          ">
            ${runner.avatar ? `<img src="${runner.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />` : runner.username.charAt(0).toUpperCase()}
          </div>
        `,
        iconSize: [isSelected ? 40 : 32, isSelected ? 40 : 32],
        iconAnchor: [isSelected ? 20 : 16, isSelected ? 20 : 16],
      });

      const marker = L.marker([runner.runnerCurrentLat, runner.runnerCurrentLng], { icon });
      marker.bindTooltip(
        `<div style="text-align:center">
          <strong>${runner.username}</strong><br/>
          <span style="font-size:11px">${runner.runnerAvailabilityStatus} &middot; ${runner.runnerRating.toFixed(1)}</span><br/>
          <span style="font-size:10px;color:#666">${new Date(runner.runnerLocationUpdatedAt).toLocaleTimeString()}</span>
        </div>`,
        { direction: 'top', offset: [0, -20] }
      );

      if (onRunnerSelect) {
        marker.on('click', () => onRunnerSelect(runner.id));
      }

      layer.addLayer(marker);
    });
  }, [runners, selectedRunnerId, onRunnerSelect, mapReady]);

  // Update route line
  useEffect(() => {
    if (!routeLayerRef.current || !mapReady) return;
    const layer = routeLayerRef.current;
    layer.clearLayers();

    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const pickupIcon = L.divIcon({
        className: 'pickup-marker',
        html: `<div style="width:14px;height:14px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const dropoffIcon = L.divIcon({
        className: 'dropoff-marker',
        html: `<div style="width:14px;height:14px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([pickupLat, pickupLng], { icon: pickupIcon })
        .bindTooltip('Pickup', { direction: 'top' })
        .addTo(layer);
      L.marker([dropoffLat, dropoffLng], { icon: dropoffIcon })
        .bindTooltip('Dropoff', { direction: 'top' })
        .addTo(layer);

      L.polyline(
        [[pickupLat, pickupLng], [dropoffLat, dropoffLng]],
        {
          color: '#6366f1',
          weight: 3,
          dashArray: '8 4',
          opacity: 0.8,
        }
      ).addTo(layer);

      if (mapRef.current) {
        mapRef.current.fitBounds(
          [[pickupLat, pickupLng], [dropoffLat, dropoffLng]],
          { padding: [60, 60], maxZoom: 17 }
        );
      }
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, mapReady]);

  // User location marker
  useEffect(() => {
    if (!mapRef.current || !showUserLocation) return;

    if (userLat && userLng) {
      if (!userMarkerRef.current) {
        const icon = L.divIcon({
          className: 'user-location-marker',
          html: `
            <div style="
              width: 16px;
              height: 16px;
              background: #3b82f6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 0 4px rgba(59,130,246,0.3), 0 2px 6px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        userMarkerRef.current = L.marker([userLat, userLng], { icon })
          .bindTooltip('You', { direction: 'top' })
          .addTo(mapRef.current);
      } else {
        userMarkerRef.current.setLatLng([userLat, userLng]);
      }
    }

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [userLat, userLng, showUserLocation]);

  // Browser geolocation
  useEffect(() => {
    if (!mapRef.current || !showUserLocation || interactive) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!userMarkerRef.current) {
          const icon = L.divIcon({
            className: 'user-location-marker',
            html: `
              <div style="
                width: 16px;
                height: 16px;
                background: #3b82f6;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 0 0 4px rgba(59,130,246,0.3), 0 2px 6px rgba(0,0,0,0.3);
              "></div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          userMarkerRef.current = L.marker([latitude, longitude], { icon })
            .bindTooltip('You', { direction: 'top' })
            .addTo(mapRef.current!);
        } else {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000 }
    );

    return () => {
      navigator.geolocation && watchId && navigator.geolocation.clearWatch(watchId);
    };
  }, [showUserLocation, interactive]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full rounded-2xl overflow-hidden" style={{ minHeight: '280px' }} />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-2xl">
          <span className="text-sm text-muted-foreground">Loading map...</span>
        </div>
      )}
    </div>
  );
}
