'use client';

import React, { useState, useEffect } from 'react';
import { Camera, X, Store as StoreIcon, Sparkles, ArrowRight, Check, MapPin, Clock, Instagram, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { User as UserType, Store, CATEGORIES, CATEGORY_PLACEHOLDER_IMAGES, STORE_CATEGORIES } from '@/lib/types';

// ── Image compression utilities (reused) ──
function compressImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
        else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, w, h);

        // Blur detection + auto-enhance
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const gray = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
        }
        let sum = 0, sumSq = 0, count = 0;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const lap = gray[(y - 1) * w + x] + gray[(y + 1) * w + x] + gray[y * w + x - 1] + gray[y * w + x + 1] - 4 * gray[y * w + x];
            sum += lap; sumSq += lap * lap; count++;
          }
        }
        const variance = count > 0 ? (sumSq / count) - (sum / count) ** 2 : 0;
        if (variance < 100) {
          const copy = new Uint8ClampedArray(data);
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              for (let c = 0; c < 3; c++) {
                const i = (y * w + x) * 4 + c;
                const blur = (copy[((y - 1) * w + x) * 4 + c] + copy[((y + 1) * w + x) * 4 + c] + copy[(y * w + x - 1) * 4 + c] + copy[(y * w + x + 1) * 4 + c]) / 4;
                data[i] = Math.min(255, Math.max(0, copy[i] + (copy[i] - blur) * 0.6));
              }
            }
          }
          for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < 3; c++) {
              data[i + c] = Math.min(255, Math.max(0, ((data[i + c] / 255 - 0.5) * 1.1 + 0.5) * 255));
            }
          }
          ctx.putImageData(imageData, 0, 0);
        }

        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Store Setup Flow ──
