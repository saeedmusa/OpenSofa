/**
 * OpenSofa - Screenshot Service
 *
 * Captures AgentAPI tmux pane output and renders mobile-friendly PNG screenshots.
 * Based on LOW_LEVEL_DESIGN.md §12.
 */
import type { OpenSofaConfig } from './types.js';
export interface ScreenshotServiceOverrides {
    capturePane?: (port: number) => string;
}
export declare class ScreenshotService {
    private config;
    private overrides?;
    constructor(config: OpenSofaConfig, overrides?: ScreenshotServiceOverrides);
    /**
     * Capture last terminal lines from tmux and render to PNG.
     */
    private static readonly MAX_SCREENSHOT_LINES;
    capture(port: number): Promise<Buffer>;
    /**
     * Render text into a dark-themed terminal PNG optimized for mobile reading.
     */
    renderText(text: string): Promise<Buffer>;
    private capturePane;
}
//# sourceMappingURL=screenshot-service.d.ts.map