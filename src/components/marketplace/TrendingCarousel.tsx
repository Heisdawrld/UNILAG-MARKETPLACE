'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Listing, BOOST_TIER_CONFIG, BoostTier } from '@/lib/types';
import { ListingCard } from './ListingCard';

interface TrendingCarouselProps {
  listings: Listing[];
  onSelectListing: (id: string) => void;
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
}

/**
 * Auto-scrolling horizontal carousel for Trending section.
 * Features:
 * - Smooth auto-scroll that pauses on hover/touch
 * - Manual navigation arrows (desktop)
 * - Tier-ordered: Elite → Premium → Basic → Popular
 * - Seamless loop using duplicated items
 */
export default function TrendingCarousel({
  listings,
  onSelectListing,
  savedIds,
  onToggleSave,
}: TrendingCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const animationRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArrowUpdateRef = useRef(0);
  const speedRef = useRef(0.5); // pixels per frame (~30px/s at 60fps)

  // Sort listings by tier: Elite → Premium → Basic → popular (by views)
  const sortedListings = [...listings].sort((a, b) => {
    const aTier = a.boostTier && BOOST_TIER_CONFIG[a.boostTier as BoostTier]
      ? BOOST_TIER_CONFIG[a.boostTier as BoostTier].priority
      : 0;
    const bTier = b.boostTier && BOOST_TIER_CONFIG[b.boostTier as BoostTier]
      ? BOOST_TIER_CONFIG[b.boostTier as BoostTier].priority
      : 0;
    if (bTier !== aTier) return bTier - aTier;
    return b.views - a.views;
  });

  // Triple the listings for seamless looping
  const displayListings = [...sortedListings, ...sortedListings, ...sortedListings];

  // Auto-scroll animation — uses refs only, no setState in the hot path
  const animate = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    if (!isPausedRef.current) {
      el.scrollLeft += speedRef.current;

      // When we've scrolled past the second set, jump back to first set seamlessly
      const singleSetWidth = el.scrollWidth / 3;
      if (el.scrollLeft >= singleSetWidth * 2) {
        el.scrollLeft -= singleSetWidth;
      }
    }

    // Throttle arrow visibility updates to ~4 times/second (every 250ms)
    const now = Date.now();
    if (now - lastArrowUpdateRef.current > 250) {
      lastArrowUpdateRef.current = now;
      const singleSetWidth = el.scrollWidth / 3;
      setShowLeftArrow(el.scrollLeft > singleSetWidth * 0.1);
      setShowRightArrow(el.scrollLeft < singleSetWidth * 2.5);
    }

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Start in the middle set so we can scroll both directions
    const el = scrollRef.current;
    if (el && listings.length > 0) {
      // Defer to next frame so layout has settled
      requestAnimationFrame(() => {
        const singleSetWidth = el.scrollWidth / 3;
        if (singleSetWidth > 0) {
          el.scrollLeft = singleSetWidth;
        }
      });
    }

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [animate, listings.length]);

  const pause = useCallback(() => {
    isPausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
  }, []);

  const resumeAfterDelay = useCallback(() => {
    // Clear any existing timer
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isPausedRef.current = false;
      resumeTimerRef.current = null;
    }, 3000);
  }, []);

  const scrollByCards = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 180; // approximate card width + gap
    el.scrollBy({ left: direction === 'right' ? cardWidth * 2 : -cardWidth * 2, behavior: 'smooth' });
  };

  if (listings.length === 0) return null;

  return (
    <section className="relative -mx-4 px-4">
      {/* Navigation arrows (desktop only) */}
      {showLeftArrow && (
        <button
          onClick={() => scrollByCards('left')}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 dark:bg-black/70 shadow-md items-center justify-center hover:bg-white dark:hover:bg-black/90 transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {showRightArrow && (
        <button
          onClick={() => scrollByCards('right')}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 dark:bg-black/70 shadow-md items-center justify-center hover:bg-white dark:hover:bg-black/90 transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Fade edges */}
      <div className="hidden md:block absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="hidden md:block absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-none pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resumeAfterDelay}
      >
        {displayListings.map((listing, i) => (
          <div key={`${listing.id}-${i}`} className="flex-shrink-0 w-44">
            <ListingCard
              listing={listing}
              onClick={() => onSelectListing(listing.id)}
              isSaved={savedIds.has(listing.id)}
              onToggleSave={() => onToggleSave(listing.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
