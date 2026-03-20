import { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { IonApp, IonContent } from '@ionic/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WebSocketProvider } from './providers/WebSocketProvider';
import { DesktopLayout } from './layouts/DesktopLayout';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { PageLoader } from './components/PageLoader';
import { SkipLink } from './components/SkipLink';
import { FocusTrap } from './components/FocusTrap';
import { Logo } from './components/Logo';
import { api } from './utils/api';

const HomeView = lazy(() => import('./views/HomeView').then(m => ({ default: m.HomeView })));
const SessionView = lazy(() => import('./views/SessionView').then(m => ({ default: m.SessionView })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(() => !!api.getToken());

  // Auth guard: show auth-required screen if no token (spec US-1.4)
  if (!hasToken) {
    return (
      <IonApp>
        <IonContent class="ion-bg-dark">
          <div className="flex flex-col items-center justify-center min-h-full p-8">
            <div className="surface-floating p-10 text-center max-w-md animate-scale-in rounded-3xl">
              <Logo size="xl" className="justify-center mb-6" />
              <h2 className="text-xl font-semibold text-fg-strong mb-3">Authentication Required</h2>
              <p className="text-muted mb-6">
                Scan the QR code from your terminal or open the link with a valid token.
              </p>
              <p className="text-muted/60 text-sm">
                Run <code className="bg-surface px-2 py-1 rounded-lg text-accent">opensofa web</code> in your terminal to get a new link.
              </p>
            </div>
          </div>
        </IonContent>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonContent class="ion-bg-dark" fullscreen>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <ToastProvider>
              <WebSocketProvider>
                <BrowserRouter>
                  <RouterApp pendingApproval={pendingApproval} setPendingApproval={setPendingApproval} setHasToken={setHasToken} />
                </BrowserRouter>
              </WebSocketProvider>
            </ToastProvider>
          </ErrorBoundary>
        </QueryClientProvider>
      </IonContent>
    </IonApp>
  );
}

function RouterApp({ pendingApproval, setPendingApproval, setHasToken }: { pendingApproval: string | null; setPendingApproval: (v: string | null) => void; setHasToken: (v: boolean) => void }) {
  const navigate = useNavigate();

  const handleViewEvents = () => {
    navigate('/?tab=activity');
  };

  // Auto-save token from URL and handle deep links on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Persist token from QR code URL to localStorage
    const token = params.get('token');
    if (token) {
      api.saveToken(token);
      setHasToken(true);
    }

    // Handle deep link: ?session=foo&action=approve
    const session = params.get('session');
    const action = params.get('action');
    if (session && action === 'approve') {
      setPendingApproval(session);
      const url = new URL(window.location.href);
      url.searchParams.delete('session');
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.toString());
    }
  }, [setHasToken, setPendingApproval]);

  const handleDismissApproval = () => setPendingApproval(null);

  return (
    <IonContent fullscreen className="ion-bg-dark">
      <SkipLink />
      <ConnectionStatus onViewEvents={handleViewEvents} />
      <div id="main-content" role="main" className="relative z-10">
                {/* Deep link approval modal */}
                {pendingApproval && (
                  <DeepLinkApprovalModal
                    sessionName={pendingApproval}
                    onDismiss={handleDismissApproval}
                  />
                )}

                <Routes>
                  <Route element={<DesktopLayout />}>
                    <Route
                      path="/"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <HomeView />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/session/:name"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <SessionView />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/session/:name/:tab"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <SessionView />
                        </Suspense>
                      }
                    />
                  </Route>
                </Routes>
              </div>
    </IonContent>
  );
}

interface DeepLinkApprovalModalProps {
  sessionName: string;
  onDismiss: () => void;
}

function DeepLinkApprovalModal({ sessionName, onDismiss }: DeepLinkApprovalModalProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading('approve');
    setError(null);
    try {
      await api.sessions.approve(sessionName);
      if (navigator.vibrate) navigator.vibrate(50);
      onDismiss();
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
      await api.sessions.reject(sessionName);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      onDismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      role="presentation"
      aria-hidden="true"
    >
      <FocusTrap active={true} onEscape={onDismiss}>
        <div 
          className="surface-floating max-w-md w-full p-6 animate-scale-in"
          role="alertdialog"
          aria-labelledby="approval-title"
          aria-describedby="approval-description"
        >
          <div className="flex items-center gap-3 mb-5" id="approval-title">
            <div className="p-2.5 rounded-xl bg-warning/20">
              <span className="text-warning text-xl">⚠️</span>
            </div>
            <span className="font-semibold text-fg-strong">Approval Required</span>
          </div>

          <p className="text-sm text-muted mb-5" id="approval-description">
            Session <span className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-lg">{sessionName}</span> needs your approval.
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              aria-label={`Approve session ${sessionName}`}
              className="flex-1 flex items-center justify-center gap-2 bg-success hover:bg-success/90 text-white py-3.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 shadow-[0_4px_16px_rgba(125,184,125,0.3)]"
            >
              {loading === 'approve' ? 'Approving...' : '✓ Approve'}
            </button>
            <button
              onClick={handleReject}
              disabled={loading !== null}
              aria-label={`Reject session ${sessionName}`}
              className="flex-1 flex items-center justify-center gap-2 bg-danger hover:bg-danger/90 text-white py-3.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 shadow-[0_4px_16px_rgba(216,107,107,0.3)]"
            >
              {loading === 'reject' ? 'Rejecting...' : '✗ Reject'}
            </button>
          </div>

          {error && (
            <p className="text-danger text-sm mt-4 text-center font-medium" role="alert">{error}</p>
          )}

          <button
            className="w-full mt-4 text-muted text-sm py-2 hover:text-fg-strong transition-colors font-medium"
            onClick={onDismiss}
            aria-label="Dismiss approval dialog"
          >
            Dismiss
          </button>
        </div>
      </FocusTrap>
    </div>
  );
}
