'use client';

import React, { useState, useEffect } from 'react';
import { Settings, LogOut, Star, Shield, Edit3, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { User as UserType, Listing } from '@/lib/types';
import { getInitials } from '@/lib/marketplace-utils';
import { ListingCard } from './ListingCard';

export default function ProfileView({
  user, setUser, onSelectListing, savedIds, onToggleSave,
}: {
  user: UserType; setUser: (u: UserType) => void; onSelectListing: (id: string) => void; savedIds: Set<string>; onToggleSave: (id: string) => void;
}) {
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/listings?sellerId=${user.id}&limit=50`).then(data => setMyListings(data.listings || [])).catch(console.error).finally(() => setLoading(false));
  }, [user.id]);

  const activeCount = myListings.filter(l => l.status === 'active').length;
  const soldCount = myListings.filter(l => l.status === 'sold').length;

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 py-3">
        <h1 className="font-bold text-lg">Profile</h1>
      </div>
      <div className="p-4 space-y-4">
        {/* Profile Header */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user.avatar || undefined} />
                <AvatarFallback className="text-lg">{getInitials(user.username)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-bold text-lg">{user.username}</h2>
                  {user.verificationStatus === 'unilag_verified' && <Shield className="w-4 h-4 text-emerald-500" />}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.bio && <p className="text-xs text-muted-foreground mt-1">{user.bio}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium">{user.ratingAverage.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">({user.totalReviews})</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Trust: {user.trustScore}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{soldCount}</p>
            <p className="text-[10px] text-muted-foreground">Sold</p>
          </CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{user.totalReviews}</p>
            <p className="text-[10px] text-muted-foreground">Reviews</p>
          </CardContent></Card>
        </div>

        {/* My Listings */}
        <div>
          <h3 className="font-bold text-sm mb-3">My Listings</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : myListings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No listings yet</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {myListings.filter(l => l.status === 'active').map(listing => (
                <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
