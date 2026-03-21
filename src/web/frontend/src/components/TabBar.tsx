import { NavLink, useParams } from 'react-router-dom';
import { Activity, Terminal, Folder, MessageSquare, FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface TabBarProps {
  sessionName?: string;
}

export function TabBar({ sessionName }: TabBarProps) {
  if (!sessionName) return null;

  const tabs = [
    { id: 'feed', icon: Activity, label: 'Feed' },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'terminal', icon: Terminal, label: 'Terminal' },
    { id: 'files', icon: Folder, label: 'Files' },
    { id: 'changes', icon: FileText, label: 'Changes' },
  ];

  return (
    <nav 
      className="tab-bar-terminal md:hidden"
      aria-label="Session navigation"
    >
      <ul className="flex justify-around items-stretch h-full" role="tablist">
        {tabs.map(({ id, icon: Icon, label }) => (
          <li key={id} role="tab" className="flex-1">
            <NavLink
              to={`/session/${sessionName}/${id}`}
              aria-label={label}
              className={({ isActive }) =>
                clsx(
                  'tab-item-terminal',
                  isActive && 'tab-item-terminal-active'
                )
              }
            >
              <Icon size={20} aria-hidden="true" />
              <span className="mt-1">{label}</span>
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
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'changes', icon: FileText, label: 'Changes' },
    { id: 'files', icon: Folder, label: 'Files' },
  ];

  return (
    <nav 
      className="tab-bar-terminal lg:hidden"
      aria-label="Session navigation"
    >
      <ul className="flex justify-around items-stretch h-full" role="tablist">
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
                    'tab-item-terminal',
                    isActive && 'tab-item-terminal-active'
                  )
                }
              >
                <Icon size={20} aria-hidden="true" />
                <span className="mt-1">{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Mobile bottom navigation with terminal-style design
 * Following the "Kinetic Terminal" aesthetic
 */
export function MobileBottomNav() {
  return (
    <nav className="tab-bar-terminal md:hidden" aria-label="Main navigation">
      <ul className="flex justify-around items-stretch h-full" role="tablist">
        <li role="tab" className="flex-1">
          <a 
            href="#" 
            className="tab-item-terminal"
            aria-label="Logs"
          >
            <span className="material-symbols-outlined">database</span>
            <span>LOGS</span>
          </a>
        </li>
        <li role="tab" className="flex-1">
          <a 
            href="#" 
            className="tab-item-terminal"
            aria-label="Files"
          >
            <span className="material-symbols-outlined">folder_open</span>
            <span>FILES</span>
          </a>
        </li>
        <li role="tab" className="flex-1">
          <a 
            href="#" 
            className="tab-item-terminal-active"
            aria-label="Prompt"
          >
            <span className="material-symbols-outlined">terminal</span>
            <span>PROMPT</span>
          </a>
        </li>
        <li role="tab" className="flex-1">
          <a 
            href="#" 
            className="tab-item-terminal"
            aria-label="System"
          >
            <span className="material-symbols-outlined">settings_input_component</span>
            <span>SYSTEM</span>
          </a>
        </li>
      </ul>
    </nav>
  );
}
