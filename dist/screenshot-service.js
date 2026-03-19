/**
 * OpenSofa - Screenshot Service
 *
 * Captures AgentAPI tmux pane output and renders mobile-friendly PNG screenshots.
 * Based on LOW_LEVEL_DESIGN.md §12.
 */
import { execSync } from 'child_process';
import sharp from 'sharp';
export class ScreenshotService {
    config;
    overrides;
    constructor(config, overrides) {
        this.config = config;
        this.overrides = overrides;
    }
    /**
     * Capture last terminal lines from tmux and render to PNG.
     */
    static MAX_SCREENSHOT_LINES = 60;
    async capture(port) {
        const rawText = this.capturePane(port);
        const lines = rawText.replace(/\r\n/g, '\n').split('\n');
        while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
            lines.pop();
        }
        // Cap line count to prevent huge SVG/PNG allocations
        const capped = lines.slice(-ScreenshotService.MAX_SCREENSHOT_LINES);
        const text = capped.join('\n');
        return this.renderText(text || '(no terminal output)');
    }
    /**
     * Render text into a dark-themed terminal PNG optimized for mobile reading.
     */
    async renderText(text) {
        const fontSize = this.config.screenshotFontSize;
        const maxCols = this.config.screenshotCols;
        const lineHeight = Math.ceil(fontSize * 1.5);
        const charWidth = Math.ceil(fontSize * 0.62);
        const padding = 24;
        const inputLines = text.replace(/\r\n/g, '\n').split('\n');
        const lines = (inputLines.length > 0 ? inputLines : [' ']).map((line) => line.slice(0, maxCols));
        const width = maxCols * charWidth + padding * 2;
        const height = Math.max(lines.length * lineHeight + padding * 2, 100);
        const tspans = lines
            .map((line, i) => {
            const dy = i === 0 ? fontSize : lineHeight;
            return `<tspan x="${padding}" dy="${dy}">${escapeSvg(line || ' ')}</tspan>`;
        })
            .join('\n        ');
        const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .term { font-family: 'Courier New', 'Menlo', 'Monaco', monospace; font-size: ${fontSize}px; fill: #d4d4d4; }
  </style>
  <rect width="100%" height="100%" fill="#1e1e1e" rx="8"/>
  <text class="term" y="${padding}">
        ${tspans}
  </text>
</svg>`;
        return sharp(Buffer.from(svg))
            .png({ compressionLevel: 6 })
            .toBuffer();
    }
    capturePane(port) {
        if (!Number.isInteger(port) || port <= 0) {
            throw new Error(`Invalid port: ${port}`);
        }
        if (this.overrides?.capturePane) {
            return this.overrides.capturePane(port);
        }
        const sessionName = `agentapi-${port}`;
        try {
            return execSync(`tmux capture-pane -t ${sessionName} -p -S -50`, {
                encoding: 'utf-8',
                timeout: 5000,
                maxBuffer: 1024 * 1024,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`tmux capture failed for ${sessionName}: ${message}`);
        }
    }
}
function escapeSvg(input) {
    return input
        // Strip XML-invalid control characters (keep \t=0x09, \n=0x0A, \r=0x0D)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
//# sourceMappingURL=screenshot-service.js.map