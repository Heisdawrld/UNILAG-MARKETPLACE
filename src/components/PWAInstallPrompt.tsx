'use client';

import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem('pwa_install_dismissed')) return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: detect Safari and show custom prompt
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);

    if (isIOS && isSafari) {
      // Wait 8 seconds before showing iOS prompt
      const timer = setTimeout(() => setShowIOSPrompt(true), 8000);
      return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (dismissed) return null;

  // Android/Chrome install prompt
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-[80] animate-in slide-in-from-bottom-4 duration-500">
        <div className="max-w-lg mx-auto bg-background border shadow-2xl rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center flex-shrink-0">
            <Download className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Install UNILAG Marketplace</p>
            <p className="text-[11px] text-muted-foreground">Add to home screen for the best experience</p>
          </div>
          <button onClick={handleInstall} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
            Install
          </button>
          <button onClick={handleDismiss} className="p-1 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari install instructions
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-[80] animate-in slide-in-from-bottom-4 duration-500">
        <div className="max-w-lg mx-auto bg-background border shadow-2xl rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Install UNILAG Marketplace</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Tap <Share className="w-3.5 h-3.5 inline text-blue-500 -mt-0.5" /> <strong>Share</strong> at the bottom, then <strong>&quot;Add to Home Screen&quot;</strong>
              </p>
            </div>
            <button onClick={handleDismiss} className="p-1 text-muted-foreground flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
