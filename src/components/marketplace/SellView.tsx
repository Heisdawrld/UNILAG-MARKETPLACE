'use client';

import React, { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { User as UserType, CATEGORIES, CATEGORY_PLACEHOLDER_IMAGES } from '@/lib/types';

export default function SellView({ user, onListingCreated }: { user: UserType; onListingCreated: () => void }) {
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
    
    Array.from(files).slice(0, 5 - images.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to webp for premium fast-loading images
          const dataUrl = canvas.toDataURL('image/webp', 0.8);
          setImages(prev => prev.length >= 5 ? prev : [...prev, dataUrl]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    if (!title || !description || !price || !category || !condition) {
      toast({ title: 'Missing fields', description: 'Fill in all required fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/listings', {
        sellerId: user.id, title, description, price: parseFloat(price), category, condition, negotiable, location,
        images: images.length > 0 ? images : [CATEGORY_PLACEHOLDER_IMAGES[category]],
      });
      toast({ title: 'Listing created!', description: 'Your item is now live' });
      onListingCreated();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  // Seller verification: must complete profile first
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

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h2 className="font-bold text-xl">Sell Something</h2>
      <div>
        <Label className="text-sm font-medium mb-2 block">Photos (max 5)</Label>
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
      <Button onClick={handleSubmit} disabled={submitting} className="w-full h-11">{submitting ? 'Posting...' : 'Post Listing'}</Button>
    </div>
  );
}
