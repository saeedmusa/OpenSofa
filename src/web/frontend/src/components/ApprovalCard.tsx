import { useState } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
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
      if (navigator.vibrate) navigator.vibrate(50);
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
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-warning/10 border border-warning/25 rounded-2xl p-5 animate-scale-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-warning/20">
          <AlertTriangle size={20} className="text-warning" />
        </div>
        <span className="font-semibold text-warning">Needs Approval</span>
      </div>

      <div className="bg-surface rounded-xl p-4 font-mono text-sm mb-5 overflow-x-auto text-fg border border-border">
        {command}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-success hover:bg-success/90 text-white py-3.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 shadow-[0_4px_16px_rgba(125,184,125,0.3)]"
        >
          <Check size={18} />
          {loading === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={handleReject}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-danger hover:bg-danger/90 text-white py-3.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 shadow-[0_4px_16px_rgba(216,107,107,0.3)]"
        >
          <X size={18} />
          {loading === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
      </div>

      {error && (
        <p className="text-danger text-sm mt-4 text-center font-medium">{error}</p>
      )}
    </div>
  );
}
