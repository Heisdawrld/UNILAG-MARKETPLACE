'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, Clock, Eye, Award, RefreshCw, Star, Bell, Smartphone, Laptop, BookOpen, ShoppingBag, Utensils, Dumbbell, Home as HomeIcon, Wrench, LayoutGrid } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { User as UserType, Listing, Notification as AppNotification } from '@/lib/types';
import { getInitials, getListingDisplayAvatar, getListingDisplayName, isListingDisplayVerified } from '@/lib/marketplace-utils';
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

type NotificationData = {
  chatId?: string;
  taskId?: string;
  listingId?: string;
  storeId?: string;
  url?: string;
};

function parseNotificationData(data: string | null | undefined): NotificationData {
  if (!data) return {};

  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default function HomeFeed({
  user, onSelectListing, onToggleSave, savedIds, onOpenMessagesChat, onOpenTasks,
}: {
  user: UserType;
  onSelectListing: (id: string) => void;
  onToggleSave: (id: string) => void;
  savedIds: Set<string>;
  onOpenMessagesChat: (chatId?: string | null) => void;
  onOpenTasks?: (taskId?: string | null) => void;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const fetchListings = useCallback(async () => {
    try {
      const data = await api.get('/api/listings?status=active&limit=20&sort=newest');
      setListings(data.listings || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.get(`/api/notifications?userId=${user.id}`);
      setNotifications(Array.isArray(data) ? data : data?.notifications || []);
    } catch {
      setNotifications([]);
    }
  }, [user.id]);

  // Fetch notifications
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unreadCount = useMemo(() => (notifications || []).filter(n => !n.read).length, [notifications]);
  const boosted = useMemo(() => listings.filter(l => l.boosted), [listings]);
  const recent = useMemo(() => listings.slice(0, 10), [listings]);
  const popular = useMemo(() => [...listings].sort((a, b) => b.views - a.views).slice(0, 6), [listings]);

  const categories = Object.entries(CATEGORY_ICONS);

  const markNotificationsRead = useCallback(async (notificationIds: string[]) => {
    if (notificationIds.length === 0) return;

    setNotifications(prev => prev.map(notif => notificationIds.includes(notif.id) ? { ...notif, read: true } : notif));
    try {
      await api.patch('/api/notifications/read', { userId: user.id, notificationIds });
    } catch {
      fetchNotifications();
    }
  }, [fetchNotifications, user.id]);

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return;

    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    try {
      await api.patch('/api/notifications/read', { userId: user.id, markAll: true });
    } catch {
      fetchNotifications();
    }
  }, [fetchNotifications, unreadCount, user.id]);

  const handleNotificationClick = useCallback((notif: AppNotification) => {
    const data = parseNotificationData(notif.data);
    const relatedNotificationIds = notifications
      .filter((candidate) => {
        if (candidate.id === notif.id) return true;

        const candidateData = parseNotificationData(candidate.data);
        if (notif.type === 'new_message' && data.chatId) {
          return candidate.type === 'new_message' && candidateData.chatId === data.chatId;
        }

        if (data.taskId) {
          return candidateData.taskId === data.taskId;
        }

        return false;
      })
      .map((candidate) => candidate.id);

    if (!notif.read || relatedNotificationIds.length > 1) {
      markNotificationsRead(relatedNotificationIds);
    }

    setShowNotifs(false);

    if (notif.type === 'new_message') {
      onOpenMessagesChat(data.chatId || null);
      return;
    }

    if (notif.type === 'task_application' || notif.type === 'task_accepted' || data.taskId) {
      onOpenTasks?.(data.taskId || null);
      return;
    }

    if (data.listingId) {
      onSelectListing(data.listingId);
      return;
    }

    if (data.url) {
      window.location.assign(data.url);
    }
  }, [markNotificationsRead, notifications, onOpenMessagesChat, onOpenTasks, onSelectListing]);

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
      <div className="sticky top-0 z-30 safe-top bg-background/95 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="UNILAG" className="w-8 h-8 rounded-lg object-cover" />
            <div>
              <h1 className="font-bold text-lg leading-tight">UNILAG Market</h1>
              <p className="text-[10px] text-muted-foreground">Campus Marketplace</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-full hover:bg-muted" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}>
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
        <>
          {/* Backdrop to close on click-outside */}
          <div className="fixed inset-0 z-[100]" onClick={() => setShowNotifs(false)} />
          {/* Dropdown panel — fixed so it escapes parent stacking context */}
          <div className="fixed top-[52px] left-0 right-0 z-[101] px-4">
            <div className="bg-card border rounded-xl shadow-lg overflow-hidden">
              <div className="p-3 border-b flex items-center justify-between">
                <p className="font-semibold text-sm">Notifications</p>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>}
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[10px] font-medium text-primary hover:underline">
                      Mark all as read
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">No notifications yet</p>
                ) : (
                  notifications.slice(0, 10).map(notif => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`block w-full p-3 border-b last:border-0 text-left hover:bg-muted/60 transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                    >
                      <p className="text-xs font-medium">{notif.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{notif.message}</p>
                      {notif.type === 'new_message' && <p className="text-[10px] text-primary font-medium mt-1">Open message</p>}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="px-4 space-y-6 py-4">
        {/* Categories */}
        <section>
          <h2 className="font-bold text-sm mb-3">Browse Categories</h2>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {categories.map(([name, Icon]) => (
              <button key={name} onClick={() => onSelectListing(`cat:${name}`)} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted/80 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[10px] text-center leading-tight font-medium text-muted-foreground line-clamp-2">{name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Trending */}
        {boosted.length > 0 && (
          <section className="relative -mx-4 px-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-lg">Trending 🔥</h2>
            </div>
            {/* Fade edges — hidden on mobile since we use scroll */}
            <div className="hidden md:block absolute left-0 top-10 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10" />
            <div className="hidden md:block absolute right-0 top-10 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10" />
            
            {/* Mobile: scrollable horizontal list; Desktop: marquee animation */}
            <div className="md:overflow-hidden pb-2">
              <div className="flex gap-3 overflow-x-auto md:overflow-hidden md:animate-marquee md:hover:[animation-play-state:paused]">
                {[...boosted, ...boosted, ...boosted].map((listing, i) => (
                  <div key={`${listing.id}-${i}`} className="flex-shrink-0 w-44">
                    <ListingCard listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
                  </div>
                ))}
              </div>
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
            {recent.length > 0 ? recent.map(listing => (
              <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
            )) : (
              <p className="col-span-full text-sm text-muted-foreground text-center py-8">No listings yet</p>
            )}
          </div>
        </section>

        {/* Most Viewed */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h2 className="font-bold text-lg">Most Viewed</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {popular.length > 0 ? popular.map(listing => (
              <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
            )) : (
              <p className="col-span-full text-sm text-muted-foreground text-center py-8">No popular listings yet</p>
            )}
          </div>
        </section>

        {/* Top Sellers */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-emerald-500" />
            <h2 className="font-bold text-lg">Top Sellers</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {Array.from(
              new Map(
                listings
                  .filter((listing) => listing.store || listing.seller.verificationStatus === 'unilag_verified')
                  .map((listing) => [listing.store?.id || listing.seller.id, listing])
              ).values()
            )
              .slice(0, 5)
              .map((listing) => {
                const displayName = getListingDisplayName(listing);
                const displayAvatar = getListingDisplayAvatar(listing);
                const isVerified = isListingDisplayVerified(listing);

                return (
                <div key={listing.store?.id || listing.seller.id} className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border shadow-sm w-20">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={displayAvatar || undefined} />
                    <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] font-medium text-center truncate w-full">{displayName.replace('_', ' ')}</span>
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-[10px]">{listing.seller.ratingAverage.toFixed(1)}</span>
                  </div>
                  {isVerified && <Badge variant="secondary" className="px-1.5 py-0 text-[8px] leading-4">Verified</Badge>}
                </div>
              )})}
          </div>
        </section>
      </div>
    </div>
  );
}
