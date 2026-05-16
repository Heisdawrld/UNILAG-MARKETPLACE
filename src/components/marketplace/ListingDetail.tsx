'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Share2, MapPin, Clock, Eye, Shield, Star, MessageCircle, Phone, ChevronLeft, ChevronRight, CreditCard, Banknote, Lock, AlertTriangle, Flag, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { User as UserType, Listing, Review, CONDITION_LABELS, CONDITION_COLORS } from '@/lib/types';
import { formatPrice, timeAgo, getListingImages, getInitials } from '@/lib/marketplace-utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function ListingDetail({
  listingId, user, onBack, onStartChat, isSaved, onToggleSave,
}: {
  listingId: string; user: UserType; onBack: () => void;
  onStartChat: (sellerId: string, listingId: string) => void;
  isSaved: boolean; onToggleSave: () => void;
}) {
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get(`/api/listings/${listingId}`);
        setListing(data);
        if (data?.seller?.id) {
          api.get(`/api/reviews?sellerId=${data.seller.id}`).then(setReviews).catch(() => {});
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [listingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Listing not found</p>
        <Button variant="outline" onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  const images = getListingImages(listing.images, listing.category);
  const isOwner = listing.sellerId === user.id;
  const conditionClass = CONDITION_COLORS[listing.condition] || CONDITION_COLORS.fairly_used;

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Image Gallery */}
      <div className="relative aspect-square bg-muted">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentImage}
            src={images[currentImage]}
            alt={listing.title}
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </AnimatePresence>

        {/* Nav overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/40 to-transparent">
          <button onClick={onBack} className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              toast({ title: 'Link copied!' });
            }} className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white">
              <Share2 className="w-5 h-5" />
            </button>
            <button onClick={onToggleSave} className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white">
              <Heart className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Image dots */}
        {images.length > 1 && (
          <>
            <button onClick={() => setCurrentImage(i => Math.max(0, i - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/30 backdrop-blur-sm text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentImage(i => Math.min(images.length - 1, i + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/30 backdrop-blur-sm text-white">
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setCurrentImage(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentImage ? 'bg-white w-4' : 'bg-white/50'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title & Price */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold leading-tight flex-1">{listing.title}</h1>
            <Badge className={`flex-shrink-0 text-xs ${conditionClass}`}>
              {CONDITION_LABELS[listing.condition] || listing.condition}
            </Badge>
          </div>
          <p className="text-2xl font-bold text-primary mt-1">{formatPrice(listing.price)}</p>
          {listing.negotiable && <Badge variant="secondary" className="mt-1.5 text-xs">Negotiable</Badge>}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {listing.location && (
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{listing.location}</span>
          )}
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{timeAgo(listing.createdAt)}</span>
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{listing.views} views</span>
        </div>

        <Separator />

        {/* Description */}
        <div>
          <h2 className="font-semibold text-sm mb-2">Description</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{listing.description}</p>
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
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm">{listing.seller.username}</span>
                  {listing.seller.verificationStatus === 'unilag_verified' && (
                    <Shield className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-medium">{listing.seller.ratingAverage.toFixed(1)}</span>
                  </div>
                  {listing.seller.faculty && (
                    <span className="text-xs text-muted-foreground">{listing.seller.faculty}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Seller Reviews Preview */}
            {reviews.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
                {reviews.slice(0, 2).map(review => (
                  <div key={review.id} className="bg-muted/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-medium">{review.reviewer.username}</span>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-2.5 h-2.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Safety Tips */}
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/10">
          <CardContent className="p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-medium mb-0.5">Safety Tips</p>
              <ul className="space-y-0.5 text-amber-600 dark:text-amber-500">
                <li>• Meet in public places on campus</li>
                <li>• Inspect items before paying</li>
                <li>• Don&apos;t send money to strangers</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Report */}
        <button onClick={() => toast({ title: 'Report submitted', description: 'Our team will review this listing' })} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
          <Flag className="w-3.5 h-3.5" /> Report this listing
        </button>

        {/* Spacer for bottom bar */}
        <div className="h-20" />
      </div>

      {/* Bottom Action Bar */}
      {isOwner ? (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t px-4 py-3 safe-bottom z-50">
          <div className="flex gap-2 max-w-lg mx-auto">
            {listing.status === 'active' && (
              <Button variant="outline" className="h-11 flex-1" onClick={async () => {
                try {
                  await api.patch(`/api/listings/${listing.id}`, { status: 'sold' });
                  toast({ title: 'Marked as sold!' });
                  onBack();
                } catch { toast({ title: 'Failed to update', variant: 'destructive' }); }
              }}>
                Mark as Sold
              </Button>
            )}
            <Button variant="destructive" className="h-11 flex-1" onClick={async () => {
              if (!confirm('Delete this listing?')) return;
              try {
                await api.del(`/api/listings/${listing.id}`);
                toast({ title: 'Listing deleted' });
                onBack();
              } catch { toast({ title: 'Failed to delete', variant: 'destructive' }); }
            }}>
              Delete Listing
            </Button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t px-4 py-3 safe-bottom z-50">
          <div className="flex gap-2 max-w-lg mx-auto">
            {listing.seller.phone && (
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => window.open(`tel:${listing.seller.phone}`)}>
                <Phone className="w-5 h-5" />
              </Button>
            )}
            {listing.seller.whatsapp && (
              <Button variant="outline" size="icon" className="h-11 w-11 text-emerald-600" onClick={() => window.open(`https://wa.me/${listing.seller.whatsapp.replace(/^0/, '234')}?text=${encodeURIComponent(`Hi, I'm interested in your listing: ${listing.title} (${formatPrice(listing.price)}) on UNILAG Marketplace`)}`)}>
                <MessageSquare className="w-5 h-5" />
              </Button>
            )}
            <Button variant="outline" className="h-11 flex-1" onClick={() => onStartChat(listing.seller.id, listing.id)}>
              <MessageCircle className="w-4 h-4 mr-2" /> Message
            </Button>
            <Button className="h-11 flex-1" onClick={() => setShowPayment(true)}>
              <CreditCard className="w-4 h-4 mr-2" /> Buy Now
            </Button>
          </div>
        </div>
      )}

      {/* Payment Modal (Inactive) */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Secure Payment
            </DialogTitle>
            <DialogDescription>Pay safely through UNILAG Marketplace</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <img src={images[0]} alt="" className="w-14 h-14 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{listing.title}</p>
                  <p className="text-lg font-bold text-primary">{formatPrice(listing.price)}</p>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Payment Method</p>
              {[
                { icon: CreditCard, label: 'Card Payment', desc: 'Visa, Mastercard, Verve' },
                { icon: Banknote, label: 'Bank Transfer', desc: 'Pay via bank transfer' },
              ].map(({ icon: Icon, label, desc }) => (
                <button key={label} className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Coming Soon Notice */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
              <Lock className="w-6 h-6 text-primary mx-auto mb-1.5" />
              <p className="text-sm font-semibold text-primary">Coming Soon</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Secure payments powered by Flutterwave will be available soon. For now, message the seller directly to arrange payment.
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={() => {
              setShowPayment(false);
              onStartChat(listing.seller.id, listing.id);
            }}>
              <MessageCircle className="w-4 h-4 mr-2" /> Message Seller Instead
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
