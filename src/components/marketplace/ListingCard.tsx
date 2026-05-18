'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Zap, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Listing, CONDITION_LABELS, CONDITION_COLORS } from '@/lib/types';
import { formatPrice, getInitials, getListingDisplayAvatar, getListingDisplayName, getListingFirstImage, isListingDisplayVerified } from '@/lib/marketplace-utils';

export function ListingCard({
  listing, onClick, isSaved, onToggleSave,
}: {
  listing: Listing; onClick: () => void; isSaved: boolean; onToggleSave: () => void;
}) {
  const image = getListingFirstImage(listing.images, listing.category);
  const conditionClass = CONDITION_COLORS[listing.condition] || CONDITION_COLORS.fairly_used;
  const displayName = getListingDisplayName(listing);
  const displayAvatar = getListingDisplayAvatar(listing);
  const isVerifiedDisplay = isListingDisplayVerified(listing);

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={onClick}>
      <Card className={`overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow h-full ${listing.boosted ? 'ring-1 ring-amber-400/40' : ''}`}>
        <div className="relative aspect-[4/3] bg-muted">
          <img src={image} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
          {listing.boosted && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] px-1.5 py-0.5 shadow-sm">
              <Zap className="w-2.5 h-2.5 mr-0.5 fill-current" /> Featured
            </Badge>
          )}
          <Badge className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 ${conditionClass}`}>
            {CONDITION_LABELS[listing.condition] || listing.condition}
          </Badge>
          {listing.negotiable && (
            <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 bg-white/90 dark:bg-black/70">
              Negotiable
            </Badge>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
            className="absolute bottom-2 right-2 p-1.5 rounded-full bg-white/90 dark:bg-black/70 hover:bg-white transition-colors"
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
          </button>
        </div>
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm line-clamp-2 leading-tight mb-1">{listing.title}</h3>
          <p className="text-primary font-bold text-base mb-1.5">{formatPrice(listing.price)}</p>
          <div className="flex items-center gap-1.5">
            <Avatar className="w-5 h-5">
              <AvatarImage src={displayAvatar} />
              <AvatarFallback className="text-[8px]">{getInitials(displayName)}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{displayName}</span>
            {isVerifiedDisplay && (
              <Shield className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ListingCardSkeleton() {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <Skeleton className="aspect-[4/3] w-full" />
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </CardContent>
    </Card>
  );
}
