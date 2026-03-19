/**
 * SWUpdatePrompt — Service Worker update notification (US-11)
 *
 * Detects new service worker versions and prompts the user to refresh.
 * Sends SKIP_WAITING to the new SW and reloads the page.
 */

import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export function SWUpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const checkForUpdate = async () => {
            try {
                const registration = await navigator.serviceWorker.ready;

                // Check if there's already a waiting worker
                if (registration.waiting) {
                    setWaitingWorker(registration.waiting);
                    setShowPrompt(true);
                }

                // Listen for new updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New SW installed while old one still active = update available
                            setWaitingWorker(newWorker);
                            setShowPrompt(true);
                        }
                    });
                });
            } catch (err) {
                console.warn('SW update check failed:', err);
            }
        };

        checkForUpdate();
    }, []);

    const handleRefresh = () => {
        if (waitingWorker) {
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });

            // Reload once the new SW takes control
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex justify-center safe-area-inset">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface border border-border shadow-xl max-w-sm w-full">
                <RefreshCw size={18} className="text-accent shrink-0" />
                <span className="text-sm text-fg-strong flex-1">
                    New version available
                </span>
                <button
                    onClick={handleRefresh}
                    className="btn btn-primary text-sm px-3 py-1.5 rounded-lg"
                >
                    Refresh
                </button>
                <button
                    onClick={() => setShowPrompt(false)}
                    className="btn btn-ghost p-1.5 rounded-lg"
                    aria-label="Dismiss update"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
