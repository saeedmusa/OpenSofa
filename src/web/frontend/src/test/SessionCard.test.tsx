import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SessionCard } from '../components/SessionCard';
import { ToastProvider } from '../components/Toast';
import type { Session } from '../types';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('SessionCard', () => {
  const mockSession: Session = {
    name: 'test-session',
    status: 'active',
    agentType: 'claude',
    model: 'claude-3-opus',
    branch: 'main',
    agentStatus: 'stable',
    hasPendingApproval: false,
    createdAt: Date.now() - 3600000,
    lastActivityAt: Date.now() - 60000,
  };

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should render session name', () => {
    renderWithRouter(<SessionCard session={mockSession} />);
    expect(screen.getByText('test-session')).toBeInTheDocument();
  });

  it('should render agent type', () => {
    renderWithRouter(<SessionCard session={mockSession} />);
    expect(screen.getByText('claude')).toBeInTheDocument();
  });

  it('should render branch name', () => {
    renderWithRouter(<SessionCard session={mockSession} />);
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('should show approval badge when pending', () => {
    const sessionWithApproval = { ...mockSession, hasPendingApproval: true };
    renderWithRouter(<SessionCard session={sessionWithApproval} />);
    expect(screen.getByText('Approval')).toBeInTheDocument();
  });

  it('should not show approval badge when not pending', () => {
    renderWithRouter(<SessionCard session={mockSession} />);
    expect(screen.queryByText('Approval')).not.toBeInTheDocument();
  });

  it('should navigate on click', () => {
    renderWithRouter(<SessionCard session={mockSession} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/session/test-session');
  });

  it('should navigate on Enter key', () => {
    renderWithRouter(<SessionCard session={mockSession} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/session/test-session');
  });

  it('should navigate on Space key', () => {
    renderWithRouter(<SessionCard session={mockSession} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(mockNavigate).toHaveBeenCalledWith('/session/test-session');
  });

  it('should call onStop when stop button clicked', () => {
    const onStop = vi.fn();
    renderWithRouter(<SessionCard session={mockSession} onStop={onStop} />);
    fireEvent.click(screen.getByLabelText(/stop session/i));
    expect(onStop).toHaveBeenCalledWith('test-session');
  });

  it('should not navigate when stop button clicked', () => {
    const onStop = vi.fn();
    renderWithRouter(<SessionCard session={mockSession} onStop={onStop} />);
    fireEvent.click(screen.getByLabelText(/stop session/i));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should have correct aria-label', () => {
    renderWithRouter(<SessionCard session={mockSession} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('test-session')
    );
  });

  it('should include approval status in aria-label when pending', () => {
    const sessionWithApproval = { ...mockSession, hasPendingApproval: true };
    renderWithRouter(<SessionCard session={sessionWithApproval} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('needs approval')
    );
  });
});
