'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Star, Shield, Edit3, LogOut, Save, X, ChevronRight, Camera } from 'lucide-react';
import { useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { User as UserType, Listing, SavedListing } from '@/lib/types';
import { getInitials } from '@/lib/marketplace-utils';
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

export default function ProfileView({
  user, setUser, onSelectListing, savedIds, onToggleSave,
}: {
  user: UserType; setUser: (u: UserType) => void; onSelectListing: (id: string) => void;
  savedIds: Set<string>; onToggleSave: (id: string) => void;
}) {
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileTab, setProfileTab] = useState<'listings' | 'saved'>('listings');

  // Edit form state
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

  useEffect(() => {
    Promise.all([
      api.get(`/api/listings?sellerId=${user.id}&limit=50`).then(data => setMyListings(data.listings || [])).catch(console.error),
      api.get(`/api/saved?userId=${user.id}`).then((data: SavedListing[]) => setSavedListings(data.map(s => s.listing))).catch(console.error),
    ]).finally(() => setLoading(false));
  }, [user.id]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await api.patch(`/api/auth/me`, {
        userId: user.id,
        ...editForm,
      });
      setUser({ ...user, ...updated, avatar: editForm.avatar || user.avatar });
      setShowEdit(false);
      toast({ title: 'Profile updated!' });
    } catch (e) {
      toast({ title: 'Failed to update profile', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const activeCount = myListings.filter(l => l.status === 'active').length;
  const soldCount = myListings.filter(l => l.status === 'sold').length;

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">Profile</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowEdit(true)}>
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut()}>
            <LogOut className="w-4 h-4 text-destructive" />
          </Button>
        </div>
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

            {/* User Details */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {user.faculty && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-muted-foreground">Faculty</p>
                  <p className="font-medium">{user.faculty}</p>
                </div>
              )}
              {user.department && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium">{user.department}</p>
                </div>
              )}
              {user.level && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-muted-foreground">Level</p>
                  <p className="font-medium">{user.level}</p>
                </div>
              )}
              {user.hostel && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-muted-foreground">Hostel</p>
                  <p className="font-medium">{user.hostel}</p>
                </div>
              )}
              {user.phone && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{user.phone}</p>
                </div>
              )}
              {user.whatsapp && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{user.whatsapp}</p>
                </div>
              )}
            </div>

            {/* Profile completion status */}
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

        {/* Tabs: My Listings / Saved */}
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
              <p className="text-sm text-muted-foreground py-6 text-center">No listings yet — go to the Sell tab to post your first item!</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {myListings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={savedIds.has(listing.id)} onToggleSave={() => onToggleSave(listing.id)} />
                ))}
              </div>
            )
          ) : (
            savedListings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No saved items yet — tap the ❤️ on listings to save them!</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {savedListings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} isSaved={true} onToggleSave={() => onToggleSave(listing.id)} />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-sm mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Avatar Picker */}
            <div>
              <Label className="text-xs font-medium mb-2 block">Choose Avatar or Upload</Label>
              <div className="grid grid-cols-6 gap-2 mb-2">
                {/* Custom Upload Button */}
                <label className="w-11 h-11 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/30">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX = 400;
                        let w = img.width; let h = img.height;
                        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
                        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0, w, h);
                        setEditForm(p => ({ ...p, avatar: canvas.toDataURL('image/webp', 0.8) }));
                      };
                      img.src = event.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
                {['alpha', 'bravo', 'coral', 'delta', 'echo', 'frost', 'gold', 'haze', 'iris', 'jade', 'luna'].map(seed => {
                  const url = `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`;
                  return (
                    <button key={seed} onClick={() => setEditForm(p => ({ ...p, avatar: url }))} className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all ${editForm.avatar === url ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-muted hover:border-primary/40'}`}>
                      <img src={url} alt={seed} className="w-full h-full" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Username</Label>
              <Input value={editForm.username} onChange={e => setEditForm(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Bio</Label>
              <Textarea placeholder="Tell people about yourself..." value={editForm.bio} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))} rows={3} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Phone</Label>
                <Input placeholder="08012345678" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">WhatsApp</Label>
                <Input placeholder="08012345678" value={editForm.whatsapp} onChange={e => setEditForm(p => ({ ...p, whatsapp: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Faculty</Label>
              <Select value={editForm.faculty} onValueChange={v => setEditForm(p => ({ ...p, faculty: v }))}>
                <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                <SelectContent>{FACULTIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Department</Label>
              <Input placeholder="e.g. Computer Science" value={editForm.department} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Level</Label>
                <Select value={editForm.level} onValueChange={v => setEditForm(p => ({ ...p, level: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Hostel</Label>
                <Select value={editForm.hostel} onValueChange={v => setEditForm(p => ({ ...p, hostel: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{HOSTELS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full h-11">
              <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
