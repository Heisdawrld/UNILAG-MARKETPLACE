'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { User as UserType, Listing, CATEGORIES } from '@/lib/types';
import { formatPrice } from '@/lib/marketplace-utils';
import { ListingCard, ListingCardSkeleton } from './ListingCard';
import { AnimatePresence, motion } from 'framer-motion';

export default function SearchView({
  user, onSelectListing, onToggleSave, savedIds, initialCategory = '',
}: {
  user: UserType; onSelectListing: (id: string) => void; onToggleSave: (id: string) => void; savedIds: Set<string>; initialCategory?: string;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState('newest');
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [negotiable, setNegotiable] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 600000]);
  const debounceRef = useRef<NodeJS.Timeout>();

  const doSearch = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ status: 'active', sort: sortBy, limit: '30' });
      if (term) p.set('search', term);
      if (category) p.set('category', category);
      if (negotiable) p.set('negotiable', 'true');
      p.set('minPrice', String(priceRange[0]));
      p.set('maxPrice', String(priceRange[1]));
      const data = await api.get(`/api/listings?${p}`);
      setResults(data.listings || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [category, sortBy, negotiable, priceRange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, doSearch]);

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 bg-muted/50" />
          </div>
          <Button variant={showFilters ? 'default' : 'outline'} size="icon" onClick={() => setShowFilters(!showFilters)} className="h-10 w-10">
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <Badge variant={category === '' ? 'default' : 'outline'} className="cursor-pointer flex-shrink-0" onClick={() => setCategory('')}>All</Badge>
          {CATEGORIES.map(cat => (
            <Badge key={cat} variant={category === cat ? 'default' : 'outline'} className="cursor-pointer flex-shrink-0 whitespace-nowrap" onClick={() => setCategory(category === cat ? '' : cat)}>{cat}</Badge>
          ))}
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs mb-1 block">Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="price_low">Price: Low→High</SelectItem>
                      <SelectItem value="price_high">Price: High→Low</SelectItem>
                      <SelectItem value="popular">Most Popular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Price: {formatPrice(priceRange[0])} — {formatPrice(priceRange[1])}</Label>
                  <Slider value={priceRange} onValueChange={v => setPriceRange(v as [number, number])} min={0} max={600000} step={5000} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Negotiable Only</Label>
                  <Switch checked={negotiable} onCheckedChange={setNegotiable} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="px-4 pb-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
            {Array.from({ length: 6 }).map((_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No listings found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">{results.length} result{results.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {results.map(listing => (
                <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
