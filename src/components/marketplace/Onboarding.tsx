'use client';

import React, { useState, useEffect } from 'react';
import { Home, Search, PlusCircle, Route, MessageCircle, User, X, ChevronRight, ChevronLeft, Sparkles, Store } from 'lucide-react';

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to UNILAG Marketplace! 🎉',
    description: 'Your one-stop campus marketplace for buying, selling, and getting things done. Let us show you around!',
    color: 'from-primary/20 to-primary/5',
    iconColor: 'text-primary',
  },
  {
    icon: Home,
    title: 'Home Feed 🏠',
    description: 'Browse trending items, fresh listings, and discover what your fellow students are selling. Find deals right from your hostel!',
    color: 'from-blue-500/20 to-blue-500/5',
    iconColor: 'text-blue-500',
  },
  {
    icon: Search,
    title: 'Search & Filter 🔍',
    description: 'Looking for something specific? Search by name, filter by category, price range, and condition. Find exactly what you need!',
    color: 'from-purple-500/20 to-purple-500/5',
    iconColor: 'text-purple-500',
  },
  {
    icon: Store,
    title: 'Create Your Store 🏪',
    description: 'Want to sell? First, create your store — give it a name, pick your niche, add your logo. Your store is your brand on campus!',
    color: 'from-emerald-500/20 to-emerald-500/5',
    iconColor: 'text-emerald-500',
  },
  {
    icon: PlusCircle,
    title: 'List Products 💰',
    description: 'Once your store is set up, tap the + button to list items. Add photos (we auto-enhance them!), set your price, and go live instantly.',
    color: 'from-green-500/20 to-green-500/5',
    iconColor: 'text-green-500',
  },
  {
    icon: Route,
    title: 'Runner 🚴',
    description: 'Runner is the campus delivery world inside Marketplace. Post requests as a customer, or become a verified runner to earn from errands, pickups, and smart campus logistics.',
    color: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-500',
  },
  {
    icon: MessageCircle,
    title: 'Chat with Sellers 💬',
    description: 'Message sellers directly, negotiate prices, and arrange meetups. When you get your item, confirm it here to leave a review!',
    color: 'from-pink-500/20 to-pink-500/5',
    iconColor: 'text-pink-500',
  },
  {
    icon: User,
    title: 'Your Profile 👤',
    description: 'Complete your profile to build trust. Add your faculty, hostel, and phone number. Choose a premium avatar to stand out!',
    color: 'from-teal-500/20 to-teal-500/5',
    iconColor: 'text-teal-500',
  },
];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem('unilag_onboarding_done');
    if (!done) setVisible(true);
    else onComplete();
  }, [onComplete]);

  const handleSkip = () => {
    localStorage.setItem('unilag_onboarding_done', 'true');
    setVisible(false);
    onComplete();
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleSkip();
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-background rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Gradient header */}
        <div className={`bg-gradient-to-br ${current.color} p-8 flex flex-col items-center text-center relative`}>
          <button onClick={handleSkip} className="absolute top-3 right-3 p-1.5 rounded-full bg-background/50 hover:bg-background/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className={`w-16 h-16 rounded-2xl bg-background/80 flex items-center justify-center mb-4 shadow-lg`}>
            <Icon className={`w-8 h-8 ${current.iconColor}`} />
          </div>
          <h2 className="font-bold text-xl mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        {/* Progress dots + navigation */}
        <div className="p-4">
          {/* Dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`} />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={handlePrev} className="flex-1 h-11 rounded-xl border border-border flex items-center justify-center gap-1 text-sm font-medium hover:bg-muted transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button onClick={handleNext} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-1 text-sm font-medium hover:bg-primary/90 transition-colors">
              {isLast ? "Let's Go! 🚀" : 'Next'} {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {step === 0 && (
            <button onClick={handleSkip} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
              Skip tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
