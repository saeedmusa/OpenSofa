import { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { name, tab } = useParams<{ name?: string; tab?: string }>();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (!name) return;

    if (e.key === '1') {
      navigate(`/session/${name}`);
    } else if (e.key === '2') {
      navigate(`/session/${name}/terminal`);
    } else if (e.key === '3') {
      navigate(`/session/${name}/files`);
    } else if (e.key === 'Escape') {
      navigate('/');
    } else if (e.key === 'ArrowLeft' && e.metaKey) {
      navigate('/');
    }
  }, [name, navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    currentTab: tab || 'feed',
    shortcuts: [
      { key: '1', action: 'Activity Feed' },
      { key: '2', action: 'Terminal' },
      { key: '3', action: 'Files' },
      { key: 'Esc', action: 'Back to sessions' },
    ],
  };
}
