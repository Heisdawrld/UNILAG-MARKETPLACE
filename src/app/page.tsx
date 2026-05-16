'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Search, PlusCircle, MessageCircle, User, Heart, ArrowLeft,
  Send, Star, Shield, ChevronRight, MapPin, Clock, Eye, X,
  Filter, SlidersHorizontal, Camera, CheckCircle2, AlertTriangle,
  Bell, Settings, LogOut, TrendingUp, Zap, Award, MoreHorizontal,
  RefreshCw, Trash2, Edit3, Share2, Flag, MessageSquare, Users,
  BarChart3, FileWarning, ChevronDown, Sun, Moon, Check, Image as ImageIcon,
  ThumbsUp, Phone, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';
import {
  User as UserType, Listing, Chat, Message, Review, SavedListing,
  Notification, Report, AdminStats, ViewTab, CATEGORIES, CONDITIONS,
  CONDITION_LABELS, CONDITION_COLORS, CATEGORY_PLACEHOLDER_IMAGES,
  ListingSeller
} from '@/lib/types';
import {
  formatPrice, timeAgo, getListingImages, getListingFirstImage,
  debounce, truncate, getInitials, getVerificationLabel,
  getVerificationColor, renderStars
} from '@/lib/marketplace-utils';

// ==========================================
// API HELPER
// ==========================================
const api = {
  get: async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },
  post: async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },
  patch: async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Update failed');
    return res.json();
  },
  del: async (url: string) => {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    return res.json();
  },
};

