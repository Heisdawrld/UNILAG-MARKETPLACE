'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Share2, MapPin, Clock, Eye, Shield, Star, MessageCircle, Phone, ChevronLeft, ChevronRight, CreditCard, Banknote, Lock, AlertTriangle, Flag, MessageSquare, Zap, Loader2, Truck, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { User as UserType, Listing, Review, CONDITION_LABELS, CONDITION_COLORS, BOOST_TIER_CONFIG, BoostTier } from '@/lib/types';
import { formatPrice, timeAgo, getListingImages, getInitials, getListingDisplayAvatar, getListingDisplayName, isListingDisplayVerified } from '@/lib/marketplace-utils';
import { isFeatureEnabled } from '@/lib/features';
import { BOOST_PRICING } from '@/lib/flutterwave';
import { motion, AnimatePresence } from 'framer-motion';

const REPORT_REASONS = [
  { value: 'fake_listing', label: 'Fake or misleading listing' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'illegal_item', label: 'Illegal item' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
];

function ReportForm({ listingId, onClose, toast }: { listingId: string; onClose: () => void; toast: ReturnType<typeof useToast>['toast'] }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await api.post('/api/reports', { listingId, reason });
      toast({ title: 'Report submitted', description: 'Our team will review this listing.' });
      onClose();
    } catch {
      toast({ title: 'Failed to submit report', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 pt-1">
      {REPORT_REASONS.map(r => (
        <button
          key={r.value}
          onClick={() => setReason(r.value)}
          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${reason === r.value ? 'border-destructive bg-destructive/5 text-destructive font-medium' : 'border-border hover:border-muted-foreground/40'}`}
        >
          {r.label}
        </button>
      ))}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" className="flex-1" disabled={!reason || submitting} onClick={handleSubmit}>
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {submitting ? 'Submitting...' : 'Submit Report'}
        </Button>
      </div>
    </div>
  );
}

export default function ListingDetail({
  listingId, user, onBack, onStartChat, isSaved, onToggleSave, onNavigateToDelivery,
}: {
  listingId: string; user: UserType; onBack: () => void;
  onStartChat: (sellerId: string, listingId: string) => void;
  isSaved: boolean; onToggleSave: () => void;
  onNavigateToDelivery?: (listingId: string) => void;
}) {
  const { toast } = useToast();
  const isDeliveryEnabled = isFeatureEnabled('DELIVERY_SYSTEM');
  const isBoostEnabled = isFeatureEnabled('BOOST_SYSTEM');
  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBoost, setShowBoost] = useState(false);
  const [boostingPlan, setBoostingPlan] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
  const conditionClass = CONDITION_COLORS[listing.condition as keyof typeof CONDITION_COLORS] || CONDITION_COLORS.good;
  const displayName = getListingDisplayName(listing);
  const displayAvatar = getListingDisplayAvatar(listing);
  const isVerifiedDisplay = isListingDisplayVerified(listing);
  const contactPhone = listing.store?.phone || listing.seller.phone;
  const contactWhatsapp = listing.store?.whatsapp || listing.seller.whatsapp;

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
        <div className="absolute top-0 left-0 right-0 safe-top flex items-center justify-between p-3 bg-gradient-to-b from-black/40 to-transparent">
          <button onClick={onBack} className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button onClick={() => {
              const shareData = { title: listing?.title || 'UNILAG Marketplace', text: `Check out "${listing?.title}" on UNILAG Marketplace!`, url: window.location.href };
              if (navigator.share) {
                navigator.share(shareData).catch(() => {});
              } else {
                navigator.clipboard?.writeText(window.location.href);
                toast({ title: 'Link copied!' });
              }
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
            <button onClick={() => setCurrentImage(i => Math.max(0, i - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/30 backdrop-blur-sm text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentImage(i => Math.min(images.length - 1, i + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/30 backdrop-blur-sm text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
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
        {/* Is this available? Quick Action */}
        {!isOwner && listing.status === 'active' && (
          <button
            onClick={async () => {
              try {
                // Create or get existing chat
                const chatData = await api.post('/api/chats', {
                  buyerId: user.id,
                  sellerId: listing.sellerId,
                  listingId: listing.id,
                });
                if (chatData?.id) {
                  // Send the quick message
                  await api.post('/api/messages', {
                    chatId: chatData.id,
                    senderId: user.id,
                    message: 'Is this still available?',
                  });
                  toast({ title: 'Message sent!', description: '"Is this still available?" sent to the seller.' });
                  onStartChat(listing.sellerId, listing.id);
                }
              } catch (e) {
                console.error(e);
                toast({ title: 'Failed to send message', variant: 'destructive' });
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <HelpCircle className="w-4 h-4" /> Is this available?
          </button>
        )}

        {/* Title & Price */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold leading-tight flex-1">{listing.title}</h1>
            <Badge className={`flex-shrink-0 text-xs ${conditionClass}`}>
              {CONDITION_LABELS[listing.condition] || listing.condition}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold text-primary">{formatPrice(listing.price)}</p>
            {listing.negotiable && <Badge variant="secondary" className="text-xs">Negotiable</Badge>}
          </div>
          {/* Boost Status Indicator (owner only, when boost system enabled) */}
          {isOwner && isBoostEnabled && listing.boosted && (
            <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <div className="flex-1">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {listing.boostTier ? (BOOST_TIER_CONFIG[listing.boostTier]?.label || 'Basic') : 'Basic'} Boost Active
                </span>
                {listing.boostedUntil && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-500 ml-1.5">
                    {new Date(listing.boostedUntil) > new Date()
                      ? `Expires ${timeAgo(listing.boostedUntil).replace('ago', '').trim()} left`
                      : 'Expired'
                    }
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowBoost(true)}
                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                Extend
              </button>
            </div>
          )}
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

        {/* Store Card */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={displayAvatar} />
                <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate max-w-[160px]">{displayName}</span>
                  {isVerifiedDisplay && (
                    <Shield className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-medium">{listing.seller.ratingAverage.toFixed(1)}</span>
                  </div>
                  {listing.store ? (
                    <span className="text-xs text-muted-foreground">Official store</span>
                  ) : listing.seller.faculty && (
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
        {!isOwner && (
          <button onClick={() => setShowReport(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
            <Flag className="w-3.5 h-3.5" /> Report this listing
          </button>
        )}

        {/* Spacer for bottom bar */}
        <div className="h-20" />
      </div>

      {/* Bottom Action Bar */}
      {isOwner ? (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t px-4 py-3 safe-bottom z-50 relative">
          <div className="flex gap-2 max-w-lg mx-auto">
            {isBoostEnabled && listing.status === 'active' && (
              <Button onClick={() => setShowBoost(true)} className="h-11 flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-md shadow-amber-500/20">
                <Zap className="w-4 h-4 mr-1.5 fill-current" /> Boost Listing
              </Button>
            )}
            {listing.status === 'active' && (
              <Button variant="outline" className="h-11 flex-1" onClick={async () => {
                try {
                  await api.patch(`/api/listings/${listing.id}`, { status: 'sold' });
                  toast({ title: 'Marked as sold!' });
                  onBack();
                } catch { toast({ title: 'Failed to update', variant: 'destructive' }); }
              }}>
                Mark Sold
              </Button>
            )}
            <Button variant="destructive" className="h-11 px-3" onClick={() => setShowDeleteConfirm(true)}>
              Delete
            </Button>
            {showDeleteConfirm && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border rounded-xl p-3 shadow-lg z-10">
                <p className="text-sm font-medium text-destructive mb-1">Are you sure?</p>
                <p className="text-xs text-muted-foreground mb-3">This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                  <Button variant="destructive" className="flex-1 h-9 text-xs" onClick={async () => {
                    try {
                      await api.del(`/api/listings/${listing.id}`);
                      toast({ title: 'Listing deleted' });
                      onBack();
                    } catch { toast({ title: 'Failed to delete', variant: 'destructive' }); }
                  }}>Confirm Delete</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t px-4 py-3 safe-bottom z-50">
          <div className="flex gap-2 max-w-lg mx-auto">
            {contactPhone && (
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => window.open(`tel:${contactPhone}`)}>
                <Phone className="w-5 h-5" />
              </Button>
            )}
            {contactWhatsapp && (
              <Button variant="outline" size="icon" className="h-11 w-11 text-emerald-600" onClick={() => window.open(`https://wa.me/${contactWhatsapp.replace(/^0/, '234')}?text=${encodeURIComponent(`Hi, I'm interested in your listing: ${listing.title} (${formatPrice(listing.price)}) on UNILAG Marketplace`)}`)}>
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
          {/* Get it Delivered row — V2 feature */}
          {isDeliveryEnabled && onNavigateToDelivery && (
          <div className="mt-2 max-w-lg mx-auto">
            <Button
              variant="outline"
              className="w-full h-10 border-dashed text-sm"
              onClick={() => onNavigateToDelivery(listing.id)}
            >
              <Truck className="w-4 h-4 mr-2" /> Get it Delivered
            </Button>
          </div>
          )}
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
                Secure payments powered by Flutterwave will be available soon. For now, message the store directly to arrange payment.
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={() => {
              setShowPayment(false);
              onStartChat(listing.seller.id, listing.id);
            }}>
              <MessageCircle className="w-4 h-4 mr-2" /> Message Store Instead
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-destructive" /> Report Listing
            </DialogTitle>
            <DialogDescription>Select a reason and we'll review this listing promptly.</DialogDescription>
          </DialogHeader>
          <ReportForm listingId={listing.id} onClose={() => setShowReport(false)} toast={toast} />
        </DialogContent>
      </Dialog>

      {/* Boost Modal — V1 Pricing (Basic / Premium / Elite) */}
      <Dialog open={showBoost} onOpenChange={setShowBoost}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" /> Boost Listing
            </DialogTitle>
            <DialogDescription>
              Get more visibility and sell faster. Boosted listings appear in the Trending section and rank higher in search.
            </DialogDescription>
          </DialogHeader>

          {/* Current boost status */}
          {listing.boosted && listing.boostTier && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Currently on {BOOST_TIER_CONFIG[listing.boostTier]?.label || 'Basic'} Boost
                {listing.boostedUntil && new Date(listing.boostedUntil) > new Date() && (
                  <> — expires {timeAgo(listing.boostedUntil)}</>
                )}
              </span>
            </div>
          )}

          <div className="space-y-3 pt-1">
            {([
              {
                id: 'basic' as BoostTier,
                name: 'BASIC BOOST',
                price: BOOST_PRICING.basic.price,
                priceLabel: `₦${BOOST_PRICING.basic.price.toLocaleString()}`,
                duration: '3 days',
                tier: BOOST_TIER_CONFIG.basic,
                benefits: ['Trending section placement', 'Boost badge on listing', 'Higher search ranking'],
              },
              {
                id: 'premium' as BoostTier,
                name: 'PREMIUM BOOST',
                price: BOOST_PRICING.premium.price,
                priceLabel: `₦${BOOST_PRICING.premium.price.toLocaleString()}`,
                duration: '7 days',
                tier: BOOST_TIER_CONFIG.premium,
                popular: true,
                benefits: ['Trending section priority', 'Hot badge on listing', 'Top search ranking', 'Category page priority'],
              },
              {
                id: 'elite' as BoostTier,
                name: 'ELITE BOOST',
                price: BOOST_PRICING.elite.price,
                priceLabel: `₦${BOOST_PRICING.elite.price.toLocaleString()}`,
                duration: '14 days',
                tier: BOOST_TIER_CONFIG.elite,
                benefits: ['Trending section top spot', 'Elite crown badge', 'Highest search priority', 'Category page top spot', 'Maximum visibility'],
              },
            ]).map(plan => (
              <div key={plan.id} className={`relative p-4 rounded-xl border-2 transition-all ${plan.popular ? 'border-orange-500 bg-orange-500/5' : 'border-muted hover:border-amber-500/50'}`}>
                {plan.popular && (
                  <span className="absolute -top-3 right-4 px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                    Most Popular
                  </span>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-sm tracking-tight">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground font-medium">{plan.duration}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-lg text-primary">{plan.priceLabel}</span>
                  </div>
                </div>
                <div className="space-y-1 mt-3">
                  {plan.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Zap className="w-3 h-3 text-amber-500" /> {benefit}
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full mt-4 bg-primary hover:bg-primary/90"
                  disabled={boostingPlan === plan.id}
                  onClick={async () => {
                    setBoostingPlan(plan.id);
                    try {
                      const durationHours = BOOST_PRICING[plan.id].durationHours;
                      const durationDays = durationHours / 24;

                      // Initiate payment through the proper payment flow
                      const result = await api.post('/api/payments/initialize', {
                        type: 'boost',
                        listingId: listing.id,
                        amount: plan.price,
                      });

                      if (result.link) {
                        // Redirect to Flutterwave payment page
                        window.location.href = result.link;
                      } else if (result.isLocked) {
                        // Payments locked — use /api/boosts directly (dev/mock mode)
                        await api.post('/api/boosts', {
                          listingId: listing.id,
                          amount: plan.price,
                          durationDays,
                          flutterwaveTxRef: result.txRef,
                          planId: plan.id,
                        });
                        toast({ title: 'Listing Boosted!', description: `Your listing is now ${plan.name} for ${plan.duration}!` });
                        setShowBoost(false);
                        // Reload listing to reflect boost status
                        const updated = await api.get(`/api/listings/${listingId}`);
                        setListing(updated);
                      }
                    } catch {
                      toast({ title: 'Boost Failed', variant: 'destructive' });
                    } finally {
                      setBoostingPlan(null);
                    }
                  }}
                >
                  {boostingPlan === plan.id ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Processing...</>
                  ) : (
                    <>Pay {plan.priceLabel}</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
