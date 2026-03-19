/**
 * IOSInstallBanner - Prompts iOS users to install PWA for push notifications
 * 
 * iOS 16.4+ requires PWA to be installed to home screen for web push to work.
 * This component detects iOS Safari and shows an install banner.
 */

import { useState, useEffect } from 'react';
import { X, Smartphone, ArrowRight } from 'lucide-react';
import { useToast } from './Toast';

interface IOSInstallBannerProps {
  /** Unique key to persist dismissal in localStorage */
  dismissKey?: string;
}

export function IOSInstallBanner({ dismissKey = 'ios-install-banner' }: IOSInstallBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem(dismissKey);
    if (dismissed) return;

    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;

    // Show banner only on iOS Safari and not already installed
    if (isIOS && isSafari && !isStandalone) {
      setIsVisible(true);
    }
  }, [dismissKey]);

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, 'true');
    setIsVisible(false);
  };

  const handleLearnMore = () => {
    toast.info('Tap the Share button → "Add to Home Screen" to install');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:hidden">
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-lg animate-slide-up">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-muted hover:text-fg"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="p-2 bg-accent-soft rounded-xl">
            <Smartphone size={20} className="text-accent" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-fg-strong">
              Install OpenSofa for Push Notifications
            </h3>
            <p className="text-xs text-muted mt-1">
              Tap the Share button → "Add to Home Screen" to enable notifications
            </p>
            
            <button
              onClick={handleLearnMore}
              className="mt-3 flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-medium"
            >
              How to install
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
