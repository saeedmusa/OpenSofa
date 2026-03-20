import { useState, useCallback } from 'react';
import { Share2, Loader2, Check } from 'lucide-react';
import { safeVibrate } from '../utils/haptics';

interface ShareCardGeneratorProps {
    projectName: string;
    sessionName: string;
    agentName: string;
    additions: number;
    deletions: number;
    filesChanged: number;
}

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

/**
 * Share Card Generator — creates a beautiful 1200×630px image for Twitter/OG sharing.
 * Uses Canvas API for client-side image generation (no external deps).
 * Mobile: native navigator.share(), Desktop: clipboard copy.
 * 
 * Architecture Ref: §1.14 Native Web Capabilities
 * User Story: US-20
 */
export function ShareCardGenerator({
    projectName,
    sessionName,
    agentName,
    additions,
    deletions,
    filesChanged,
}: ShareCardGeneratorProps) {
    const [generating, setGenerating] = useState(false);
    const [shared, setShared] = useState(false);

    const generateCard = useCallback(async (): Promise<Blob | null> => {
        const canvas = document.createElement('canvas');
        canvas.width = CARD_WIDTH;
        canvas.height = CARD_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // ─── Background gradient ───
        const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
        bg.addColorStop(0, '#0a1a0f');
        bg.addColorStop(0.5, '#0f2818');
        bg.addColorStop(1, '#0a1a0f');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

        // ─── Decorative grid ───
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < CARD_WIDTH; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CARD_HEIGHT);
            ctx.stroke();
        }
        for (let y = 0; y < CARD_HEIGHT; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CARD_WIDTH, y);
            ctx.stroke();
        }

        // ─── Glow effect ───
        const glow = ctx.createRadialGradient(600, 315, 0, 600, 315, 400);
        glow.addColorStop(0, 'rgba(232, 152, 94, 0.12)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

        // ─── Project name ───
        ctx.font = 'bold 56px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#e8985e';
        ctx.textAlign = 'left';
        ctx.fillText(projectName, 80, 140);

        // ─── Session name ───
        ctx.font = '28px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(sessionName, 80, 190);

        // ─── Stats ───
        const statsY = 300;

        // Files changed
        ctx.font = 'bold 72px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(filesChanged.toString(), 80, statsY);
        ctx.font = '24px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText('files changed', 80, statsY + 36);

        // Additions
        ctx.font = 'bold 48px "SF Mono", Monaco, monospace';
        ctx.fillStyle = '#34d399';
        ctx.fillText(`+${additions}`, 420, statsY);
        ctx.font = '20px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText('additions', 420, statsY + 32);

        // Deletions
        ctx.font = 'bold 48px "SF Mono", Monaco, monospace';
        ctx.fillStyle = '#f87171';
        ctx.fillText(`-${deletions}`, 680, statsY);
        ctx.font = '20px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText('deletions', 680, statsY + 32);

        // ─── Agent info ───
        ctx.font = '22px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(`Agent: ${agentName}`, 80, 440);

        // ─── Timestamp ───
        const now = new Date();
        ctx.fillText(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 80, 475);

        // ─── Border ───
        ctx.strokeStyle = 'rgba(232, 152, 94, 0.3)';
        ctx.lineWidth = 2;
        ctx.roundRect(10, 10, CARD_WIDTH - 20, CARD_HEIGHT - 20, 20);
        ctx.stroke();

        // ─── Watermark ───
        ctx.font = 'bold 20px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.textAlign = 'right';
        ctx.fillText('Built with OpenSofa 🛋️', CARD_WIDTH - 80, CARD_HEIGHT - 40);

        return new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });
    }, [projectName, sessionName, agentName, additions, deletions, filesChanged]);

    const handleShare = async () => {
        setGenerating(true);
        try {
            const blob = await generateCard();
            if (!blob) throw new Error('Failed to generate card');

            const file = new File([blob], `opensofa-${sessionName}.png`, { type: 'image/png' });

            // Mobile: native share
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    title: `${projectName} — Built with OpenSofa`,
                    files: [file],
                });
            } else {
                // Desktop: copy to clipboard
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob }),
                ]);
            }

            setShared(true);
            safeVibrate(50);
            setTimeout(() => setShared(false), 3000);
        } catch (err) {
            // User cancelled share or clipboard not available
            console.error('Share failed:', err);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <button
            onClick={handleShare}
            disabled={generating}
            className="btn btn-secondary text-xs gap-2"
            aria-label="Generate and share session card"
        >
            {generating ? (
                <Loader2 size={14} className="animate-spin" />
            ) : shared ? (
                <Check size={14} className="text-success" />
            ) : (
                <Share2 size={14} />
            )}
            <span className="hidden sm:inline">
                {shared ? 'Shared!' : 'Share Card'}
            </span>
        </button>
    );
}
