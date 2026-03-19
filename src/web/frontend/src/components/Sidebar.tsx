import { NavLink } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useSessionStore } from '../stores/sessionStore';
import { useToast } from './Toast';
import { Logo } from './Logo';

export function Sidebar() {
  const sessions = useSessionStore((s) => s.sessions);
  const toast = useToast();

  const handleNewSession = () => {
    toast.info('Use the + button in the top right to create a session');
  };

  return (
    <aside className="w-72 h-screen bg-bg-elevated border-r border-border flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <p className="text-xs text-muted">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="px-4 mb-2">
        <div className="text-xs text-muted uppercase tracking-wider px-3 py-2 font-medium">
          Sessions
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 no-scrollbar">
        {sessions.length === 0 ? (
          <div className="empty-state px-3">
            <div className="empty-state-icon">
              <Logo size="lg" showText={false} />
            </div>
            <p className="text-sm text-muted">No active sessions</p>
            <p className="text-xs text-muted mt-1">Create a session to get started</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => (
              <li key={session.name}>
                <NavLink
                  to={`/session/${encodeURIComponent(session.name)}`}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-accent-soft text-accent border border-accent/30'
                        : 'text-fg hover:bg-surface border border-transparent'
                    )
                  }
                >
                  <span
                    className={clsx(
                      'w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all',
                      session.agentStatus === 'stable' 
                        ? 'bg-success shadow-[0_0_8px_rgba(125,184,125,0.5)]' 
                        : 'bg-warning shadow-[0_0_8px_rgba(232,176,88,0.5)] animate-pulse'
                    )}
                  />
                  <span className="truncate text-sm font-medium">{session.name}</span>
                  {session.hasPendingApproval && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-warning flex-shrink-0 animate-pulse" />
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="p-4 border-t border-border">
        <button onClick={handleNewSession} className="w-full btn btn-secondary justify-start gap-2">
          <Plus size={18} />
          <span>New Session</span>
        </button>
      </div>
    </aside>
  );
}
