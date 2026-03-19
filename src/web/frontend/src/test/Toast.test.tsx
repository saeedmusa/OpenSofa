import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/Toast';

const TestComponent = ({ 
  type = 'success', 
  message = 'Test message' 
}: { type?: 'success' | 'error' | 'info'; message?: string }) => {
  const toast = useToast();
  return (
    <button onClick={() => toast[type](message)}>
      Show {type} toast
    </button>
  );
};

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<ToastProvider>{ui}</ToastProvider>);
};

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show success toast', () => {
    renderWithProvider(<TestComponent type="success" message="Success!" />);
    fireEvent.click(screen.getByText('Show success toast'));
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('should show error toast', () => {
    renderWithProvider(<TestComponent type="error" message="Error!" />);
    fireEvent.click(screen.getByText('Show error toast'));
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('should show info toast', () => {
    renderWithProvider(<TestComponent type="info" message="Info!" />);
    fireEvent.click(screen.getByText('Show info toast'));
    expect(screen.getByText('Info!')).toBeInTheDocument();
  });

  it('should dismiss toast when close button clicked', async () => {
    renderWithProvider(<TestComponent message="Dismissible" />);
    fireEvent.click(screen.getByText('Show success toast'));
    expect(screen.getByText('Dismissible')).toBeInTheDocument();
    
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    
    expect(screen.queryByText('Dismissible')).not.toBeInTheDocument();
  });

  it('should auto-dismiss after duration', async () => {
    renderWithProvider(<TestComponent message="Auto dismiss" />);
    fireEvent.click(screen.getByText('Show success toast'));
    expect(screen.getByText('Auto dismiss')).toBeInTheDocument();
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    
    expect(screen.queryByText('Auto dismiss')).not.toBeInTheDocument();
  });

  it('should throw error when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => render(<TestComponent />)).toThrow(
      'useToast must be used within ToastProvider'
    );
    
    consoleError.mockRestore();
  });

  it('should have correct ARIA role for error toasts', () => {
    renderWithProvider(<TestComponent type="error" message="Error!" />);
    fireEvent.click(screen.getByText('Show error toast'));
    
    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  it('should have correct ARIA role for info toasts', () => {
    renderWithProvider(<TestComponent type="info" message="Info!" />);
    fireEvent.click(screen.getByText('Show info toast'));
    
    const toast = screen.getByRole('status');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });
});
