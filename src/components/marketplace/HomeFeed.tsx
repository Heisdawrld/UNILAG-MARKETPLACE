'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, Clock, Eye, Award, RefreshCw, Star, Bell, Smartphone, Laptop, BookOpen, ShoppingBag, Utensils, Dumbbell, Home as HomeIcon, Wrench, LayoutGrid } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { User as UserType, Listing, Notification } from '@/lib/types';
import { getInitials } from '@/lib/marketplace-utils';
import { ListingCard, ListingCardSkeleton } from './ListingCard';

const CATEGORY_ICONS: Record<string, typeof Smartphone> = {
  'Electronics': Smartphone,
  'Phones & Tablets': Smartphone,
  'Laptops': Laptop,
  'Textbooks': BookOpen,
  'Fashion': ShoppingBag,
  'Services': Wrench,
  'Hostel Essentials': HomeIcon,
  'Food & Drinks': Utensils,
  'Sports': Dumbbell,
  'Others': LayoutGrid,
};

export default function HomeFeed({
  user, onSelectListing, onToggleSave, savedIds,
}: {
  user: UserType; onSelectListing: (id: string) => void; onToggleSave: (id: string) => void; savedIds: Set<string>;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const fetchListings = useCallback(async () => {
    try {
      const data = await api.get('/api/listings?status=active&limit=20&sort=newest');
      setListings(data.listings || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // Fetch notifications
  useEffect(() => {
    api.get(`/api/notifications?userId=${user.id}`)
      .then((data: any) => setNotifications(Array.isArray(data) ? data : data?.notifications || []))
      .catch(() => setNotifications([]));
  }, [user.id]);

  const unreadCount = useMemo(() => (notifications || []).filter(n => !n.read).length, [notifications]);
  const boosted = useMemo(() => listings.filter(l => l.boosted), [listings]);
  const recent = useMemo(() => listings.slice(0, 10), [listings]);
  const popular = useMemo(() => [...listings].sort((a, b) => b.views - a.views).slice(0, 6), [listings]);

  const categories = Object.entries(CATEGORY_ICONS);

  if (loading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="UNILAG" className="w-8 h-8 rounded-lg object-cover" />
            <div>
              <h1 className="font-bold text-lg leading-tight">UNILAG Market</h1>
              <p className="text-[10px] text-muted-foreground">Campus Marketplace</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-full hover:bg-muted">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => { setRefreshing(true); fetchListings(); }} className="p-2 rounded-full hover:bg-muted">
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Dropdown */}
      {showNotifs && (
        <div className="mx-4 mt-2 bg-card border rounded-xl shadow-lg overflow-hidden z-40 relative">
          <div className="p-3 border-b flex items-center justify-between">
            <p className="font-semibold text-sm">Notifications</p>
            {unreadCount > 0 && <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No notifications yet</p>
            ) : (
              notifications.slice(0, 10).map(notif => (
                <div key={notif.id} className={`p-3 border-b last:border-0 text-left ${!notif.read ? 'bg-primary/5' : ''}`}>
                  <p className="text-xs font-medium">{notif.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{notif.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="px-4 space-y-6 py-4">
        {/* Categories */}
        <section>
          <h2 className="font-bold text-sm mb-3">Browse Categories</h2>
          <div className="grid grid-cols-5 gap-2">
            {categories.map(([name, Icon]) => (
              <button key={name} onClick={() => onSelectListing(`cat:${name}`)} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted/80 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[9px] text-center leading-tight font-medium text-muted-foreground">{name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Trending */}
        {boosted.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-lg">Trending 🔥</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              {boosted.map(listing => (
                <div key={listing.id} className="flex-shrink-0 w-44">
                  <ListingCard listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fresh Listings */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Fresh Listings</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {recent.map(listing => (
              <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
            ))}
          </div>
        </section>

        {/* Most Viewed */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-lg">Most Viewed</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {popular.map(listing => (
              <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
            ))}
          </div>
        </section>

        {/* Top Sellers */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-emerald-500" />
            <h2 className="font-bold text-lg">Top Sellers</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {Array.from(new Map(listings.map(l => [l.seller.id, l.seller])).values())
              .filter(s => s.verificationStatus === 'unilag_verified')
              .slice(0, 5)
              .map(seller => (
                <div key={seller.id} className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border shadow-sm w-20">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={seller.avatar || undefined} />
                    <AvatarFallback>{getInitials(seller.username)}</AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] font-medium text-center truncate w-full">{seller.username.replace('_', ' ')}</span>
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-[10px]">{seller.ratingAverage.toFixed(1)}</span>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
