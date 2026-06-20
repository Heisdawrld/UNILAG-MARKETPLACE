'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Edit3,
  ExternalLink,
  LogOut,
  MapPin,
  Save,
  Settings,
  Shield,
  Star,
  Store as StoreIcon,
  Trash2,
  Users,
  PlusCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { Listing, SavedListing, Store, STORE_CATEGORIES, User as UserType, BOOST_TIER_CONFIG } from '@/lib/types';
import { getInitials, formatPrice, timeAgo } from '@/lib/marketplace-utils';
import { ListingCard } from './ListingCard';

const FACULTIES = [
  'Arts', 'Business Administration', 'Education', 'Engineering',
  'Environmental Sciences', 'Law', 'Medicine', 'Pharmacy',
  'Sciences', 'Social Sciences',
];

const LEVELS = ['100', '200', '300', '400', '500', '600', 'Postgrad', 'Alumni'];

const HOSTELS = [
  'Moremi Hall', 'Amina Hall', 'Kofo Hall', 'Madam Tinubu Hall',
  'Mariere Hall', 'Eni Njoku Hall', 'Jaja Hall', 'Sodeinde Hall',
  'Biobaku Hall', 'Makama Hall', 'El-Kanemi Hall', 'Honours Hall',
  'New Hall', 'Off Campus',
];

