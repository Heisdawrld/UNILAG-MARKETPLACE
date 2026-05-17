'use client';

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useUser, SignInButton } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Search, PlusCircle, Zap, MessageCircle, User, Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { User as UserType, ViewTab, SavedListing } from '@/lib/types';
import { usePushNotifications } from '@/hooks/use-push';

// Lazy load tab components
const HomeFeed = lazy(() => import('@/components/marketplace/HomeFeed'));
const SearchView = lazy(() => import('@/components/marketplace/SearchView'));
const SellView = lazy(() => import('@/components/marketplace/SellView'));
const TasksView = lazy(() => import('@/components/tasks/TasksView'));
const MessagesView = lazy(() => import('@/components/marketplace/MessagesView'));
const ProfileView = lazy(() => import('@/components/marketplace/ProfileView'));
const ListingDetail = lazy(() => import('@/components/marketplace/ListingDetail'));
import Onboarding from '@/components/marketplace/Onboarding';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

// ── Bottom Navigation ──
function BottomNav({ activeTab, onTabChange }: { activeTab: ViewTab; onTabChange: (tab: ViewTab) => void }) {
  const leftTabs: { id: ViewTab; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Explore' },
  ];
  const rightTabs: { id: ViewTab; icon: typeof Home; label: string }[] = [
    { id: 'tasks', icon: Zap, label: 'Tasks' },
    { id: 'messages', icon: MessageCircle, label: 'Chat' },
    { id: 'profile', icon: User, label: 'Me' },
  ];

  const renderTab = (id: ViewTab, Icon: typeof Home, label: string) => {
    const isActive = activeTab === id;
    return (
      <button key={id} onClick={() => onTabChange(id)} className={`relative flex flex-col items-center justify-center py-2.5 px-2 transition-all ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
        <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
        <span className="text-[9px] mt-0.5 font-medium">{label}</span>
        {isActive && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />}
      </button>
    );
  };

  return (
    <nav className="flex-shrink-0 bg-background/95 backdrop-blur-md border-t safe-bottom z-50 w-full">
      <div className="flex items-center justify-between max-w-lg mx-auto px-1">
        <div className="flex flex-1 justify-around">
          {leftTabs.map(({ id, icon, label }) => renderTab(id, icon, label))}
        </div>
        <button onClick={() => onTabChange('sell')} className="relative -mt-5 mx-1 flex-shrink-0">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${activeTab === 'sell' ? 'bg-primary scale-110 shadow-primary/30' : 'bg-primary hover:scale-105'}`}>
            <PlusCircle className="w-7 h-7 text-primary-foreground" />
          </div>
        </button>
        <div className="flex flex-1 justify-around">
          {rightTabs.map(({ id, icon, label }) => renderTab(id, icon, label))}
        </div>
      </div>
    </nav>
  );
}

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Main App ──
export default function MarketplaceApp() {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('home');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const { permission, isSubscribed, isSupported, subscribe } = usePushNotifications(user?.id || null);

  // Sync Clerk user → DB user
  useEffect(() => {
    if (!clerkLoaded) return;
    if (!isSignedIn || !clerkUser) { setLoading(false); return; }

    const syncUser = async () => {
      try {
        const data = await api.get('/api/auth/clerk-me');
        if (data?.id) { setUser(data); setLoading(false); return; }
      } catch { }

      const email = clerkUser.primaryEmailAddress?.emailAddress;
      if (email) {
        try {
          const data = await api.get(`/api/auth/me?email=${encodeURIComponent(email)}`);
          if (data?.id) { setUser(data); setLoading(false); return; }
        } catch { }

        try {
          const data = await api.post('/api/auth/register', {
            clerkId: clerkUser.id,
            username: clerkUser.username || clerkUser.firstName || email.split('@')[0],
            email,
            avatar: clerkUser.imageUrl,
          });
          if (data?.id) setUser(data);
        } catch (e) { console.error('Failed to register user:', e); }
      }
      setLoading(false);
    };
    syncUser();
  }, [clerkLoaded, isSignedIn, clerkUser]);

  // Load saved listings
  useEffect(() => {
    if (!user) return;
    api.get(`/api/saved?userId=${user.id}`)
      .then((data: SavedListing[]) => setSavedIds(new Set(data.map(s => s.listingId))))
      .catch(console.error);
  }, [user]);

  // Show push prompt after a delay if not subscribed
  useEffect(() => {
    if (!user || !isSupported || isSubscribed || permission === 'denied') return;
    const dismissed = localStorage.getItem('push_prompt_dismissed');
    if (dismissed) return;
    const timer = setTimeout(() => setShowPushPrompt(true), 5000);
    return () => clearTimeout(timer);
  }, [user, isSupported, isSubscribed, permission]);

  const handleToggleSave = useCallback(async (listingId: string) => {
    if (!user) return;
    const isSaved = savedIds.has(listingId);
    try {
      if (isSaved) {
        await api.del(`/api/saved?userId=${user.id}&listingId=${listingId}`);
        setSavedIds(prev => { const n = new Set(prev); n.delete(listingId); return n; });
      } else {
        await api.post('/api/saved', { userId: user.id, listingId });
        setSavedIds(prev => new Set(prev).add(listingId));
      }
    } catch (e) { console.error(e); }
  }, [user, savedIds]);

  const handleTabChange = useCallback((tab: ViewTab) => {
    setActiveTab(tab);
    setSelectedListingId(null);
    setSelectedCategory('');
  }, []);

  const handleSelectListing = useCallback((id: string) => {
    if (id.startsWith('cat:')) {
      setSelectedCategory(id.replace('cat:', ''));
      setActiveTab('search');
    } else {
      setSelectedListingId(id);
    }
  }, []);

  const handleStartChat = useCallback(async (sellerId: string, listingId: string) => {
    if (!user) return;
    try {
      await api.post('/api/chats', { buyerId: user.id, sellerId, listingId });
      setSelectedListingId(null);
      setActiveTab('messages');
    } catch (e) { console.error(e); }
  }, [user]);

  // Loading screen
  if (!clerkLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img src="/logo.png" alt="UNILAG" className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-lg" />
          <h1 className="font-bold text-xl mb-1">UNILAG Marketplace</h1>
          <p className="text-sm text-muted-foreground">Loading campus marketplace...</p>
          <div className="mt-4 w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <img src="/logo.png" alt="UNILAG" className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-lg" />
          <h1 className="font-bold text-2xl mb-2">UNILAG Marketplace</h1>
          {!isSignedIn ? (
            <>
              <p className="text-sm text-muted-foreground mb-8">Buy, sell & run errands safely on campus.</p>
              <SignInButton mode="modal">
                <button className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-base font-bold shadow-md hover:bg-primary/90 transition-colors">
                  Get Started
                </button>
              </SignInButton>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4 animate-pulse">Setting up your account...</p>
              <div className="mt-4 w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </>
          )}
        </div>
      </div>
    );
  }

  // Listing Detail View
  if (selectedListingId) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background">
        <main className="flex-1 min-h-0 overflow-hidden">
          <Suspense fallback={<TabLoading />}>
            <ListingDetail
              listingId={selectedListingId}
              user={user}
              onBack={() => setSelectedListingId(null)}
              onStartChat={handleStartChat}
              isSaved={savedIds.has(selectedListingId)}
              onToggleSave={() => handleToggleSave(selectedListingId)}
            />
          </Suspense>
        </main>
      </div>
    );
  }


  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {!onboarded && <Onboarding onComplete={() => setOnboarded(true)} />}

      {/* Push Notification Prompt */}
      <AnimatePresence>
        {showPushPrompt && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="absolute top-0 left-0 right-0 z-[90] p-3 bg-primary/95 backdrop-blur-sm text-primary-foreground shadow-lg"
          >
            <div className="flex items-center gap-3 max-w-lg mx-auto">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Enable Notifications 🔔</p>
                <p className="text-[11px] opacity-80">Get alerts for messages, task updates & more</p>
              </div>
              <button
                onClick={async () => {
                  await subscribe();
                  setShowPushPrompt(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-white text-primary text-xs font-bold flex-shrink-0"
              >
                Enable
              </button>
              <button
                onClick={() => {
                  setShowPushPrompt(false);
                  localStorage.setItem('push_prompt_dismissed', 'true');
                }}
                className="text-white/60 text-xs"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
        <Suspense fallback={<TabLoading />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              {activeTab === 'home' && (
                <HomeFeed user={user} onSelectListing={handleSelectListing} onToggleSave={handleToggleSave} savedIds={savedIds} />
              )}
              {activeTab === 'search' && (
                <SearchView user={user} onSelectListing={handleSelectListing} onToggleSave={handleToggleSave} savedIds={savedIds} initialCategory={selectedCategory} />
              )}
              {activeTab === 'sell' && (
                <SellView user={user} onListingCreated={() => setActiveTab('home')} />
              )}
              {activeTab === 'tasks' && <TasksView user={user} />}
              {activeTab === 'messages' && <MessagesView user={user} />}
              {activeTab === 'profile' && (
                <ProfileView user={user} setUser={setUser} onSelectListing={setSelectedListingId} savedIds={savedIds} onToggleSave={handleToggleSave} />
              )}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>
      <PWAInstallPrompt />
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
