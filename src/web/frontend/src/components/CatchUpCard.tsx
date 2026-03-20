import { useState, useEffect, useCallback } from 'react';
import { X, Clock } from 'lucide-react';
import { useWebSocket } from '../providers/WebSocketProvider';

const AUTO_DISMISS_MS = 30_000; // 30s per US-21
const MAX_CHARS = 280; // Tweet-length per US-21

interface CatchUpSummary {
    filesChanged: number;
    testsRun: number;
    testsPassed: number;
    testsFailed: number;
    approvalsPending: number;
    errorsCount: number;
    minutesAway: number;
    summary: string;
}

interface CatchUpCardProps {
    sessionName: string;
}

/**
 * Reconnection summary card — appears at top of ActivityFeed after reconnect.
 * Shows a tweet-length (≤280 char) summary of what happened while the user was away.
 * Auto-dismisses after 30s or tap to dismiss.
 * 
 * Architecture Ref: §1.9 Catch-Up Summary
 * User Story: US-21
 */
export function CatchUpCard({ sessionName }: CatchUpCardProps) {
    const [catchUp, setCatchUp] = useState<CatchUpSummary | null>(null);
    const [visible, setVisible] = useState(false);
    const { subscribe } = useWebSocket();

    useEffect(() => {
        return subscribe('catch_up_summary', (event) => {
            if (event.sessionName !== sessionName) return;

            const payload = event.payload as Partial<CatchUpSummary> | undefined;
            if (!payload) return;

            const summary: CatchUpSummary = {
                filesChanged: payload.filesChanged ?? 0,
                testsRun: payload.testsRun ?? 0,
                testsPassed: payload.testsPassed ?? 0,
                testsFailed: payload.testsFailed ?? 0,
                approvalsPending: payload.approvalsPending ?? 0,
                errorsCount: payload.errorsCount ?? 0,
                minutesAway: payload.minutesAway ?? 0,
                summary: (payload.summary ?? '').slice(0, MAX_CHARS),
            };

            setCatchUp(summary);
            setVisible(true);
        });
    }, [subscribe, sessionName]);

    // Auto-dismiss after 30s
    useEffect(() => {
        if (!visible) return;
        const timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [visible]);

    const dismiss = useCallback(() => setVisible(false), []);

    if (!visible || !catchUp) return null;

    // Build human-readable summary if server didn't provide one
    const displaySummary = catchUp.summary || buildSummary(catchUp);

    return (
        <div className="mx-4 mt-4 animate-in slide-in-from-top duration-300">
            <div className="bg-accent-soft border border-accent/20 rounded-2xl p-4 relative overflow-hidden">
                {/* Progress bar (30s countdown) */}
                <div
                    className="absolute top-0 left-0 h-0.5 bg-accent/40"
                    style={{
                        animation: `shrink-width ${AUTO_DISMISS_MS}ms linear forwards`,
                    }}
                />

                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-accent/20 flex-shrink-0">
                        <Clock size={16} className="text-accent" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xs font-semibold text-accent uppercase tracking-wider">
                                While you were away
                            </h3>
                            <span className="text-[10px] text-[rgba(255,255,255,0.5)] font-mono">
                                {catchUp.minutesAway}m
                            </span>
                        </div>

                        <p className="text-sm text-fg leading-relaxed">
                            {displaySummary}
                        </p>

                        {/* Quick stats */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-[rgba(255,255,255,0.5)]">
                            {catchUp.filesChanged > 0 && (
                                <span>📁 {catchUp.filesChanged} files</span>
                            )}
                            {catchUp.testsRun > 0 && (
                                <span>
                                    🧪 {catchUp.testsPassed}✓ {catchUp.testsFailed > 0 ? `${catchUp.testsFailed}✗` : ''}
                                </span>
                            )}
                            {catchUp.approvalsPending > 0 && (
                                <span className="text-warning font-medium">
                                    ⏳ {catchUp.approvalsPending} awaiting
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={dismiss}
                        className="p-1.5 rounded-lg text-[rgba(255,255,255,0.5)] hover:text-fg hover:bg-surface transition-colors flex-shrink-0"
                        aria-label="Dismiss catch-up summary"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Inline CSS for shrink animation — avoid external dependency */}
            <style>{`
        @keyframes shrink-width {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
        </div>
    );
}

function buildSummary(c: CatchUpSummary): string {
    const parts: string[] = [];

    if (c.filesChanged > 0) {
        parts.push(`edited ${c.filesChanged} file${c.filesChanged > 1 ? 's' : ''}`);
    }

    if (c.testsRun > 0) {
        parts.push(`ran tests (${c.testsPassed} passed${c.testsFailed > 0 ? `, ${c.testsFailed} failed` : ''})`);
    }

    if (c.errorsCount > 0) {
        parts.push(`${c.errorsCount} error${c.errorsCount > 1 ? 's' : ''}`);
    }

    if (c.approvalsPending > 0) {
        parts.push('awaiting approval');
    }

    if (parts.length === 0) return 'Nothing significant happened.';

    return `Agent ${parts.join(', ')}.`;
}
