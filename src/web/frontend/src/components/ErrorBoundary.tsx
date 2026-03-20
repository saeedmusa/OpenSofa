import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-danger mb-4" />
          <h3 className="text-lg font-medium text-fg mb-2">Something went wrong</h3>
          <p className="text-sm text-[rgba(255,255,255,0.5)] mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
