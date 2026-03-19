import { Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { Logo } from './Logo';

interface HeaderProps {
  connected: boolean;
  tunnelUrl?: string | null;
}

export function Header({ connected, tunnelUrl }: HeaderProps) {
  return (
    <header className="floating-header safe-area-inset">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <Logo size="md" />
          {tunnelUrl && (
            <span className="badge flex-shrink-0">
              Remote
            </span>
          )}
        </div>

        <div 
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300',
            connected 
              ? 'bg-success-soft text-success' 
              : 'bg-surface text-muted'
          )}
          role="status"
          aria-live="polite"
          aria-label={connected ? 'Connected to server' : 'Disconnected from server'}
        >
          {connected ? (
            <>
              <Wifi size={14} aria-hidden="true" />
              <span className="text-sm font-medium">Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={14} aria-hidden="true" />
              <span className="text-sm font-medium">Offline</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
