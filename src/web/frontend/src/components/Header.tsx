import { clsx } from 'clsx';

interface HeaderProps {
  connected: boolean;
  tunnelUrl?: string | null;
}

export function Header({ connected }: HeaderProps) {
  return (
    <header className="header-terminal">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left section — Logo and status */}
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-matrix-green text-xl">terminal</span>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={clsx(
                "absolute inline-flex h-full w-full",
                connected ? "bg-matrix-green animate-pulse" : "bg-neon-red"
              )} />
              {connected && (
                <span className="relative inline-flex h-2 w-2 bg-matrix-green" />
              )}
              {!connected && (
                <span className="relative inline-flex h-2 w-2 bg-neon-red" />
              )}
            </span>
            <h1 className="text-matrix-green font-mono text-sm font-bold tracking-tighter uppercase">
              {connected ? 'AGENT: RUNNING' : 'AGENT: OFFLINE'}
            </h1>
          </div>
        </div>

        {/* Right section — Nav items and actions */}
        <div className="flex items-center gap-4">
          {/* Desktop nav items */}
          <div className="hidden md:flex gap-6 font-mono text-[10px] tracking-widest items-center">
            <span className="text-matrix-green">LOGS</span>
            <span className="text-matrix-green/60 hover:text-matrix-green transition-colors cursor-pointer">FILES</span>
            <span className="text-matrix-green/60 hover:text-matrix-green transition-colors cursor-pointer border border-matrix-green px-2 py-0.5">PROMPT</span>
            <span className="text-matrix-green/60 hover:text-matrix-green transition-colors cursor-pointer">SYSTEM</span>
          </div>

          {/* Stop button */}
          <button className="btn-stop px-3 py-1 hover:bg-matrix-green hover:text-void transition-all active:translate-y-0.5">
            STOP
          </button>
        </div>
      </div>
    </header>
  );
}
