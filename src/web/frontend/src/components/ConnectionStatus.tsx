import { useWebSocket } from '../providers/WebSocketProvider';
import { useEffect, useState, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Bell, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { safeVibrate } from '../utils/haptics';

interface ConnectionStatusProps {
  onViewEvents?: () => void;
}

export function ConnectionStatus({ onViewEvents }: ConnectionStatusProps) {
  const { 
    connected, 
    connectionStatus, 
    pendingCount, 
    missedEvents, 
    showOfflineBanner,
    dismissOfflineBanner,
    reconnectError,
    reconnect
  } = useWebSocket();
  
  const [showReconnected, setShowReconnected] = useState(false);
  const [reconnectCountdown, setReconnectCountdown] = useState(0);
  const wasDisconnectedRef = useRef(false);
  const countdownRef = useRef<number | undefined>(undefined);

  // Track reconnection state and show banner on reconnect
  useEffect(() => {
    if (!connected && connectionStatus === 'disconnected') {
      wasDisconnectedRef.current = true;
    } else if (wasDisconnectedRef.current && connectionStatus === 'connected') {
      wasDisconnectedRef.current = false;
      setShowReconnected(true);
      safeVibrate(50);
      const timer = setTimeout(() => setShowReconnected(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [connected, connectionStatus]);

  // Reconnecting countdown display
  useEffect(() => {
    if (connectionStatus === 'reconnecting') {
      let count = 0;
      const updateCountdown = () => {
        count++;
        setReconnectCountdown(count);
        if (count < 60) {
          countdownRef.current = window.setTimeout(updateCountdown, 1000);
        }
      };
      countdownRef.current = window.setTimeout(updateCountdown, 1000);
      
      return () => {
        if (countdownRef.current) clearTimeout(countdownRef.current);
      };
    } else {
      setReconnectCountdown(0);
    }
  }, [connectionStatus]);

  // Get status color and label
  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'connected':
        return { 
          color: 'bg-success', 
          textColor: 'text-success',
          borderColor: 'border-success/25',
          bgColor: 'bg-success/15',
          label: 'Connected',
          icon: Wifi
        };
      case 'reconnecting':
        return { 
          color: 'bg-warning', 
          textColor: 'text-warning',
          borderColor: 'border-warning/25',
          bgColor: 'bg-warning/15',
          label: `Reconnecting${reconnectCountdown > 0 ? ` (${Math.floor(reconnectCountdown / 60)}m ${reconnectCountdown % 60}s)` : '...'}`,
          icon: RefreshCw
        };
      case 'disconnected':
      default:
        return { 
          color: 'bg-danger', 
          textColor: 'text-danger',
          borderColor: 'border-danger/25',
          bgColor: 'bg-danger/15',
          label: 'Disconnected',
          icon: WifiOff
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <>
      {/* Connection Status Indicator (top-right) */}
      <div data-testid="connection-status" className="fixed top-4 right-4 z-50">
        <div
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
            'transition-all duration-300 backdrop-blur-xl',
            statusInfo.bgColor,
            statusInfo.textColor,
            'border',
            statusInfo.borderColor
          )}
        >
          <StatusIcon 
            size={14} 
            className={clsx(
              connectionStatus === 'reconnecting' && 'animate-spin',
              connectionStatus === 'disconnected' && 'animate-pulse'
            )} 
          />
          <span className="hidden sm:inline">
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Reconnected Toast (top-center) */}
      {showReconnected && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-success text-white px-4 py-2.5 rounded-xl text-sm shadow-float flex items-center gap-2 font-medium">
            <Wifi size={14} />
            Reconnected
          </div>
        </div>
      )}

      {/* Connection Status Banner (full-width at top) */}
      {connectionStatus !== 'connected' && (
        <div className={clsx(
          'fixed top-0 left-0 right-0 z-40 animate-slide-down',
          reconnectError ? 'bg-danger' : connectionStatus === 'disconnected' ? 'bg-danger' : 'bg-warning'
        )}>
          <div className="flex flex-col items-center justify-center gap-1 py-3 text-sm font-medium text-white">
            {reconnectError ? (
              <>
                <div className="flex items-center gap-2">
                  <WifiOff size={14} />
                  <span>Server Unreachable</span>
                </div>
                <p className="text-xs opacity-80 text-center px-4">
                  Your server may be offline or sleeping. Check your machine.
                </p>
                <button
                  onClick={reconnect}
                  className="mt-1 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs font-bold transition-colors"
                >
                  Retry Connection
                </button>
              </>
            ) : connectionStatus === 'disconnected' ? (
              <>
                <WifiOff size={14} />
                <span>Disconnected</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Reconnecting...</span>
                  {reconnectCountdown > 0 && (
                    <span className="opacity-75">
                      ({Math.floor(reconnectCountdown / 60)}:{String(reconnectCountdown % 60).padStart(2, '0')})
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Offline Banner (missed events notification) */}
      {showOfflineBanner && missedEvents > 0 && (
        <div className="fixed top-[52px] left-0 right-0 z-40 bg-surface-elevated border-b border-border animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Bell size={16} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-fg-strong">
                  You were offline. {missedEvents} event{missedEvents !== 1 ? 's' : ''} occurred while you were away.
                </p>
                <p className="text-xs text-[rgba(255,255,255,0.5)]">
                  <Clock size={12} className="inline mr-1" />
                  Tap to view missed activity
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onViewEvents}
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View Events
              </button>
              <button
                onClick={dismissOfflineBanner}
                className="p-2 text-[rgba(255,255,255,0.5)] hover:text-fg transition-colors rounded-lg hover:bg-surface"
                aria-label="Dismiss offline banner"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Messages Indicator (when offline with queued messages) */}
      {!connected && pendingCount > 0 && (
        <div className="fixed bottom-4 right-4 z-50 animate-bounce-subtle">
          <div className="bg-surface-elevated border border-warning/30 px-4 py-3 rounded-xl shadow-float flex items-center gap-3">
            <div className="relative">
              <Clock size={16} className="text-warning" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-warning text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-fg-strong">
                {pendingCount} message{pendingCount !== 1 ? 's' : ''} pending
              </p>
              <p className="text-xs text-[rgba(255,255,255,0.5)]">
                Will be sent when reconnected
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
