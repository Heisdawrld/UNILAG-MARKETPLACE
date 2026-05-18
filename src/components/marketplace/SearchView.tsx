'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, SlidersHorizontal, Store as StoreIcon, ShoppingBag, Star, Users, MapPin, Shield, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { User as UserType, Listing, Store, CATEGORIES, STORE_CATEGORIES } from '@/lib/types';
import { formatPrice } from '@/lib/marketplace-utils';
import { ListingCard, ListingCardSkeleton } from './ListingCard';
import { AnimatePresence, motion } from 'framer-motion';

type SearchTab = 'products' | 'stores';

function getStoreListingCount(store: Store) {
  return store._count?.listings ?? 0;
}

function getStoreFollowerCount(store: Store) {
  return store._count?.followers ?? store.followCount;
}

// ── Store Card ──
function StoreCard({ store, onClick }: { store: Store; onClick: () => void }) {
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden" onClick={onClick}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            {store.logo ? (
              <img src={store.logo} alt={store.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-amber-500/10 flex items-center justify-center flex-shrink-0">
                <StoreIcon className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-sm truncate">{store.name}</h3>
                {store.isVerified && <Shield className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
              </div>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 mt-0.5">{store.category}</Badge>
              {store.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{store.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <ShoppingBag className="w-3 h-3" /> {getStoreListingCount(store)} items
                </span>
                <span className="flex items-center gap-0.5">
                  <Users className="w-3 h-3" /> {getStoreFollowerCount(store)} followers
                </span>
                {store.rating > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {store.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Main Search View ──
export default function SearchView({
  user, onSelectListing, onToggleSave, savedIds, initialCategory = '',
}: {
  user: UserType; onSelectListing: (id: string) => void; onToggleSave: (id: string) => void; savedIds: Set<string>; initialCategory?: string;
}) {
  const [searchTab, setSearchTab] = useState<SearchTab>('products');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState('newest');
  const [results, setResults] = useState<Listing[]>([]);
  const [storeResults, setStoreResults] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [negotiable, setNegotiable] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 600000]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  const updateStoreFollowState = useCallback((storeId: string, isFollowing: boolean) => {
    const applyUpdate = (store: Store) => {
      const wasFollowing = Boolean(store.isFollowing);

      if (wasFollowing === isFollowing) {
        return { ...store, isFollowing };
      }

      const countDelta = isFollowing ? 1 : -1;

      return {
        ...store,
        isFollowing,
        followCount: Math.max(0, store.followCount + countDelta),
        _count: store._count
          ? { ...store._count, followers: Math.max(0, store._count.followers + countDelta) }
          : store._count,
      };
    };

    setStoreResults(current => current.map(store => store.id === storeId ? applyUpdate(store) : store));
    setSelectedStore(current => current && current.id === storeId ? applyUpdate(current) : current);
  }, []);

  const doSearch = useCallback(async (term: string) => {
    setLoading(true);
    try {
      if (searchTab === 'products') {
        const p = new URLSearchParams({ status: 'active', sort: sortBy, limit: '30' });
        if (term) p.set('search', term);
        if (category) p.set('category', category);
        if (negotiable) p.set('negotiable', 'true');
        p.set('minPrice', String(priceRange[0]));
        p.set('maxPrice', String(priceRange[1]));
        const data = await api.get(`/api/listings?${p}`);
        setResults(data.listings || []);
      } else {
        const p = new URLSearchParams({ limit: '30' });
        if (term) p.set('search', term);
        if (category) p.set('category', category);
        const data = await api.get(`/api/stores?${p}`);
        setStoreResults(data || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [searchTab, category, sortBy, negotiable, priceRange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, doSearch]);

  // ── Store Detail View ──
  if (selectedStore) {
    return (
      <div className="pb-4">
        {/* Banner */}
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-amber-500/10">
          {selectedStore.banner && (
            <img src={selectedStore.banner} alt="" className="w-full h-full object-cover" />
          )}
          <button onClick={() => setSelectedStore(null)} style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }} className="absolute left-3 p-2 rounded-full bg-background/80 backdrop-blur-sm">
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Store Info */}
        <div className="px-4 -mt-8 relative z-10">
          <div className="flex items-end gap-3">
            {selectedStore.logo ? (
              <img src={selectedStore.logo} alt={selectedStore.name} className="w-16 h-16 rounded-2xl object-cover border-4 border-background shadow-lg" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border-4 border-background shadow-lg flex items-center justify-center">
                <StoreIcon className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-lg">{selectedStore.name}</h2>
                {selectedStore.isVerified && <Shield className="w-4 h-4 text-emerald-500" />}
              </div>
              <Badge variant="outline" className="text-[10px]">{selectedStore.category}</Badge>
            </div>
          </div>

          {selectedStore.description && (
            <p className="text-sm text-muted-foreground mt-3">{selectedStore.description}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="text-center">
              <p className="font-bold">{getStoreListingCount(selectedStore)}</p>
              <p className="text-[10px] text-muted-foreground">Products</p>
            </div>
            <div className="text-center">
              <p className="font-bold">{getStoreFollowerCount(selectedStore)}</p>
              <p className="text-[10px] text-muted-foreground">Followers</p>
            </div>
            {selectedStore.rating > 0 && (
              <div className="text-center">
                <p className="font-bold flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {selectedStore.rating.toFixed(1)}</p>
                <p className="text-[10px] text-muted-foreground">Rating</p>
              </div>
            )}
          </div>

          {/* Contact & Social */}
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedStore.phone && (
              <a href={`tel:${selectedStore.phone}`} className="text-[11px] px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">📞 Call</a>
            )}
            {selectedStore.whatsapp && (
              <a href={`https://wa.me/${selectedStore.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium flex items-center gap-1">💬 WhatsApp</a>
            )}
            {selectedStore.instagram && (
              <a href={`https://instagram.com/${selectedStore.instagram.replace('@', '')}`} target="_blank" className="text-[11px] px-3 py-1.5 rounded-full bg-pink-500/10 text-pink-600 font-medium flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Instagram</a>
            )}
          </div>

          {selectedStore.address && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedStore.address}</p>
          )}
          {selectedStore.openHours && (
            <p className="text-xs text-muted-foreground mt-1">🕐 {selectedStore.openHours}</p>
          )}

          {/* Follow Button */}
          <Button
            className="w-full mt-4 h-10 gap-2"
            variant={selectedStore.isFollowing ? 'outline' : 'default'}
            disabled={followLoading || selectedStore.ownerId === user.id}
            onClick={async () => {
              const wasFollowing = Boolean(selectedStore.isFollowing);
              const nextAction = selectedStore.isFollowing ? 'unfollow' : 'follow';
              const nextIsFollowing = !wasFollowing;

              try {
                setFollowLoading(true);
                updateStoreFollowState(selectedStore.id, nextIsFollowing);
                const response = await api.post(`/api/stores/${selectedStore.id}`, { userId: user.id, action: nextAction });
                updateStoreFollowState(selectedStore.id, Boolean(response.followed));
              } catch {
                updateStoreFollowState(selectedStore.id, wasFollowing);
              }
              finally {
                setFollowLoading(false);
              }
            }}
          >
            <Users className="w-4 h-4" />
            {selectedStore.ownerId === user.id
              ? 'Your Store'
              : selectedStore.isFollowing
                ? 'Unfollow Store'
                : 'Follow Store'}
          </Button>
        </div>

        {/* Store Listings */}
        <div className="px-4 mt-6">
          <h3 className="font-bold text-sm mb-3">Products ({selectedStore.listings?.length || 0})</h3>
          <div className="grid grid-cols-2 gap-3">
            {selectedStore.listings?.map(listing => (
              <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
            ))}
          </div>
          {(!selectedStore.listings || selectedStore.listings.length === 0) && (
            <p className="text-center py-8 text-sm text-muted-foreground">No products listed yet</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-30 safe-top bg-background/95 backdrop-blur-md border-b px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={searchTab === 'products' ? 'Search products...' : 'Search stores & services...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 bg-muted/50" />
          </div>
          {searchTab === 'products' && (
            <Button variant={showFilters ? 'default' : 'outline'} size="icon" onClick={() => setShowFilters(!showFilters)} className="h-10 w-10">
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
          <button onClick={() => { setSearchTab('products'); setCategory(''); }} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${searchTab === 'products' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
            <ShoppingBag className="w-3.5 h-3.5" /> Products
          </button>
          <button onClick={() => { setSearchTab('stores'); setCategory(''); setShowFilters(false); }} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${searchTab === 'stores' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
            <StoreIcon className="w-3.5 h-3.5" /> Stores
          </button>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <Badge variant={category === '' ? 'default' : 'outline'} className="cursor-pointer flex-shrink-0" onClick={() => setCategory('')}>All</Badge>
          {(searchTab === 'products' ? CATEGORIES : STORE_CATEGORIES).map(cat => (
            <Badge key={cat} variant={category === cat ? 'default' : 'outline'} className="cursor-pointer flex-shrink-0 whitespace-nowrap" onClick={() => setCategory(category === cat ? '' : cat)}>{cat}</Badge>
          ))}
        </div>

        {/* Product Filters */}
        <AnimatePresence>
          {showFilters && searchTab === 'products' && (
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
        {/* Products Results */}
        {searchTab === 'products' && (
          <>
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                {Array.from({ length: 6 }).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No products found</p>
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
          </>
        )}

        {/* Stores Results */}
        {searchTab === 'stores' && (
          <>
            {loading ? (
              <div className="space-y-3 mt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4 space-y-2">
                    <div className="flex gap-3">
                      <div className="w-14 h-14 rounded-xl bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-full bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  </CardContent></Card>
                ))}
              </div>
            ) : storeResults.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <StoreIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No stores found</p>
                <p className="text-sm">Try a different search term or category</p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                <p className="text-sm text-muted-foreground">{storeResults.length} store{storeResults.length !== 1 ? 's' : ''}</p>
                {storeResults.map(store => (
                  <StoreCard key={store.id} store={store} onClick={async () => {
                    try {
                      const full = await api.get(`/api/stores/${store.id}`);
                      setSelectedStore(full);
                    } catch {
                      setSelectedStore(store);
                    }
                  }} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
