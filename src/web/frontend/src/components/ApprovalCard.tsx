import { useState } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import { safeVibrate } from '../utils/haptics';
import type { SessionDetail } from '../types';

interface ApprovalCardProps {
  session: SessionDetail;
  onComplete?: () => void;
}

export function ApprovalCard({ session, onComplete }: ApprovalCardProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session.pendingApproval) return null;

  const command = session.pendingApproval.command || 'Unknown command';

  const handleApprove = async () => {
    setLoading('approve');
    setError(null);
    try {
      await api.sessions.approve(session.name);
      safeVibrate(50);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading('reject');
    setError(null);
    try {
      await api.sessions.reject(session.name);
      safeVibrate([30, 50, 30]);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-warning/10 border border-warning/25 p-5 animate-scale-in">
      {/* Header — Warning indicator */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-warning/20 border border-warning/30">
          <AlertTriangle size={18} className="text-warning" />
        </div>
        <span className="font-mono font-bold text-warning text-sm uppercase tracking-wider">APPROVAL_REQUIRED</span>
      </div>

      {/* Command preview — Terminal style */}
      <div className="bg-surface-container-high p-4 font-mono text-sm mb-5 overflow-x-auto text-on-surface border border-outline-variant/20">
        <span className="text-matrix-green mr-2">$</span>
        {command}
      </div>

      {/* Action buttons — Brutalist command style */}
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-matrix-green hover:bg-matrix-green-fixed text-void py-3 font-mono font-bold text-xs uppercase tracking-wider transition-all duration-150 disabled:opacity-50 shadow-glow-primary"
        >
          <Check size={16} />
          {loading === 'approve' ? 'APPROVING...' : 'APPROVE'}
        </button>
        <button
          onClick={handleReject}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-neon-red/20 hover:bg-neon-red text-on-surface py-3 font-mono font-bold text-xs uppercase tracking-wider transition-all duration-150 disabled:opacity-50 border border-neon-red/30"
        >
          <X size={16} />
          {loading === 'reject' ? 'REJECTING...' : 'REJECT'}
        </button>
      </div>

      {error && (
        <p className="text-neon-red text-xs mt-4 text-center font-mono">{error}</p>
      )}
    </div>
  );
}
