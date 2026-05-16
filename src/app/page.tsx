'use client';

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useUser } from '@clerk/nextjs';
import { Home, Search, PlusCircle, Zap, MessageCircle, User } from 'lucide-react';
import { api } from '@/lib/api';
import { User as UserType, ViewTab, SavedListing } from '@/lib/types';

// Lazy load tab components
const HomeFeed = lazy(() => import('@/components/marketplace/HomeFeed'));
const SearchView = lazy(() => import('@/components/marketplace/SearchView'));
const SellView = lazy(() => import('@/components/marketplace/SellView'));
const TasksView = lazy(() => import('@/components/tasks/TasksView'));
const MessagesView = lazy(() => import('@/components/marketplace/MessagesView'));
const ProfileView = lazy(() => import('@/components/marketplace/ProfileView'));
const ListingDetail = lazy(() => import('@/components/marketplace/ListingDetail'));

// ── Bottom Navigation ──
function BottomNav({ activeTab, onTabChange }: { activeTab: ViewTab; onTabChange: (tab: ViewTab) => void }) {
  const tabs: { id: ViewTab; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'sell', icon: PlusCircle, label: 'Sell' },
    { id: 'tasks', icon: Zap, label: 'Tasks' },
    { id: 'messages', icon: MessageCircle, label: 'Chat' },
    { id: 'profile', icon: User, label: 'Me' },
  ];

  return (
    <nav className="flex-shrink-0 bg-background/95 backdrop-blur-md border-t safe-bottom z-50 w-full">
      <div className="grid grid-cols-6 max-w-lg mx-auto">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id;
          const isSell = id === 'sell';
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`relative flex flex-col items-center justify-center py-2.5 transition-all ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {isSell ? (
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center -mt-4 shadow-lg">
                  <Icon className="w-5 h-5" />
                </div>
              ) : (
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              )}
              <span className="text-[9px] mt-0.5 font-medium">{isSell ? '' : label}</span>
              {isActive && !isSell && (
                <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
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

  // Sync Clerk user → DB user
  useEffect(() => {
    if (!clerkLoaded) return;
    if (!isSignedIn || !clerkUser) { setLoading(false); return; }

    const syncUser = async () => {
      try {
        const data = await api.get('/api/auth/clerk-me');
        if (data?.id) { setUser(data); setLoading(false); return; }
      } catch {}

      const email = clerkUser.primaryEmailAddress?.emailAddress;
      if (email) {
        try {
          const data = await api.get(`/api/auth/me?email=${encodeURIComponent(email)}`);
          if (data?.id) { setUser(data); setLoading(false); return; }
        } catch {}

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
          <img src="/logo.png" alt="UNILAG" className="w-16 h-16 rounded-2xl mx-auto mb-4" />
          <h1 className="font-bold text-xl mb-2">UNILAG Marketplace</h1>
          <p className="text-sm text-muted-foreground mb-4">Setting up your account...</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Retry</button>
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
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Suspense fallback={<TabLoading />}>
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
        </Suspense>
      </main>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