function StoreSetupFlow({ user, onStoreCreated }: { user: UserType; onStoreCreated: (store: Store) => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState('');
  const [phone, setPhone] = useState(user.phone || '');
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || '');
  const [instagram, setInstagram] = useState('');
  const [address, setAddress] = useState('');
  const [openHours, setOpenHours] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 300, 0.85);
    setLogo(compressed);
  };

  const handleCreate = async () => {
    if (!name.trim() || !category) {
      toast({ title: 'Missing info', description: 'Store name and category are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const store = await api.post('/api/stores', {
        ownerId: user.id, name, category, description, logo,
        phone, whatsapp, instagram, address, openHours,
      });
      toast({ title: '🎉 Store Created!', description: `${name} is now live!` });
      onStoreCreated(store);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="safe-top p-4 space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-amber-500/20 flex items-center justify-center mx-auto mb-3">
          <StoreIcon className="w-8 h-8 text-primary" />
        </div>
        <h2 className="font-bold text-xl">Create Your Store</h2>
        <p className="text-sm text-muted-foreground mt-1">Set up your shop to start selling on UNILAG Marketplace</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex items-center ${s < 3 ? 'gap-2' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-primary' : 'bg-muted'} transition-all`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Store Name *</Label>
            <Input placeholder="e.g., TechZone UNILAG" value={name} onChange={e => setName(e.target.value)} maxLength={50} />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">What does your store sell? *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select your niche" /></SelectTrigger>
              <SelectContent>
                {STORE_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Description</Label>
            <Textarea placeholder="What makes your store special? What do you sell?" value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={500} />
          </div>
          <Button onClick={() => setStep(2)} disabled={!name || !category} className="w-full h-11 gap-2">
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Logo & Location */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Store Logo</Label>
            <div className="flex items-center gap-4">
              {logo ? (
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/30">
                  <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <label className="w-20 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                  <Camera className="w-6 h-6 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground">Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              )}
              <p className="text-xs text-muted-foreground flex-1">A good logo builds trust. Upload your brand logo or a clear photo.</p>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Campus Location</Label>
            <Input placeholder="e.g., Inside Jaja Hall, New Hall Complex" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Business Hours</Label>
            <Input placeholder="e.g., Mon-Sat 9am-7pm" value={openHours} onChange={e => setOpenHours(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11">Back</Button>
            <Button onClick={() => setStep(3)} className="flex-1 h-11 gap-2">Next <ArrowRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* Step 3: Contact & Social */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone Number</Label>
            <Input placeholder="08012345678" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</Label>
            <Input placeholder="08012345678" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5" /> Instagram Handle</Label>
            <Input placeholder="@yourbrand" value={instagram} onChange={e => setInstagram(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-11">Back</Button>
            <Button onClick={handleCreate} disabled={submitting} className="flex-1 h-11 gap-2 bg-gradient-to-r from-primary to-amber-600 hover:from-primary/90 hover:to-amber-600/90">
              {submitting ? 'Creating...' : <><Sparkles className="w-4 h-4" /> Launch Store</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Sell View ──
export default function SellView({ user, onListingCreated }: { user: UserType; onListingCreated: () => void }) {
  const { toast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [negotiable, setNegotiable] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Check if user has a store
  useEffect(() => {
    api.get(`/api/stores?ownerId=${user.id}`)
      .then((stores: Store[]) => {
        if (stores.length > 0) setStore(stores[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingStore(false));
  }, [user.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files).slice(0, 5 - images.length)) {
      const compressed = await compressImage(file, 800, 0.8);
      if (compressed) {
        setImages(prev => prev.length >= 5 ? prev : [...prev, compressed]);
      }
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !price || !category || !condition) {
      toast({ title: 'Missing fields', description: 'Fill in all required fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/listings', {
        sellerId: user.id,
        storeId: store?.id || null,
        title, description, price: parseFloat(price), category, condition, negotiable, location,
        images: images.length > 0 ? images : [CATEGORY_PLACEHOLDER_IMAGES[category]],
      });
      toast({ title: '✅ Listing Live!', description: 'Your item is now visible to buyers' });
      onListingCreated();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  // Loading state
  if (loadingStore) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  // Profile not complete
  const profileComplete = user.faculty && user.phone && user.hostel;
  if (!profileComplete) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
          <Camera className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="font-bold text-xl mb-2">Complete Your Profile First</h2>
        <p className="text-sm text-muted-foreground mb-1 max-w-xs">
          To sell on UNILAG Marketplace, you need to verify your identity by completing your profile.
        </p>
        <p className="text-xs text-muted-foreground mb-4">Add your <strong>faculty</strong>, <strong>phone number</strong>, and <strong>hostel</strong>.</p>
        <p className="text-[11px] text-muted-foreground/60">Go to the <strong>Me</strong> tab → Edit Profile</p>
      </div>
    );
  }

  // No store yet → show store creation flow
  if (!store) {
    return <StoreSetupFlow user={user} onStoreCreated={(s) => setStore(s)} />;
  }

  // Has store → show listing form with store badge
  return (
    <div className="safe-top p-4 space-y-5 max-w-lg mx-auto">
      {/* Store header */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 to-amber-500/5">
        <CardContent className="p-3 flex items-center gap-3">
          {store.logo ? (
            <img src={store.logo} alt={store.name} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <StoreIcon className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{store.name}</p>
            <p className="text-[10px] text-muted-foreground">Posting to your store</p>
          </div>
          <Badge variant="outline" className="text-[10px]">{store.category}</Badge>
        </CardContent>
      </Card>

      <h2 className="font-bold text-xl">Add New Listing</h2>

      {/* Photos */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Photos (max 5)</Label>
        <p className="text-[11px] text-muted-foreground mb-2">We automatically clean up, sharpen, and optimize your product photos before they go live.</p>
        <div className="flex gap-2 flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {images.length < 5 && (
            <label className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
              <Camera className="w-5 h-5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground mt-0.5">Add</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>
      </div>

      {/* Form fields */}
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Title *</Label>
        <Input placeholder="e.g., iPhone 13 Pro Max - 256GB" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
      </div>
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Description *</Label>
        <Textarea placeholder="Describe your item..." value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={1000} />
      </div>
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Price (₦) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₦</span>
          <Input type="number" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} className="pl-8" min="0" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Category *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Condition *</Label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brand_new">Brand New</SelectItem>
              <SelectItem value="like_new">Like New</SelectItem>
              <SelectItem value="fairly_used">Fairly Used</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Location</Label>
        <Input placeholder="e.g., Moremi Hall" value={location} onChange={e => setLocation(e.target.value)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-sm">Negotiable</Label>
        <Switch checked={negotiable} onCheckedChange={setNegotiable} />
      </div>
      <Button onClick={handleSubmit} disabled={submitting} className="w-full h-11">{submitting ? 'Posting...' : '🚀 Post Listing'}</Button>
    </div>
  );
}
