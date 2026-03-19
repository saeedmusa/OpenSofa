/**
 * PreviewButton — Preview tunnel button (US-18, Architecture §0.2)
 *
 * Shows a compact pill/badge in the session header that opens the
 * preview tunnel URL for the session's dev server.
 */

import { ExternalLink, Globe } from 'lucide-react';
import { clsx } from 'clsx';

interface PreviewButtonProps {
    /** Preview tunnel URL (e.g. https://xxx.trycloudflare.com) */
    previewUrl?: string | null;
    /** Port the dev server is running on */
    port?: number;
    className?: string;
}

export function PreviewButton({ previewUrl, port, className }: PreviewButtonProps) {
    // Only render when a preview URL is available
    if (!previewUrl) return null;

    const label = port ? `Preview :${port}` : 'Preview';

    return (
        <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5',
                'rounded-full text-xs font-medium',
                'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                'hover:bg-emerald-500/25 hover:border-emerald-500/50',
                'transition-all duration-200',
                'min-h-[32px]', // Accessible touch target
                className,
            )}
            aria-label={`Open preview at ${previewUrl}`}
        >
            <Globe size={14} className="shrink-0" />
            <span>{label}</span>
            <ExternalLink size={12} className="shrink-0 opacity-60" />
        </a>
    );
}
