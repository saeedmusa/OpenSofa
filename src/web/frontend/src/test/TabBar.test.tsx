import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TabBar, SessionTabBar } from '../components/TabBar';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({ pathname: '/session/test-session' }),
    useParams: () => ({ name: 'test-session', tab: undefined }),
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('TabBar', () => {
  it('should render all tabs when sessionName provided', () => {
    renderWithRouter(<TabBar sessionName="test-session" />);
    expect(screen.getByText('Feed')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('should not render without sessionName', () => {
    const { container } = renderWithRouter(<TabBar />);
    expect(container.firstChild).toBeNull();
  });

  it('should render tabs with aria-labels', () => {
    renderWithRouter(<TabBar sessionName="test-session" />);
    expect(screen.getByLabelText('Feed')).toBeInTheDocument();
    expect(screen.getByLabelText('Terminal')).toBeInTheDocument();
    expect(screen.getByLabelText('Files')).toBeInTheDocument();
  });

  it('should have correct navigation links', () => {
    renderWithRouter(<TabBar sessionName="my-session" />);
    expect(screen.getByRole('link', { name: /feed/i })).toHaveAttribute(
      'href',
      '/session/my-session/feed'
    );
    expect(screen.getByRole('link', { name: /terminal/i })).toHaveAttribute(
      'href',
      '/session/my-session/terminal'
    );
    expect(screen.getByRole('link', { name: /files/i })).toHaveAttribute(
      'href',
      '/session/my-session/files'
    );
  });
});

describe('SessionTabBar', () => {
  it('should render activity tab', () => {
    renderWithRouter(<SessionTabBar />);
    expect(screen.getByText('Feed')).toBeInTheDocument();
  });

  it('should render files tab', () => {
    renderWithRouter(<SessionTabBar />);
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('should have correct navigation links', () => {
    renderWithRouter(<SessionTabBar />);
    expect(screen.getByRole('link', { name: /feed/i })).toHaveAttribute(
      'href',
      '/session/test-session'
    );
    expect(screen.getByRole('link', { name: /files/i })).toHaveAttribute(
      'href',
      '/session/test-session/files'
    );
  });

  it('should have tablist role for accessibility', () => {
    renderWithRouter(<SessionTabBar />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});
