import { useState, useEffect, useCallback } from 'react';
import { Undo2, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import { useWebSocket } from '../providers/WebSocketProvider';

const UNDO_VISIBLE_MS = 60_000; // 60 seconds per Architecture §1.3

interface UndoFABProps {
    sessionName: string;
}

/**
 * Floating "Undo" action button — appears for 60s after a destructive command completes.
 * Triggers git stash pop on the server to roll back the agent's last changes.
 * 
 * Architecture Ref: §1.3 ("Oh Crap" Undo), Product Spec §8
 * User Story: US-16
 */
export function UndoFAB({ sessionName }: UndoFABProps) {
    const [visible, setVisible] = useState(false);
    const [undoing, setUndoing] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [result, setResult] = useState<'success' | 'error' | null>(null);
    const { subscribe } = useWebSocket();

    // Listen for destructive_completed WS events
    useEffect(() => {
        return subscribe('destructive_completed', (event) => {
            if (event.sessionName === sessionName) {
                setVisible(true);
                setResult(null);

                // Auto-hide after 60s
                const timer = setTimeout(() => {
                    setVisible(false);
                    setShowConfirm(false);
                }, UNDO_VISIBLE_MS);

                return () => clearTimeout(timer);
            }
        });
    }, [subscribe, sessionName]);

    const handleUndo = useCallback(async () => {
        setUndoing(true);
        setResult(null);
        try {
            await api.sessions.undo(sessionName);
            setResult('success');
            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            // Auto-hide after success toast
            setTimeout(() => {
                setVisible(false);
                setShowConfirm(false);
                setResult(null);
            }, 3000);
        } catch {
            setResult('error');
            if (navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 30]);
        } finally {
            setUndoing(false);
        }
    }, [sessionName]);

    if (!visible) return null;

    return (
        <>
            {/* Confirmation Modal */}
            {showConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center pb-32 bg-black/40 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setShowConfirm(false)}
                >
                    <div
                        className="w-full max-w-sm mx-4 bg-bg-elevated border border-border rounded-2xl shadow-float-lg overflow-hidden animate-in slide-in-from-bottom"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5">
                            <h3 className="text-sm font-semibold text-fg-strong mb-1">Roll Back Changes?</h3>
                            <p className="text-xs text-muted leading-relaxed">
                                This will restore the project to its state before the last destructive command using <code className="text-accent font-mono">git stash pop</code>.
                            </p>
                        </div>

                        {result === 'success' && (
                            <div className="mx-5 mb-4 px-3 py-2 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-medium">
                                ✓ Rolled back successfully
                            </div>
                        )}

                        {result === 'error' && (
                            <div className="mx-5 mb-4 px-3 py-2 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
                                ✗ Rollback failed — check terminal
                            </div>
                        )}

                        <div className="flex border-t border-border">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-3.5 text-sm text-muted font-medium hover:bg-surface transition-colors"
                                disabled={undoing}
                            >
                                Cancel
                            </button>
                            <div className="w-px bg-border" />
                            <button
                                onClick={handleUndo}
                                className="flex-1 py-3.5 text-sm text-danger font-semibold hover:bg-danger/10 transition-colors flex items-center justify-center gap-2"
                                disabled={undoing}
                            >
                                {undoing ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Rolling back...
                                    </>
                                ) : (
                                    <>
                                        <Undo2 size={14} />
                                        Undo
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FAB Button — 56×56px, red, bottom-right */}
            <button
                onClick={() => setShowConfirm(true)}
                className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-2xl bg-danger text-white shadow-float-lg flex items-center justify-center hover:bg-danger/90 active:scale-95 transition-all animate-in slide-in-from-bottom"
                aria-label="Undo last destructive action"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <Undo2 size={22} />
            </button>
        </>
    );
}
