import { Share2 } from 'lucide-react';
import { useToast } from './Toast';

interface ShareButtonProps {
  sessionName: string;
  tunnelUrl: string | null;
  className?: string;
}

export function ShareButton({ sessionName, tunnelUrl, className }: ShareButtonProps) {
  const { success, info } = useToast();

  const handleShare = async () => {
    if (!tunnelUrl) {
      info('Tunnel URL not available');
      return;
    }
    
    const url = `${tunnelUrl}/session/${encodeURIComponent(sessionName)}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `OpenSofa: ${sessionName}`,
          text: 'Watch my coding session',
          url,
        });
        success('Shared successfully');
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      success('Session URL copied to clipboard');
    }
  };

  return (
    <button
      onClick={handleShare}
      className={className || 'btn btn-secondary text-xs gap-2'}
      aria-label={`Share session ${sessionName}`}
    >
      <Share2 size={14} />
      <span className="hidden sm:inline">Share</span>
    </button>
  );
}
