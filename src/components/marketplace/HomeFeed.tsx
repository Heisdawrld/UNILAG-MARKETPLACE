'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, Clock, Eye, Award, RefreshCw, Star, Bell } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { User as UserType, Listing } from '@/lib/types';
import { getInitials } from '@/lib/marketplace-utils';
import { ListingCard, ListingCardSkeleton } from './ListingCard';

export default function HomeFeed({
  user, onSelectListing, onToggleSave, savedIds,
}: {
  user: UserType; onSelectListing: (id: string) => void; onToggleSave: (id: string) => void; savedIds: Set<string>;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchListings = useCallback(async () => {
    try {
      const data = await api.get('/api/listings?status=active&limit=20&sort=newest');
      setListings(data.listings || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const boosted = useMemo(() => listings.filter(l => l.boosted), [listings]);
  const recent = useMemo(() => listings.slice(0, 10), [listings]);
  const popular = useMemo(() => [...listings].sort((a, b) => b.views - a.views).slice(0, 6), [listings]);

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
          <button onClick={() => { setRefreshing(true); fetchListings(); }} className="p-2 rounded-full hover:bg-muted">
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-8 py-4">
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