async function compressClientImage(file: File, maxSize = 600, quality = 0.84): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > maxSize) {
            h *= maxSize / w;
            w = maxSize;
          }
        } else if (h > maxSize) {
          w *= maxSize / h;
          h = maxSize;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfileView({
  user,
  setUser,
  onSelectListing,
  savedIds,
  onToggleSave,
  onOpenSell,
}: {
  user: UserType;
  setUser: (u: UserType) => void;
  onSelectListing: (id: string) => void;
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
  onOpenSell: () => void;
}) {
  const { signOut, isSignedIn } = useClerk();
  const { toast } = useToast();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [myStore, setMyStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showStoreManager, setShowStoreManager] = useState(false);
  const [showMyStore, setShowMyStore] = useState(false);
  const [storeDetail, setStoreDetail] = useState<Store | null>(null);
  const [storeDetailLoading, setStoreDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'listings' | 'saved'>('listings');

  const [editForm, setEditForm] = useState({
    username: user.username,
    avatar: user.avatar || '',
    bio: user.bio || '',
    phone: user.phone || '',
    whatsapp: user.whatsapp || '',
    faculty: user.faculty || '',
    department: user.department || '',
    level: user.level || '',
    hostel: user.hostel || '',
  });

  const [storeForm, setStoreForm] = useState({
    name: '',
    category: '',
    description: '',
    logo: '',
    phone: '',
    whatsapp: '',
    instagram: '',
    address: '',
    openHours: '',
  });

  useEffect(() => {
    setEditForm({
      username: user.username,
      avatar: user.avatar || '',
      bio: user.bio || '',
      phone: user.phone || '',
      whatsapp: user.whatsapp || '',
      faculty: user.faculty || '',
      department: user.department || '',
      level: user.level || '',
      hostel: user.hostel || '',
    });
  }, [user]);

  useEffect(() => {
    Promise.all([
      api.get(`/api/listings?sellerId=${user.id}&limit=50&status=all`).then((data) => setMyListings(data.listings || [])).catch(console.error),
      api.get(`/api/saved?userId=${user.id}`).then((data: SavedListing[]) => setSavedListings(data.map((saved) => saved.listing))).catch(console.error),
      api.get(`/api/stores?ownerId=${user.id}&limit=1`).then((stores: Store[]) => setMyStore(stores[0] || null)).catch(console.error),
    ]).finally(() => setLoading(false));
  }, [user.id]);

  useEffect(() => {
    if (!myStore) return;
    setStoreForm({
      name: myStore.name || '',
      category: myStore.category || '',
      description: myStore.description || '',
      logo: myStore.logo || '',
      phone: myStore.phone || '',
      whatsapp: myStore.whatsapp || '',
      instagram: myStore.instagram || '',
      address: myStore.address || '',
      openHours: myStore.openHours || '',
    });
  }, [myStore]);

  const activeCount = useMemo(() => myListings.filter((listing) => listing.status === 'active').length, [myListings]);
  const soldCount = useMemo(() => myListings.filter((listing) => listing.status === 'sold').length, [myListings]);
  const storeListings = useMemo(() => myListings.filter((listing) => listing.status !== 'removed'), [myListings]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await api.patch('/api/auth/me', { userId: user.id, ...editForm });
      setUser({ ...user, ...updated, avatar: editForm.avatar || user.avatar });
      setShowEdit(false);
      toast({ title: 'Profile updated!' });
    } catch {
      toast({ title: 'Failed to update profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStore = async () => {
    if (!myStore) return;
    setSavingStore(true);
    try {
      const updatedStore = await api.patch('/api/stores', {
        storeId: myStore.id,
        ...storeForm,
      });
      setMyStore(updatedStore);
      toast({ title: 'Store updated!' });
      setShowStoreManager(false);
    } catch (error) {
      toast({
        title: 'Failed to update store',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSavingStore(false);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    setDeletingListingId(listingId);
    try {
      await api.del(`/api/listings/${listingId}`);
      setMyListings((prev) => prev.filter((listing) => listing.id !== listingId));
      toast({ title: 'Product removed from your store' });
    } catch {
      toast({ title: 'Failed to remove product', variant: 'destructive' });
    } finally {
      setDeletingListingId(null);
    }
  };

  const loadStoreDetail = async () => {
    if (!myStore) return;
    setStoreDetailLoading(true);
    try {
      const detail = await api.get(`/api/stores/${myStore.id}`);
      setStoreDetail(detail);
      setShowMyStore(true);
    } catch {
      toast({ title: 'Failed to load store details', variant: 'destructive' });
    } finally {
      setStoreDetailLoading(false);
    }
  };

  if (showMyStore && storeDetail) {
    const store = storeDetail as Store & {
      listings?: Listing[];
      owner?: { id: string; username: string; avatar?: string; bio?: string; verificationStatus?: string; ratingAverage?: number; totalReviews?: number; phone?: string; whatsapp?: string; createdAt?: string };
      _count?: { listings?: number; followers?: number };
      isFollowing?: boolean;
    };
    const listingCount = store._count?.listings ?? store.listings?.length ?? 0;
    const followerCount = store._count?.followers ?? store.followCount ?? 0;

    return (
      <div className="pb-4">
        <div className="sticky top-0 z-30 safe-top bg-background/95 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setShowMyStore(false); setStoreDetail(null); }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-bold text-lg">My Store</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowStoreManager(true)}>
            <Settings className="w-3.5 h-3.5 mr-1.5" /> Manage
          </Button>
        </div>

        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-amber-500/10">
          {store.banner && <img src={store.banner} alt="" className="w-full h-full object-cover" />}
        </div>

        <div className="px-4 -mt-8 relative z-10">
          <div className="flex items-end gap-3">
            {store.logo ? (
              <img src={store.logo} alt={store.name} className="w-16 h-16 rounded-2xl object-cover border-4 border-background shadow-lg" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border-4 border-background shadow-lg flex items-center justify-center">
                <StoreIcon className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-lg">{store.name}</h2>
                {store.isVerified && <Shield className="w-4 h-4 text-emerald-500" />}
              </div>
              <Badge variant="outline" className="text-[10px]">{store.category}</Badge>
            </div>
          </div>

          {store.description && (
            <p className="text-sm text-muted-foreground mt-3">{store.description}</p>
          )}

          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="text-center">
              <p className="font-bold">{listingCount}</p>
              <p className="text-[10px] text-muted-foreground">Products</p>
            </div>
            <div className="text-center">
              <p className="font-bold">{followerCount}</p>
              <p className="text-[10px] text-muted-foreground">Followers</p>
            </div>
            {store.rating != null && store.rating > 0 && (
              <div className="text-center">
                <p className="font-bold flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {store.rating.toFixed(1)}</p>
                <p className="text-[10px] text-muted-foreground">Rating</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {store.phone && (
              <a href={`tel:${store.phone}`} className="text-[11px] px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">Call</a>
            )}
            {store.whatsapp && (
              <a href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium flex items-center gap-1">WhatsApp</a>
            )}
            {store.instagram && (
              <a href={`https://instagram.com/${store.instagram.replace('@', '')}`} target="_blank" className="text-[11px] px-3 py-1.5 rounded-full bg-pink-500/10 text-pink-600 font-medium flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Instagram</a>
            )}
          </div>

          {store.address && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> {store.address}</p>
          )}
          {store.openHours && (
            <p className="text-xs text-muted-foreground mt-1"> {store.openHours}</p>
          )}

          <div className="flex gap-2 mt-4">
            <Button className="flex-1" size="sm" onClick={() => setShowStoreManager(true)}>
              <Settings className="w-3.5 h-3.5 mr-1.5" /> Edit Store
            </Button>
            <Button className="flex-1" size="sm" variant="outline" onClick={onOpenSell}>
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Add Product
            </Button>
          </div>
        </div>

        <div className="px-4 mt-6">
          <h3 className="font-bold text-sm mb-3">Products ({store.listings?.length || 0})</h3>
          <div className="grid grid-cols-2 gap-3">
            {store.listings?.map((listing: Listing) => (
              <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
            ))}
          </div>
          {(!store.listings || store.listings.length === 0) && (
            <p className="text-center py-8 text-sm text-muted-foreground">No products listed yet</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-30 safe-top bg-background/95 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">Profile</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowEdit(true)}>
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 h-9" onClick={() => {
            try {
              if (isSignedIn) {
                signOut({ redirectUrl: '/' });
              } else {
                // Fallback: just redirect if not signed in
                window.location.href = '/';
              }
            } catch {
              // If signOut fails (Clerk misconfigured), just redirect
              window.location.href = '/';
            }
          }}>
            <LogOut className="w-4 h-4 text-destructive" />
            <span className="text-xs text-destructive">Logout</span>
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
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

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {user.faculty && <InfoBox label="Faculty" value={user.faculty} />}
              {user.department && <InfoBox label="Department" value={user.department} />}
              {user.level && <InfoBox label="Level" value={user.level} />}
              {user.hostel && <InfoBox label="Hostel" value={user.hostel} />}
              {user.phone && <InfoBox label="Phone" value={user.phone} />}
              {user.whatsapp && <InfoBox label="WhatsApp" value={user.whatsapp} />}
            </div>

            {(!user.faculty || !user.phone || !user.hostel) ? (
              <button onClick={() => setShowEdit(true)} className="mt-3 w-full flex items-center justify-between p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-left transition-colors hover:bg-primary/10">
                <div>
                  <p className="text-xs font-medium text-primary">Complete your profile</p>
                  <p className="text-[10px] text-muted-foreground">Add faculty, phone, hostel to build trust</p>
                </div>
                <ChevronRight className="w-4 h-4 text-primary" />
              </button>
            ) : (
              <button onClick={() => setShowEdit(true)} className="mt-3 w-full flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-left transition-colors hover:bg-emerald-500/20">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <p className="text-xs font-medium text-emerald-600">Profile completed ✅</p>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-600" />
              </button>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <StatCard value={activeCount} label="Active" valueClassName="text-primary" />
          <StatCard value={soldCount} label="Sold" valueClassName="text-emerald-600" />
          <StatCard value={user.totalReviews} label="Reviews" />
        </div>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {myStore ? (
              <div className="p-4 bg-gradient-to-r from-primary/5 to-amber-500/5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {myStore.logo ? <img src={myStore.logo} alt={myStore.name} className="w-full h-full object-cover" /> : <StoreIcon className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{myStore.name}</p>
                    <p className="text-[10px] text-muted-foreground">{storeListings.length} product{storeListings.length !== 1 ? 's' : ''} · {myStore.category}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Seller</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => setShowStoreManager(true)}>
                    <Settings className="w-3.5 h-3.5 mr-1.5" /> Manage
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1" onClick={loadStoreDetail} disabled={storeDetailLoading}>
                    <StoreIcon className="w-3.5 h-3.5 mr-1.5" /> View Store
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={onOpenSell}>
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Add
                  </Button>
                </div>
              </div>
            ) : (
              <button onClick={onOpenSell} className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <StoreIcon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Create Your Store</p>
                  <p className="text-[10px] text-muted-foreground">You are currently a buyer. Create a store to sell products or services.</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </CardContent>
        </Card>

        <div>
          <div className="flex gap-1 mb-3 bg-muted/50 rounded-lg p-0.5">
            <button onClick={() => setProfileTab('listings')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${profileTab === 'listings' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
              My Listings ({myListings.length})
            </button>
            <button onClick={() => setProfileTab('saved')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${profileTab === 'saved' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
              Saved ({savedListings.length})
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : profileTab === 'listings' ? (
            myListings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No listings yet — create a store and start posting from the Sell tab.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {myListings.map((listing) => (
                  <div key={listing.id} className="relative group">
                    <ListingCard listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
                    {/* Boost CTA for active, non-boosted listings */}
                    {listing.status === 'active' && !listing.boosted && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectListing(listing.id); }}
                        className="absolute top-2 right-2 z-10 p-1 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600 transition-colors"
                        aria-label="Boost listing"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}
                    {/* Boost status for already-boosted listings */}
                    {listing.boosted && listing.boostTier && (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[8px] font-bold">
                        <Zap className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        {BOOST_TIER_CONFIG[listing.boostTier]?.label || 'Boosted'}
                      </div>
                    )}
                    {/* Sold overlay label */}
                    {listing.status === 'sold' && (
                      <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-full bg-black/80 text-white text-[8px] font-bold">SOLD</div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            savedListings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No saved items yet — tap the ❤️ on listings to save them!</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {savedListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved onToggleSave={() => onToggleSave(listing.id)} />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-sm mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium mb-2 block">Choose Avatar or Upload</Label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-2">
                <label className="w-11 h-11 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/30">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const avatar = await compressClientImage(file, 400, 0.8);
                    setEditForm((prev) => ({ ...prev, avatar }));
                  }} />
                </label>
                {['alpha', 'bravo', 'coral', 'delta', 'echo', 'frost', 'gold', 'haze', 'iris', 'jade', 'luna'].map((seed) => {
                  const url = `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`;
                  return (
                    <button key={seed} onClick={() => setEditForm((prev) => ({ ...prev, avatar: url }))} className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all ${editForm.avatar === url ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-muted hover:border-primary/40'}`}>
                      <img src={url} alt={seed} className="w-full h-full" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Username</Label>
              <Input value={editForm.username} onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Bio</Label>
              <Textarea placeholder="Tell people about yourself..." value={editForm.bio} onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))} rows={3} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Phone</Label>
                <Input placeholder="08012345678" value={editForm.phone} onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">WhatsApp</Label>
                <Input placeholder="08012345678" value={editForm.whatsapp} onChange={(e) => setEditForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Faculty</Label>
              <Select value={editForm.faculty} onValueChange={(value) => setEditForm((prev) => ({ ...prev, faculty: value }))}>
                <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                <SelectContent>{FACULTIES.map((faculty) => <SelectItem key={faculty} value={faculty}>{faculty}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Department</Label>
              <Input placeholder="e.g. Computer Science" value={editForm.department} onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Level</Label>
                <Select value={editForm.level} onValueChange={(value) => setEditForm((prev) => ({ ...prev, level: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{LEVELS.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Hostel</Label>
                <Select value={editForm.hostel} onValueChange={(value) => setEditForm((prev) => ({ ...prev, hostel: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{HOSTELS.map((hostel) => <SelectItem key={hostel} value={hostel}>{hostel}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full h-11">
              <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showStoreManager} onOpenChange={setShowStoreManager}>
        <DialogContent className="max-w-lg mx-auto max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Your Store</DialogTitle>
          </DialogHeader>
          {myStore ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden bg-muted/20">
                  {storeForm.logo ? <img src={storeForm.logo} alt="Store logo" className="w-full h-full object-cover" /> : <Camera className="w-5 h-5 text-muted-foreground" />}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const logo = await compressClientImage(file, 600, 0.84);
                    setStoreForm((prev) => ({ ...prev, logo }));
                  }} />
                </label>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Update your store branding</p>
                  <p>Store photos are auto-cleaned and optimized before they go live.</p>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Store Name</Label>
                <Input value={storeForm.name} onChange={(e) => setStoreForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Store Category</Label>
                <Select value={storeForm.category} onValueChange={(value) => setStoreForm((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select store category" /></SelectTrigger>
                  <SelectContent>{STORE_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Description</Label>
                <Textarea value={storeForm.description} onChange={(e) => setStoreForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} maxLength={500} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Phone</Label>
                  <Input value={storeForm.phone} onChange={(e) => setStoreForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">WhatsApp</Label>
                  <Input value={storeForm.whatsapp} onChange={(e) => setStoreForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Instagram</Label>
                <Input value={storeForm.instagram} onChange={(e) => setStoreForm((prev) => ({ ...prev, instagram: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Address</Label>
                <Input value={storeForm.address} onChange={(e) => setStoreForm((prev) => ({ ...prev, address: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Open Hours</Label>
                <Input value={storeForm.openHours} onChange={(e) => setStoreForm((prev) => ({ ...prev, openHours: e.target.value }))} />
              </div>
              <Button onClick={handleSaveStore} disabled={savingStore} className="w-full">
                <Save className="w-4 h-4 mr-2" /> {savingStore ? 'Saving...' : 'Save Store Changes'}
              </Button>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Products in Store</p>
                  <Button variant="outline" size="sm" onClick={onOpenSell}>
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Add Product
                  </Button>
                </div>
                {storeListings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No products yet. Add your first listing from the Sell tab.</p>
                ) : (
                  <div className="space-y-2">
                    {storeListings.map((listing) => (
                      <div key={listing.id} className="flex items-center gap-3 rounded-xl border p-3">
                        <button className="flex-1 min-w-0 text-left" onClick={() => { setShowStoreManager(false); onSelectListing(listing.id); }}>
                          <p className="text-sm font-medium truncate">{listing.title}</p>
                          <p className="text-[11px] text-muted-foreground">₦{listing.price.toLocaleString()} · {listing.status}</p>
                        </button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingListingId === listing.id}
                          onClick={() => handleDeleteListing(listing.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Create a store from the Sell tab first.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatCard({ value, label, valueClassName = '' }: { value: number; label: string; valueClassName?: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 text-center">
        <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
