import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, GitMerge } from 'lucide-react';
import { clsx } from 'clsx';
import { useResponsive } from '../hooks/useResponsive';
import { api } from '../utils/api';

interface ConflictMarker {
    filePath: string;
    current: string;   // HEAD content
    incoming: string;   // Remote content
    startLine: number;
    endLine: number;
}

interface MergeConflictUIProps {
    sessionName: string;
    conflicts: ConflictMarker[];
    onResolved?: () => void;
}

type Resolution = 'current' | 'incoming' | 'both';

/**
 * Visual 3-way merge conflict resolver (US-22).
 * Stacked panels on mobile, side-by-side on desktop.
 * Detects <<<<<<< HEAD markers on server side.
 * 
 * Architecture Ref: §1.5 Merge Conflicts
 */
export function MergeConflictUI({ sessionName, conflicts, onResolved }: MergeConflictUIProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [resolving, setResolving] = useState(false);
    const [resolved, setResolved] = useState<Set<number>>(new Set());
    const { isMobile } = useResponsive();

    const conflict = conflicts[currentIndex];
    const totalConflicts = conflicts.length;

    const handleResolve = useCallback(async (resolution: Resolution) => {
        if (!conflict) return;

        setResolving(true);
        try {
            await api.sessions.resolveConflict(sessionName, conflict.filePath, resolution);

            setResolved(prev => new Set(prev).add(currentIndex));
            if (navigator.vibrate) navigator.vibrate(50);

            // Auto-advance to next unresolved
            if (currentIndex < totalConflicts - 1) {
                setTimeout(() => setCurrentIndex(prev => prev + 1), 500);
            } else {
                // All resolved
                onResolved?.();
            }
        } catch (err) {
            console.error('Failed to resolve conflict:', err);
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
        } finally {
            setResolving(false);
        }
    }, [conflict, sessionName, currentIndex, totalConflicts, onResolved]);

    if (!conflict) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted text-sm p-6 animate-fade-in">
                <GitMerge size={28} className="text-success mb-3" />
                <p className="font-medium text-fg-strong">All conflicts resolved!</p>
            </div>
        );
    }

    const isResolved = resolved.has(currentIndex);
    const fileName = conflict.filePath.split('/').pop() || conflict.filePath;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-lg bg-warning-soft">
                        <GitMerge size={16} className="text-warning" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium text-fg-strong truncate" title={conflict.filePath}>
                            {fileName}
                        </h3>
                        <p className="text-xs text-muted">
                            Lines {conflict.startLine}–{conflict.endLine}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted font-mono">
                        {currentIndex + 1}/{totalConflicts}
                    </span>
                    {isResolved && (
                        <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-semibold">
                            Resolved
                        </span>
                    )}
                </div>
            </div>

            {/* Conflict panels */}
            <div className={clsx(
                'flex-1 overflow-hidden',
                isMobile ? 'flex flex-col' : 'grid grid-cols-2'
            )}>
                {/* Current (HEAD) */}
                <div className={clsx(
                    'flex flex-col border-border',
                    isMobile ? 'flex-1 border-b' : 'border-r'
                )}>
                    <div className="px-4 py-2 bg-accent-soft/50 border-b border-border flex-shrink-0">
                        <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                            Current (HEAD)
                        </span>
                    </div>
                    <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-fg whitespace-pre bg-bg leading-relaxed">
                        {conflict.current}
                    </pre>
                </div>

                {/* Incoming (remote) */}
                <div className="flex flex-col flex-1">
                    <div className="px-4 py-2 bg-success/5 border-b border-border flex-shrink-0">
                        <span className="text-xs font-semibold text-success uppercase tracking-wider">
                            Incoming (Remote)
                        </span>
                    </div>
                    <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-fg whitespace-pre bg-bg leading-relaxed">
                        {conflict.incoming}
                    </pre>
                </div>
            </div>

            {/* Resolution buttons — each ≥48px per spec */}
            <div className="flex-shrink-0 border-t border-border bg-surface p-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => handleResolve('current')}
                        disabled={resolving || isResolved}
                        className="flex-1 py-3 rounded-xl text-sm font-medium bg-accent-soft text-accent hover:bg-accent/20 disabled:opacity-40 transition-colors min-h-[48px] flex items-center justify-center gap-2"
                    >
                        {isResolved ? <Check size={14} /> : null}
                        Accept Current
                    </button>
                    <button
                        onClick={() => handleResolve('incoming')}
                        disabled={resolving || isResolved}
                        className="flex-1 py-3 rounded-xl text-sm font-medium bg-success/10 text-success hover:bg-success/20 disabled:opacity-40 transition-colors min-h-[48px] flex items-center justify-center gap-2"
                    >
                        Accept Incoming
                    </button>
                    <button
                        onClick={() => handleResolve('both')}
                        disabled={resolving || isResolved}
                        className="flex-1 py-3 rounded-xl text-sm font-medium bg-surface-elevated text-fg hover:bg-border disabled:opacity-40 transition-colors min-h-[48px] flex items-center justify-center gap-2"
                    >
                        Accept Both
                    </button>
                </div>
            </div>

            {/* Conflict navigation — swipe between if multiple */}
            {totalConflicts > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface flex-shrink-0">
                    <button
                        className="touch-target flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-muted hover:text-fg disabled:opacity-30 transition-colors"
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentIndex === 0}
                        aria-label="Previous conflict"
                    >
                        <ChevronLeft size={16} />
                        Prev
                    </button>
                    <div className="flex gap-1">
                        {Array.from({ length: totalConflicts }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i)}
                                className={clsx(
                                    'w-2 h-2 rounded-full transition-all',
                                    i === currentIndex
                                        ? 'bg-accent scale-125'
                                        : resolved.has(i)
                                            ? 'bg-success'
                                            : 'bg-border'
                                )}
                                aria-label={`Conflict ${i + 1}`}
                            />
                        ))}
                    </div>
                    <button
                        className="touch-target flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-muted hover:text-fg disabled:opacity-30 transition-colors"
                        onClick={() => setCurrentIndex(prev => Math.min(totalConflicts - 1, prev + 1))}
                        disabled={currentIndex === totalConflicts - 1}
                        aria-label="Next conflict"
                    >
                        Next
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* iOS safe area */}
            <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
    );
}
