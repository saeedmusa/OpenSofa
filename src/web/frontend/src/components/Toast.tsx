import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Check, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    if (navigator.vibrate) {
      navigator.vibrate(type === 'error' ? [50, 30, 50] : 30);
    }
  }, [removeToast]);

  const value: ToastContextValue = {
    toast: addToast,
    success: (msg) => addToast('success', msg),
    error: (msg) => addToast('error', msg),
    info: (msg) => addToast('info', msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-80 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: () => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const Icon = toast.type === 'success' ? Check : toast.type === 'error' ? AlertTriangle : Info;
  
  const bgClasses = {
    success: 'bg-success/15 border-success/25',
    error: 'bg-danger/15 border-danger/25',
    info: 'bg-accent/15 border-accent/25',
  };
  
  const iconBgClasses = {
    success: 'bg-success/20',
    error: 'bg-danger/20',
    info: 'bg-accent/20',
  };
  
  const textClasses = {
    success: 'text-success',
    error: 'text-danger',
    info: 'text-accent',
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={clsx(
        'flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl',
        'animate-slide-up shadow-float',
        bgClasses[toast.type]
      )}
    >
      <div className={clsx('p-2 rounded-xl', iconBgClasses[toast.type])}>
        <Icon size={18} className={clsx('flex-shrink-0', textClasses[toast.type])} />
      </div>
      <p className="flex-1 text-sm text-fg-strong font-medium pt-1.5">{toast.message}</p>
      <button
        onClick={onRemove}
        aria-label="Dismiss notification"
        className="flex-shrink-0 p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
