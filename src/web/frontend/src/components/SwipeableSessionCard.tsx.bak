import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, AlertCircle, Clock, Share2, MoreVertical, Link } from 'lucide-react';
import { clsx } from 'clsx';
import type { Session } from '../types';
import { formatRelativeTime } from '../utils/format';
import { useToast } from './Toast';

interface SwipeableSessionCardProps {
  session: Session;
  onStop?: (name: string) => void;
  tunnelUrl?: string | null;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableSessionCard({ session, onStop, tunnelUrl }: SwipeableSessionCardProps) {
  const navigate = useNavigate();
  const { success, info } = useToast();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [formattedTime, setFormattedTime] = useState(() => formatRelativeTime(session.lastActivityAt));
  const startX = useRef(0);
  const isDragging = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);

  const statusColor = session.agentStatus === 'stable' 
    ? 'bg-success' 
    : 'bg-warning animate-pulse';

  useEffect(() => {
    const interval = setInterval(() => {
      setFormattedTime(formatRelativeTime(session.lastActivityAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [session.lastActivityAt]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
    
    longPressTimer.current = setTimeout(() => {
      if (isDragging.current) {
        setShowContextMenu(true);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    
    const currentX = e.touches[0].clientX;
    const diff = startX.current - currentX;
    
    if (Math.abs(diff) > 10) {
      clearTimeout(longPressTimer.current);
    }
    
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, SWIPE_THRESHOLD * 1.5));
    } else {
      setSwipeOffset(Math.max(diff, -SWIPE_THRESHOLD * 1.5));
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    isDragging.current = false;
    
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      setShowActions(true);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleCancelSwipe = () => {
    setSwipeOffset(0);
    setShowActions(false);
  };

  const handleShare = async () => {
    if (!tunnelUrl) {
      info('Tunnel URL not available');
      return;
    }
    
    const url = `${tunnelUrl}/session/${encodeURIComponent(session.name)}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `OpenSofa: ${session.name}`,
          text: `Watch my ${session.agentType} session`,
          url,
        });
        success('Shared successfully');
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      success('Session URL copied to clipboard');
    }
    
    setShowContextMenu(false);
  };

  const handleCopyUrl = async () => {
    if (!tunnelUrl) {
      info('Tunnel URL not available');
      return;
    }
    
    const url = `${tunnelUrl}/session/${encodeURIComponent(session.name)}`;
    await navigator.clipboard.writeText(url);
    success('Session URL copied');
    setShowContextMenu(false);
  };

  const handleStop = () => {
    onStop?.(session.name);
    handleCancelSwipe();
    setShowContextMenu(false);
  };

  const handleNavigate = () => {
    if (!showActions && swipeOffset === 0) {
      navigate(`/session/${encodeURIComponent(session.name)}`);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div 
        className={clsx(
          'absolute inset-0 flex items-center justify-between px-4',
          swipeOffset > 0 ? 'bg-danger' : 'bg-surface'
        )}
      >
        {swipeOffset > 0 ? (
          <div className="flex items-center gap-2 text-white ml-auto">
            <Square size={16} />
            <span className="text-sm font-medium">Stop</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted">
            <Share2 size={16} />
            <span className="text-sm font-medium">Share</span>
          </div>
        )}
      </div>

      <article
        ref={cardRef}
        className={clsx(
          'session-card touch-target cursor-pointer bg-surface border border-border',
          'transition-transform duration-200 ease-out',
          'relative z-10'
        )}
        style={{ transform: `translateX(${-swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleNavigate}
        role="button"
        tabIndex={0}
        aria-label={`${session.name}, ${session.agentType}, status: ${session.agentStatus}${session.hasPendingApproval ? ', needs approval' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleNavigate();
          }
        }}
      >
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div 
                className={clsx('status-dot', statusColor)} 
                aria-hidden="true"
              />
              <h3 className="font-medium text-fg truncate">{session.name}</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContextMenu(!showContextMenu);
                }}
                className="ml-auto p-1 text-muted hover:text-fg"
                aria-label="More options"
              >
                <MoreVertical size={16} />
              </button>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Play size={12} aria-hidden="true" />
                {session.agentType}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} aria-hidden="true" />
                {formattedTime}
              </span>
            </div>

            {session.branch && (
              <div className="mt-2 text-xs text-muted font-mono">
                {session.branch}
              </div>
            )}
          </div>

          {session.hasPendingApproval && (
            <span 
              className="flex items-center gap-1 px-2 py-1 bg-warning/20 text-warning text-xs rounded-full"
              aria-label="Needs approval"
            >
              <AlertCircle size={12} aria-hidden="true" />
              Approval
            </span>
          )}
        </div>

        {showActions && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <div className="flex gap-4">
              {swipeOffset > 0 && onStop && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStop();
                  }}
                  className="px-4 py-2 bg-danger text-white rounded-lg font-medium"
                >
                  Confirm Stop
                </button>
              )}
              {swipeOffset < 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare();
                  }}
                  className="px-4 py-2 bg-accent text-white rounded-lg font-medium"
                >
                  Share Session
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelSwipe();
                }}
                className="px-4 py-2 bg-surface text-fg rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </article>

      {showContextMenu && (
        <>
          <div 
            className="fixed inset-0 z-30"
            onClick={() => setShowContextMenu(false)}
          />
          <div className="absolute right-4 top-12 z-40 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
            <button
              onClick={handleShare}
              className="w-full px-4 py-2 text-left text-sm text-fg hover:bg-surface/80 flex items-center gap-2"
            >
              <Share2 size={14} />
              Share Session
            </button>
            <button
              onClick={handleCopyUrl}
              className="w-full px-4 py-2 text-left text-sm text-fg hover:bg-surface/80 flex items-center gap-2"
            >
              <Link size={14} />
              Copy Tunnel URL
            </button>
            {onStop && (
              <button
                onClick={handleStop}
                className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-surface/80 flex items-center gap-2"
              >
                <Square size={14} />
                Stop Session
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
