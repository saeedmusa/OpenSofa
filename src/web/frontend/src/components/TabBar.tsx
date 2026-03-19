import { NavLink, useParams } from 'react-router-dom';
import { Activity, Terminal, Folder } from 'lucide-react';
import { clsx } from 'clsx';

interface TabBarProps {
  sessionName?: string;
}

export function TabBar({ sessionName }: TabBarProps) {
  if (!sessionName) return null;

  const tabs = [
    { id: 'feed', icon: Activity, label: 'Feed' },
    { id: 'terminal', icon: Terminal, label: 'Terminal' },
    { id: 'files', icon: Folder, label: 'Files' },
  ];

  return (
    <nav 
      className="floating-tab-bar fixed bottom-0 left-0 right-0 safe-area-inset z-40"
      aria-label="Session navigation"
    >
      <ul className="flex justify-around items-center h-16 px-4" role="tablist">
        {tabs.map(({ id, icon: Icon, label }) => (
          <li key={id} role="tab" className="flex-1">
            <NavLink
              to={`/session/${sessionName}/${id}`}
              aria-label={label}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all duration-200',
                  isActive 
                    ? 'text-accent bg-accent-soft' 
                    : 'text-muted hover:text-fg-strong'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={clsx(
                    'p-2 rounded-xl transition-all duration-200',
                    isActive && 'bg-accent/20'
                  )}>
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <span className="text-[11px] mt-1 font-medium">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SessionTabBar() {
  const { name, tab } = useParams<{ name?: string; tab?: string }>();

  if (!name) return null;

  const tabs = [
    { id: undefined, icon: Activity, label: 'Feed' },
    { id: 'files', icon: Folder, label: 'Files' },
  ];

  return (
    <nav 
      className="floating-tab-bar fixed bottom-0 left-0 right-0 safe-area-inset z-40 lg:hidden"
      aria-label="Session navigation"
    >
      <ul className="flex justify-around items-center h-16 px-4" role="tablist">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = (!tab && !id) || tab === id;
          return (
            <li key={id || 'feed'} role="tab" className="flex-1">
              <NavLink
                to={id ? `/session/${name}/${id}` : `/session/${name}`}
                aria-label={label}
                aria-selected={isActive}
                className={() =>
                  clsx(
                    'flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all duration-200',
                    isActive 
                      ? 'text-accent bg-accent-soft' 
                      : 'text-muted hover:text-fg-strong'
                  )
                }
              >
                <div className={clsx(
                  'p-2 rounded-xl transition-all duration-200',
                  isActive && 'bg-accent/20'
                )}>
                  <Icon size={22} aria-hidden="true" />
                </div>
                <span className="text-[11px] mt-1 font-medium">{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
