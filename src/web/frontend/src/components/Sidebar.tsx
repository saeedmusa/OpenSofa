import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { useSessionStore } from '../stores/sessionStore';

export function Sidebar() {
  const sessions = useSessionStore((s) => s.sessions);

  return (
    <aside className="sidebar-terminal pt-14 hidden lg:flex flex-col">
      {/* Terminal prompt header */}
      <div className="p-4 border-b border-surface-container-high">
        <span className="text-matrix-green font-bold font-mono text-sm">ROOT@OPENSOFA:~#</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 font-mono text-sm py-4">
        <NavLink
          to="/"
          className={({ isActive }) =>
            clsx(
              'sidebar-nav-item',
              isActive ? 'sidebar-nav-item-active' : 'text-cyan-accent'
            )
          }
          end
        >
          <span className="material-symbols-outlined">bolt</span>
          <span>ACTIVE_SESSIONS</span>
        </NavLink>
        
        <a href="#" className="sidebar-nav-item text-cyan-accent">
          <span className="material-symbols-outlined">receipt_long</span>
          <span>KERNEL_LOGS</span>
        </a>
        
        <a href="#" className="sidebar-nav-item text-cyan-accent">
          <span className="material-symbols-outlined">lan</span>
          <span>SSH_CONFIG</span>
        </a>
        
        <a href="#" className="sidebar-nav-item text-cyan-accent">
          <span className="material-symbols-outlined">vpn_key</span>
          <span>API_KEYS</span>
        </a>

        {/* Session list */}
        {sessions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-surface-container-high">
            <div className="px-4 py-2 text-[10px] text-muted uppercase tracking-widest font-mono">
              Active Sessions ({sessions.length})
            </div>
            {sessions.slice(0, 5).map((session) => (
              <NavLink
                key={session.name}
                to={`/session/${encodeURIComponent(session.name)}`}
                className={({ isActive }) =>
                  clsx(
                    'sidebar-nav-item',
                    isActive ? 'sidebar-nav-item-active' : 'text-cyan-accent'
                  )
                }
              >
                <span className="material-symbols-outlined text-sm">smart_toy</span>
                <span className="truncate">{session.name}</span>
              </NavLink>
            ))}
          </div>
        )}

        {/* Terminate all button */}
        <div className="mt-auto pt-4 border-t border-surface-container-high">
          <button className="sidebar-nav-item sidebar-nav-item-danger w-full text-neon-red hover:bg-neon-red/10">
            <span className="material-symbols-outlined">terminal</span>
            <span>TERMINATE_ALL</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
