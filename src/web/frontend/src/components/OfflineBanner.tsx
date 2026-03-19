/**
 * OfflineBanner — Network status indicator (US-11, Architecture §1.8)
 *
 * Shows an amber slide-down banner when the device goes offline.
 * Auto-dismisses 2 seconds after reconnection.
 * Uses aria-live="polite" for accessibility.
 */

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { clsx } from 'clsx';

export function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [showBanner, setShowBanner] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOffline = () => {
            setIsOffline(true);
            setShowBanner(true);
        };

        const handleOnline = () => {
            setIsOffline(false);
            // Dismiss after 2s delay so the user sees the "Back online" state
            setTimeout(() => setShowBanner(false), 2000);
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    if (!showBanner) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className={clsx(
                'fixed top-0 left-0 right-0 z-50',
                'flex items-center justify-center gap-2',
                'px-4 py-2.5 text-sm font-medium',
                'transition-all duration-300 ease-out',
                'safe-area-inset',
                isOffline
                    ? 'bg-amber-500/90 text-amber-950 backdrop-blur-sm'
                    : 'bg-emerald-500/90 text-emerald-950 backdrop-blur-sm',
            )}
        >
            <WifiOff size={16} className="shrink-0" />
            <span>
                {isOffline
                    ? 'Offline — data may be stale'
                    : 'Back online ✓'}
            </span>
        </div>
    );
}
