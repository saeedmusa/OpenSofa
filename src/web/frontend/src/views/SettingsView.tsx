import { useState } from 'react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import { Copy, Shield, Key, Cpu, Activity, RotateCcw } from 'lucide-react';
import { safeVibrate } from '../utils/haptics';

export function SettingsView() {
  const [token] = useState(() => api.getToken());
  const toast = useToast();

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      safeVibrate(50);
      toast.success('Token copied to clipboard');
    }
  };

  const sections = [
    {
      id: 'auth',
      title: 'Authentication',
      icon: <Key className="text-matrix-green" size={20} />,
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-muted uppercase tracking-widest mb-2">Access Token</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface border border-surface-container-high p-3 font-mono text-xs rounded-lg truncate text-fg-strong">
                {token}
              </div>
              <button 
                onClick={copyToken}
                className="btn btn-ghost p-3"
                title="Copy token"
              >
                <Copy size={18} />
              </button>
            </div>
            <p className="mt-2 text-[10px] font-mono text-muted italic">
              This token authorizes your browser to manage OpenSofa sessions.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'system',
      title: 'System Status',
      icon: <Cpu className="text-cyan-accent" size={20} />,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a1a] border border-surface-container-high p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-matrix-green" />
              <span className="text-xs font-mono text-fg-strong uppercase tracking-wider">Backend API</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-matrix-green animate-pulse" />
              <span className="text-sm font-mono text-matrix-green">CONNECTED</span>
            </div>
          </div>
          <div className="bg-[#1a1a1a] border border-surface-container-high p-4 rounded-xl opacity-50">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-muted" />
              <span className="text-xs font-mono text-fg-strong uppercase tracking-wider">Cloudflare Tunnel</span>
            </div>
            <span className="text-sm font-mono text-muted">INACTIVE</span>
          </div>
        </div>
      )
    },
    {
      id: 'danger',
      title: 'Danger Zone',
      icon: <RotateCcw className="text-neon-red" size={20} />,
      content: (
        <div className="space-y-4">
          <button 
            disabled
            className="w-full py-3 bg-neon-red/10 border border-neon-red/30 text-neon-red font-mono text-sm rounded-xl hover:bg-neon-red/20 transition-all opacity-50 cursor-not-allowed"
          >
            REVOKE_ALL_TOKENS
          </button>
          <p className="text-[10px] font-mono text-muted text-center">
            Instantly invalidates all active sessions and tokens.
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto">
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-[#e2e2e2] font-mono tracking-tight uppercase">Settings</h2>
        <p className="text-sm text-[rgba(255,255,255,0.5)] mt-1 font-mono">
          System configuration and security
        </p>
      </div>

      <div className="space-y-8">
        {sections.map(section => (
          <section key={section.id} className="animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              {section.icon}
              <h3 className="text-sm font-bold text-fg-strong font-mono uppercase tracking-widest">{section.title}</h3>
            </div>
            <div className="bg-[#0e0e0e] border border-surface-container-high p-6 rounded-2xl shadow-xl">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 text-center border-t border-surface-container-high pt-8">
        <p className="text-[10px] font-mono text-muted uppercase tracking-[0.2em]">
          OpenSofa v0.1.0-alpha • Built with Matrix aesthetics
        </p>
      </div>
    </div>
  );
}