// ==========================================
// LISTING CARD COMPONENT
// ==========================================
function ListingCard({
  listing,
  onClick,
  isSaved,
  onToggleSave,
  currentUserId,
}: {
  listing: Listing;
  onClick: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
  currentUserId: string;
}) {
  const image = getListingFirstImage(listing.images, listing.category);
  const conditionClass = CONDITION_COLORS[listing.condition] || CONDITION_COLORS.fairly_used;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer"
      onClick={onClick}
    >
      <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow h-full">
        <div className="relative aspect-[4/3] bg-muted">
          <img
            src={image}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {listing.boosted && (
            <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
              <Zap className="w-2.5 h-2.5 mr-0.5" /> Boosted
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
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
            className="absolute bottom-2 right-2 p-1.5 rounded-full bg-white/90 dark:bg-black/70 hover:bg-white dark:hover:bg-black/90 transition-colors"
          >
            <Heart
              className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-600 dark:text-gray-400'}`}
            />
          </button>
        </div>
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm line-clamp-2 leading-tight mb-1">
            {listing.title}
          </h3>
          <p className="text-primary font-bold text-base mb-1.5">
            {formatPrice(listing.price)}
          </p>
          <div className="flex items-center gap-1.5">
            <Avatar className="w-5 h-5">
              <AvatarImage src={listing.seller.avatar || undefined} />
              <AvatarFallback className="text-[8px]">
                {getInitials(listing.seller.username)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {listing.seller.username}
            </span>
            {listing.seller.verificationStatus === 'unilag_verified' && (
              <Shield className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==========================================
// LISTING CARD SKELETON
// ==========================================
function ListingCardSkeleton() {
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

// ==========================================
// HOME FEED VIEW
// ==========================================
function HomeFeed({
  user,
  onSelectListing,
  onToggleSave,
  savedIds,
  unreadNotifications,
}: {
  user: UserType;
  onSelectListing: (id: string) => void;
  onToggleSave: (listingId: string) => void;
  savedIds: Set<string>;
  unreadNotifications: number;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const { toast } = useToast();

  const fetchListings = useCallback(async () => {
    try {
      const data = await api.get('/api/listings?status=active&limit=20&sort=newest');
      setListings(data.listings || []);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.get(`/api/notifications?userId=${user.id}`);
      // API returns { notifications, unreadCount } - extract the array
      setNotifications(data.notifications || data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [user.id]);

  useEffect(() => {
    fetchListings();
    fetchNotifications();
  }, [fetchListings, fetchNotifications]);

  const handleMarkNotifsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await api.patch('/api/notifications/read', { userId: user.id, notificationIds: unreadIds });
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const boostedListings = useMemo(() => listings.filter((l) => l.boosted), [listings]);
  const recentListings = useMemo(() => listings.slice(0, 10), [listings]);
  const popularListings = useMemo(
    () => [...listings].sort((a, b) => b.views - a.views).slice(0, 6),
    [listings]
  );

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">U</span>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">UNILAG Market</h1>
              <p className="text-[10px] text-muted-foreground">Campus Marketplace</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Sheet open={showNotifs} onOpenChange={(open) => {
              setShowNotifs(open);
              if (open) handleMarkNotifsRead();
            }}>
              <SheetTrigger asChild>
                <button className="p-2 rounded-full hover:bg-muted transition-colors relative">
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Notifications</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                  {notifications.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">No notifications</p>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 rounded-lg border text-sm ${
                            notif.read ? 'bg-background' : 'bg-primary/5 border-primary/20'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              notif.read ? 'bg-transparent' : 'bg-primary'
                            }`} />
                            <div>
                              <p className="font-medium text-xs">{notif.title}</p>
                              <p className="text-xs text-muted-foreground">{notif.message}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(notif.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-8 pb-4">
          {/* Trending / Boosted */}
          {boostedListings.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-lg">Trending 🔥</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {boostedListings.map((listing) => (
                  <div key={listing.id} className="flex-shrink-0 w-44">
                    <ListingCard
                      listing={listing}
                      onClick={() => onSelectListing(listing.id)}
                      isSaved={savedIds.has(listing.id)}
                      onToggleSave={() => onToggleSave(listing.id)}
                      currentUserId={user.id}
                    />
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
              {recentListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onClick={() => onSelectListing(listing.id)}
                  isSaved={savedIds.has(listing.id)}
                  onToggleSave={() => onToggleSave(listing.id)}
                  currentUserId={user.id}
                />
              ))}
            </div>
          </section>

          {/* Popular / Most Viewed */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-5 h-5 text-blue-500" />
              <h2 className="font-bold text-lg">Most Viewed</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {popularListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onClick={() => onSelectListing(listing.id)}
                  isSaved={savedIds.has(listing.id)}
                  onToggleSave={() => onToggleSave(listing.id)}
                  currentUserId={user.id}
                />
              ))}
            </div>
          </section>

          {/* Featured Vendors */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5 text-emerald-500" />
              <h2 className="font-bold text-lg">Top Sellers</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              {Array.from(new Map(listings.map(l => [l.seller.id, l.seller])).values())
                .filter(s => s.verificationStatus === 'unilag_verified')
                .slice(0, 5)
                .map((seller) => (
                  <div key={seller.id} className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border shadow-sm w-20">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={seller.avatar || undefined} />
                      <AvatarFallback>{getInitials(seller.username)}</AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] font-medium text-center truncate w-full">
                      {seller.username.replace('_', ' ')}
                    </span>
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

// ==========================================
// SEARCH VIEW
// ==========================================
function SearchView({
  user,
  onSelectListing,
  onToggleSave,
  savedIds,
}: {
  user: UserType;
  onSelectListing: (id: string) => void;
  onToggleSave: (listingId: string) => void;
  savedIds: Set<string>;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 600000]);
  const [sortBy, setSortBy] = useState('newest');
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  const doSearch = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: 'active',
        sort: sortBy,
        limit: '30',
      });
      if (searchTerm) params.set('search', searchTerm);
      if (category) params.set('category', category);
      if (condition) params.set('condition', condition);
      if (negotiable) params.set('negotiable', 'true');
      params.set('minPrice', String(priceRange[0]));
      params.set('maxPrice', String(priceRange[1]));

      const data = await api.get(`/api/listings?${params.toString()}`);
      setResults(data.listings || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [category, condition, negotiable, priceRange, sortBy]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, doSearch]);

  useEffect(() => {
    doSearch(search);
  }, [category, condition, negotiable, priceRange, sortBy]);

  return (
    <div>
      {/* Search Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-muted/50"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="h-10 w-10"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <Badge
            variant={category === '' ? 'default' : 'outline'}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setCategory('')}
          >
            All
          </Badge>
          {CATEGORIES.map((cat) => (
            <Badge
              key={cat}
              variant={category === cat ? 'default' : 'outline'}
              className="cursor-pointer flex-shrink-0 whitespace-nowrap"
              onClick={() => setCategory(category === cat ? '' : cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-2">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="text-xs mb-1 block">Condition</Label>
                    <Select value={condition} onValueChange={(v) => setCondition(v === 'all' ? '' : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="brand_new">Brand New</SelectItem>
                        <SelectItem value="like_new">Like New</SelectItem>
                        <SelectItem value="fairly_used">Fairly Used</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs mb-1 block">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="oldest">Oldest</SelectItem>
                        <SelectItem value="price_low">Price: Low→High</SelectItem>
                        <SelectItem value="price_high">Price: High→Low</SelectItem>
                        <SelectItem value="popular">Most Popular</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs mb-2 block">
                    Price Range: {formatPrice(priceRange[0])} — {formatPrice(priceRange[1])}
                  </Label>
                  <Slider
                    value={priceRange}
                    onValueChange={(v) => setPriceRange(v as [number, number])}
                    min={0}
                    max={600000}
                    step={5000}
                    className="mt-2"
                  />
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

      {/* Results */}
      <div className="px-4 pb-4">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
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
                {results.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onClick={() => onSelectListing(listing.id)}
                    isSaved={savedIds.has(listing.id)}
                    onToggleSave={() => onToggleSave(listing.id)}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

// ==========================================
// SELL / CREATE LISTING VIEW
// ==========================================
function SellView({ user, onListingCreated }: { user: UserType; onListingCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [negotiable, setNegotiable] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).slice(0, 5 - images.length).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => {
          if (prev.length >= 5) return prev;
          return [...prev, reader.result as string];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || !description || !price || !category || !condition) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/listings', {
        sellerId: user.id,
        title,
        description,
        price: parseFloat(price),
        category,
        condition,
        negotiable,
        location,
        images: images.length > 0 ? images : [CATEGORY_PLACEHOLDER_IMAGES[category]],
      });
      toast({ title: 'Listing created!', description: 'Your item is now live on the marketplace' });
      setTitle('');
      setDescription('');
      setPrice('');
      setCategory('');
      setCondition('');
      setLocation('');
      setNegotiable(true);
      setImages([]);
      onListingCreated();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create listing', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto pb-4">
        <h2 className="font-bold text-xl">Sell Something</h2>

        {/* Image Upload */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Photos (max 5)</Label>
          <div className="flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <label className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                <Camera className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-0.5">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Title *</Label>
          <Input
            placeholder="e.g., iPhone 13 Pro Max - 256GB"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{title.length}/100</p>
        </div>

        {/* Description */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Description *</Label>
          <Textarea
            placeholder="Describe your item in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={1000}
          />
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{description.length}/1000</p>
        </div>

        {/* Price */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Price (₦) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₦</span>
            <Input
              type="number"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="pl-8"
              min="0"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Category *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Condition */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Condition *</Label>
          <div className="grid grid-cols-3 gap-2">
            {CONDITIONS.map((cond) => (
              <button
                key={cond}
                onClick={() => setCondition(cond)}
                className={`p-2.5 rounded-lg border text-sm text-center transition-colors ${
                  condition === cond
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {CONDITION_LABELS[cond]}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Location</Label>
          <Input
            placeholder="e.g., Jaja Hall, UNILAG"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        {/* Negotiable */}
        <div className="flex items-center justify-between py-2">
          <div>
            <Label className="text-sm font-medium">Negotiable</Label>
            <p className="text-xs text-muted-foreground">Allow buyers to negotiate price</p>
          </div>
          <Switch checked={negotiable} onCheckedChange={setNegotiable} />
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !title || !description || !price || !category || !condition}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {submitting ? (
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <PlusCircle className="w-5 h-5 mr-2" />
          )}
          {submitting ? 'Posting...' : 'Post Listing'}
        </Button>
      </div>
  );
}

// ==========================================
// MESSAGES VIEW
// ==========================================
function MessagesView({ user, initialChat }: { user: UserType; initialChat?: Chat | null }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(initialChat || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout>();
  const initialChatSetRef = useRef(false);

  const fetchChats = useCallback(async () => {
    try {
      const data = await api.get(`/api/chats?userId=${user.id}`);
      setChats(data);
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  const fetchMessages = useCallback(async () => {
    if (!activeChat) return;
    try {
      const data = await api.get(`/api/messages?chatId=${activeChat.id}&userId=${user.id}`);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [activeChat, user.id]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Handle initial chat from listing detail
  useEffect(() => {
    if (initialChat && !initialChatSetRef.current) {
      setActiveChat(initialChat);
      initialChatSetRef.current = true;
    }
  }, [initialChat]);

  useEffect(() => {
    if (activeChat) {
      fetchMessages();
      pollRef.current = setInterval(fetchMessages, 3000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [activeChat, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;
    setSending(true);
    try {
      await api.post('/api/messages', {
        chatId: activeChat.id,
        senderId: user.id,
        message: newMessage.trim(),
      });
      setNewMessage('');
      fetchMessages();
      fetchChats();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const getOtherUser = (chat: Chat) => {
    return chat.buyerId === user.id ? chat.seller : chat.buyer;
  };

  // Chat detail view
  if (activeChat) {
    const otherUser = getOtherUser(activeChat);
    return (
      <div style={{ height: 'calc(100dvh - 5rem)', position: 'sticky', top: 0 }} className="flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
          <button onClick={() => setActiveChat(null)} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Avatar className="w-9 h-9">
            <AvatarImage src={otherUser.avatar || undefined} />
            <AvatarFallback>{getInitials(otherUser.username)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{otherUser.username.replace('_', ' ')}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              Re: {truncate(activeChat.listing.title, 30)}
            </p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMine = msg.senderId === user.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {timeAgo(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="px-4 py-3 border-t bg-background">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={sending || !newMessage.trim()}
              size="icon"
              className="h-10 w-10 rounded-full"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Chat list view
  return (
    <div className="pb-4">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <h2 className="font-bold text-lg">Messages</h2>
      </div>

      <div className="pb-4">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No messages yet</p>
            <p className="text-sm">Start a conversation by messaging a seller</p>
          </div>
        ) : (
          <div className="divide-y">
            {chats.map((chat) => {
              const other = getOtherUser(chat);
              return (
                <motion.button
                  key={chat.id}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setActiveChat(chat)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={other.avatar || undefined} />
                      <AvatarFallback>{getInitials(other.username)}</AvatarFallback>
                    </Avatar>
                    {chat.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm truncate">{other.username.replace('_', ' ')}</p>
                      {chat.lastMessage && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {timeAgo(chat.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {chat.lastMessage ? chat.lastMessage.message : 'No messages yet'}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      Re: {truncate(chat.listing.title, 30)}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// LISTING DETAIL VIEW
// ==========================================
function ListingDetail({
  listingId,
  user,
  onBack,
  onToggleSave,
  isSaved,
  onOpenChat,
}: {
  listingId: string;
  user: UserType;
  onBack: () => void;
  onToggleSave: () => void;
  isSaved: boolean;
  onOpenChat: (chat: Chat) => void;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const data = await api.get(`/api/listings/${listingId}`);
        setListing(data);
        // Fetch similar listings
        const similar = await api.get(`/api/listings?category=${data.category}&status=active&limit=6`);
        setSimilarListings((similar.listings || []).filter((l: Listing) => l.id !== listingId));
      } catch (err) {
        console.error('Failed to fetch listing:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [listingId]);

  const handleMessageSeller = async () => {
    if (!listing) return;
    try {
      const chat = await api.post('/api/chats', {
        listingId: listing.id,
        buyerId: user.id,
        sellerId: listing.sellerId,
      });
      onOpenChat(chat);
      onBack();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to start chat', variant: 'destructive' });
    }
  };

  const handleReport = async () => {
    if (!reportReason) return;
    try {
      await api.post('/api/reports', {
        reporterId: user.id,
        listingId: listing?.id,
        reason: reportReason,
      });
      toast({ title: 'Report submitted', description: 'We will review your report' });
      setShowReport(false);
      setReportReason('');
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to submit report', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="w-full aspect-[4/3] rounded-xl" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Listing not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const images = getListingImages(listing.images, listing.category);
  const conditionClass = CONDITION_COLORS[listing.condition] || CONDITION_COLORS.fairly_used;
  const isOwnListing = listing.sellerId === user.id;

  return (
    <div className="pb-4">
      <div className="max-w-2xl mx-auto">
        {/* Image Gallery */}
        <div className="relative">
          <div className="aspect-[4/3] bg-muted overflow-hidden">
            <img
              src={images[currentImage]}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          </div>
          {images.length > 1 && (
            <>
              <button
                onClick={() => setCurrentImage((p) => (p > 0 ? p - 1 : images.length - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <button
                onClick={() => setCurrentImage((p) => (p < images.length - 1 ? p + 1 : 0))}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === currentImage ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <button
              onClick={onBack}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={onToggleSave}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Title & Price */}
          <div>
            <h1 className="font-bold text-xl leading-tight mb-2">{listing.title}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-bold text-primary">{formatPrice(listing.price)}</span>
              <Badge className={conditionClass}>
                {CONDITION_LABELS[listing.condition] || listing.condition}
              </Badge>
              {listing.negotiable && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                  Negotiable
                </Badge>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{listing.views} views</span>
            <span className="flex items-center gap-1"><Heart className="w-4 h-4" />{listing.likesCount} likes</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{timeAgo(listing.createdAt)}</span>
          </div>

          {/* Location */}
          {listing.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{listing.location}</span>
            </div>
          )}

          <Separator />

          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>

          <Separator />

          {/* Seller Card */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={listing.seller.avatar || undefined} />
                  <AvatarFallback>{getInitials(listing.seller.username)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{listing.seller.username.replace('_', ' ')}</p>
                    {listing.seller.verificationStatus !== 'unverified' && (
                      <Shield className={`w-4 h-4 ${getVerificationColor(listing.seller.verificationStatus)}`} />
                    )}
                  </div>
                  {listing.seller.department && (
                    <p className="text-xs text-muted-foreground">{listing.seller.department}</p>
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-medium">{listing.seller.ratingAverage.toFixed(1)}</span>
                  </div>
                </div>
                {listing.seller.verificationStatus === 'unilag_verified' && (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {!isOwnListing && (
            <div className="flex gap-3">
              <Button
                onClick={handleMessageSeller}
                className="flex-1 h-12 font-semibold"
                size="lg"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Message Seller
              </Button>
              <Button
                variant="outline"
                onClick={onToggleSave}
                className="h-12 px-4"
                size="lg"
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
            </div>
          )}

          {/* Similar Listings */}
          {similarListings.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Similar Listings</h3>
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {similarListings.slice(0, 4).map((l) => (
                  <div key={l.id} className="flex-shrink-0 w-40">
                    <Card className="overflow-hidden border-0 shadow-sm">
                      <div className="aspect-square bg-muted">
                        <img
                          src={getListingFirstImage(l.images, l.category)}
                          alt={l.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <CardContent className="p-2">
                        <p className="text-xs font-medium line-clamp-1">{l.title}</p>
                        <p className="text-xs font-bold text-primary">{formatPrice(l.price)}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {['scam', 'fake_listing', 'harassment', 'spam', 'illegal_item'].map((reason) => (
              <button
                key={reason}
                onClick={() => setReportReason(reason)}
                className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
                  reportReason === reason ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                }`}
              >
                {reason.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
            <Button onClick={handleReport} disabled={!reportReason} className="w-full">
              Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// PROFILE VIEW
// ==========================================
function ProfileView({
  user,
  setUser,
  onSelectListing,
  savedIds,
  onToggleSave,
  onShowAdmin,
}: {
  user: UserType;
  setUser: (u: UserType) => void;
  onSelectListing: (id: string) => void;
  savedIds: Set<string>;
  onToggleSave: (listingId: string) => void;
  onShowAdmin: () => void;
}) {
  const [profileTab, setProfileTab] = useState('listings');
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', bio: '', phone: '', department: '', hostel: '',
  });
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setEditForm({
      name: user.username,
      bio: user.bio || '',
      phone: user.phone || '',
      department: user.department || '',
      hostel: user.hostel || '',
    });
  }, [user]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listingsData, savedData, reviewsData] = await Promise.all([
        api.get(`/api/listings?sellerId=${user.id}&limit=50`),
        api.get(`/api/saved?userId=${user.id}`),
        api.get(`/api/reviews?sellerId=${user.id}`),
      ]);
      setMyListings(listingsData.listings || []);
      setSavedListings(savedData);
      setReviews(reviewsData);
    } catch (err) {
      console.error('Failed to fetch profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveProfile = async () => {
    try {
      await api.patch('/api/auth/profile', {
        userId: user.id,
        username: editForm.name,
        bio: editForm.bio,
        phone: editForm.phone,
        department: editForm.department,
        hostel: editForm.hostel,
      });
      // Refetch user
      const updated = await api.get(`/api/auth/me?email=${user.email}`);
      setUser(updated);
      setEditing(false);
      toast({ title: 'Profile updated!' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    try {
      await api.del(`/api/listings/${listingId}`);
      toast({ title: 'Listing removed' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete listing', variant: 'destructive' });
    }
  };

  const handleUnsave = async (listingId: string) => {
    try {
      await api.del(`/api/saved?userId=${user.id}&listingId=${listingId}`);
      fetchData();
      onToggleSave(listingId);
    } catch (err) {
      console.error('Failed to unsave:', err);
    }
  };

  return (
    <div className="pb-4">
      <div className="p-4 max-w-lg mx-auto">
        {/* Profile Header */}
        <div className="text-center mb-6">
          <Avatar className="w-20 h-20 mx-auto mb-3">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="text-xl">{getInitials(user.username)}</AvatarFallback>
          </Avatar>
          <h2 className="font-bold text-lg">{user.username.replace('_', ' ')}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.department && (
            <p className="text-xs text-muted-foreground mt-0.5">{user.department} • {user.level || ''}</p>
          )}
          {user.hostel && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {user.hostel}
            </p>
          )}
          <div className="flex items-center justify-center gap-1 mt-1">
            {user.verificationStatus !== 'unverified' && (
              <Badge variant="outline" className={`text-[10px] ${getVerificationColor(user.verificationStatus)}`}>
                <Shield className="w-3 h-3 mr-1" />
                {getVerificationLabel(user.verificationStatus)}
              </Badge>
            )}
          </div>

          {/* Trust Score */}
          <div className="flex items-center justify-center gap-1 mt-2">
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary">
              <Star className="w-4 h-4 fill-primary" />
              <span className="text-sm font-semibold">{user.trustScore}%</span>
              <span className="text-xs">Trust Score</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="text-center">
              <p className="font-bold text-lg">{myListings.length}</p>
              <p className="text-[10px] text-muted-foreground">Listings</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{user.totalReviews}</p>
              <p className="text-[10px] text-muted-foreground">Reviews</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{user.ratingAverage.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Rating</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setEditing(true)}
          >
            <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit Profile
          </Button>
        </div>

        <Separator className="my-4" />

        {/* Tabs */}
        <Tabs value={profileTab} onValueChange={setProfileTab}>
          <TabsList className="w-full">
            <TabsTrigger value="listings" className="flex-1 text-xs">My Listings</TabsTrigger>
            <TabsTrigger value="saved" className="flex-1 text-xs">Saved</TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1 text-xs">Reviews</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 text-xs">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : myListings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No listings yet</p>
            ) : (
              <div className="space-y-3">
                {myListings.map((listing) => (
                  <Card key={listing.id} className="overflow-hidden">
                    <div className="flex">
                      <div className="w-24 h-24 flex-shrink-0 bg-muted">
                        <img
                          src={getListingFirstImage(listing.images, listing.category)}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <CardContent className="flex-1 p-3 flex flex-col justify-between">
                        <div>
                          <p className="font-medium text-sm line-clamp-1">{listing.title}</p>
                          <p className="text-sm font-bold text-primary">{formatPrice(listing.price)}</p>
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            {listing.status}
                          </Badge>
                        </div>
                        <div className="flex gap-2 mt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDeleteListing(listing.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : savedListings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No saved listings</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {savedListings.map((saved) => (
                  <ListingCard
                    key={saved.id}
                    listing={saved.listing}
                    onClick={() => onSelectListing(saved.listing.id)}
                    isSaved={true}
                    onToggleSave={() => handleUnsave(saved.listing.id)}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <Card key={review.id} className="border shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={review.reviewer.avatar || undefined} />
                          <AvatarFallback>{getInitials(review.reviewer.username)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{review.reviewer.username.replace('_', ' ')}</p>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(review.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                <div>
                  <p className="text-sm font-medium">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Toggle dark theme</p>
                </div>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>

            {user.role === 'admin' && (
              <Button variant="outline" className="w-full" onClick={onShowAdmin}>
                <BarChart3 className="w-4 h-4 mr-2" /> Admin Dashboard
              </Button>
            )}

            <div className="text-center text-xs text-muted-foreground pt-4">
              <p>UNILAG Marketplace v1.0</p>
              <p>Made with ❤️ for UNILAG students</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Username</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Bio</Label>
              <Textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Department</Label>
              <Input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Hostel</Label>
              <Input value={editForm.hostel} onChange={(e) => setEditForm({ ...editForm, hostel: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveProfile} className="flex-1">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// ADMIN DASHBOARD VIEW
// ==========================================
function AdminDashboard({ user, onClose }: { user: UserType; onClose: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, reportsData] = await Promise.all([
          api.get('/api/admin/stats'),
          api.get('/api/admin/reports'),
        ]);
        setStats(statsData);
        setReports(reportsData);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpdateReport = async (reportId: string, status: string) => {
    try {
      await api.patch(`/api/admin/reports/${reportId}`, { status });
      toast({ title: `Report ${status}` });
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status } : r));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update report', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={onClose} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-lg">Admin Dashboard</h2>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                <p className="text-2xl font-bold">{stats.activeListings}</p>
                <p className="text-xs text-muted-foreground">Active Listings</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <MessageSquare className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">{stats.totalChats}</p>
                <p className="text-xs text-muted-foreground">Chats</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-bold">{stats.pendingReports}</p>
                <p className="text-xs text-muted-foreground">Pending Reports</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reports */}
        <h3 className="font-semibold mb-3">Recent Reports</h3>
        {reports.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No reports</p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Card key={report.id} className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="text-[10px] mb-1">
                        {report.reason.replace('_', ' ')}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{timeAgo(report.createdAt)}</p>
                    </div>
                    <Badge
                      className={`text-[10px] ${
                        report.status === 'pending'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : report.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}
                    >
                      {report.status}
                    </Badge>
                  </div>
                  {report.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleUpdateReport(report.id, 'resolved')}
                      >
                        Resolve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleUpdateReport(report.id, 'dismissed')}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// BOTTOM NAVIGATION
// ==========================================
function BottomNav({
  activeTab,
  onTabChange,
  unreadMessages,
}: {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  unreadMessages: number;
}) {
  const tabs: { id: ViewTab; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'sell', icon: PlusCircle, label: 'Sell' },
    { id: 'messages', icon: MessageCircle, label: 'Messages' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isSell = id === 'sell';
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`relative flex flex-col items-center justify-center py-2 px-3 min-w-[60px] transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isSell ? (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center -mt-4 shadow-lg transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/90 text-primary-foreground'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
              ) : (
                <Icon className="w-5 h-5" />
              )}
              <span className="text-[10px] mt-0.5 font-medium">{isSell ? '' : label}</span>
              {id === 'messages' && unreadMessages > 0 && (
                <span className="absolute top-1 right-2 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
              {isActive && !isSell && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-px left-3 right-3 h-0.5 bg-primary rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function Home() {
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('home');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showAdmin, setShowAdmin] = useState(false);
  const [userLoading, setUserLoading] = useState(true);
  const [activeChatFromDetail, setActiveChatFromDetail] = useState<Chat | null>(null);

  // Load user on mount — try Clerk first, then demo user, then seed
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // 1) Try Clerk-authenticated user first
        try {
          const clerkData = await api.get('/api/auth/clerk-me');
          if (clerkData && clerkData.id) {
            setUser(clerkData);
            setUserLoading(false);
            return;
          }
        } catch {
          // Clerk not configured or not authenticated — that's fine
        }

        // 2) Try the demo user (from seeded data)
        try {
          let data = await api.get('/api/auth/me?email=chidi.okonkwo@unilag.edu.ng');
          if (data && data.id) {
            setUser(data);
            setUserLoading(false);
            return;
          }
        } catch {
          // Demo user doesn't exist yet — try seeding
        }

        // 3) Seed the database and try again
        console.log('[app] No user found, attempting to seed database...');
        try {
          await api.post('/api/seed');
          const data = await api.get('/api/auth/me?email=chidi.okonkwo@unilag.edu.ng');
          if (data && data.id) {
            setUser(data);
          }
        } catch (seedErr) {
          console.error('[app] Failed to seed or fetch user:', seedErr);
          // Try registering a demo user directly
          try {
            const regData = await api.post('/api/auth/register', {
              username: 'demo_user',
              email: 'demo@unilag.market',
              bio: 'Demo user for UNILAG Marketplace',
            });
            if (regData && regData.id) {
              setUser(regData);
            }
          } catch (regErr) {
            console.error('[app] Failed to register demo user:', regErr);
          }
        }
      } catch (err) {
        console.error('[app] Unexpected error loading user:', err);
      } finally {
        setUserLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Load saved listings
  useEffect(() => {
    if (!user) return;
    const fetchSaved = async () => {
      try {
        const data = await api.get(`/api/saved?userId=${user.id}`);
        const ids = new Set(data.map((s: SavedListing) => s.listingId));
        setSavedIds(ids);
      } catch (err) {
        console.error('Failed to fetch saved:', err);
      }
    };
    fetchSaved();
  }, [user]);

  const handleToggleSave = useCallback(async (listingId: string) => {
    if (!user) return;
    const isSaved = savedIds.has(listingId);
    try {
      if (isSaved) {
        await api.del(`/api/saved?userId=${user.id}&listingId=${listingId}`);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(listingId);
          return next;
        });
      } else {
        await api.post('/api/saved', { userId: user.id, listingId });
        setSavedIds((prev) => new Set(prev).add(listingId));
      }
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  }, [user, savedIds]);

  const handleSelectListing = useCallback((id: string) => {
    setSelectedListingId(id);
  }, []);

  const handleOpenChat = useCallback((chat: Chat) => {
    setActiveChatFromDetail(chat);
    setActiveTab('messages');
  }, []);

  const handleTabChange = useCallback((tab: ViewTab) => {
    setActiveTab(tab);
    setSelectedListingId(null);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // Calculate unread messages count for badge
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const [chats, notifsData] = await Promise.all([
          api.get(`/api/chats?userId=${user.id}`),
          api.get(`/api/notifications?userId=${user.id}`),
        ]);
        // API returns { notifications, unreadCount } - extract the array
        const notifs = notifsData.notifications || notifsData || [];
        setUnreadCount(chats.reduce((acc: number, c: Chat) => acc + c.unreadCount, 0));
        setUnreadNotifs(notifs.filter((n: Notification) => !n.read).length);
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Loading state
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">U</span>
          </div>
          <h1 className="font-bold text-xl mb-2">UNILAG Marketplace</h1>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">U</span>
          </div>
          <h1 className="font-bold text-xl mb-2">UNILAG Marketplace</h1>
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
          <p className="text-sm text-muted-foreground mb-4">
            The marketplace is currently unavailable. This is usually caused by missing database configuration.
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            If you are the administrator, please ensure these environment variables are set:
          </p>
          <div className="bg-muted rounded-lg p-3 text-left text-xs font-mono space-y-1 mb-4">
            <p>TURSO_DATABASE_URL=libsql://...</p>
            <p>TURSO_AUTH_TOKEN=eyJhbGci...</p>
          </div>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="pb-20">
        {selectedListingId ? (
          <ListingDetail
            listingId={selectedListingId}
            user={user}
            onBack={() => setSelectedListingId(null)}
            onToggleSave={() => handleToggleSave(selectedListingId)}
            isSaved={savedIds.has(selectedListingId)}
            onOpenChat={handleOpenChat}
          />
        ) : showAdmin ? (
          <AdminDashboard user={user} onClose={() => setShowAdmin(false)} />
        ) : (
          <div>
            {activeTab === 'home' && (
              <HomeFeed
                user={user}
                onSelectListing={handleSelectListing}
                onToggleSave={handleToggleSave}
                savedIds={savedIds}
                unreadNotifications={unreadNotifs}
              />
            )}
            {activeTab === 'search' && (
              <SearchView
                user={user}
                onSelectListing={handleSelectListing}
                onToggleSave={handleToggleSave}
                savedIds={savedIds}
              />
            )}
            {activeTab === 'sell' && (
              <SellView
                user={user}
                onListingCreated={() => setActiveTab('home')}
              />
            )}
            {activeTab === 'messages' && <MessagesView user={user} initialChat={activeChatFromDetail} />}
            {activeTab === 'profile' && (
              <ProfileView
                user={user}
                setUser={setUser}
                onSelectListing={handleSelectListing}
                savedIds={savedIds}
                onToggleSave={handleToggleSave}
                onShowAdmin={() => setShowAdmin(true)}
              />
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadMessages={unreadCount}
      />
    </div>
  );
}
