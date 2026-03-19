/**
 * Tests for Screenshot Service
 */

import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { ScreenshotService } from '../src/screenshot-service.js';
import type { OpenSofaConfig } from '../src/types.js';

function createConfig(): OpenSofaConfig {
  return {
    allowedPhoneNumber: '1234567890',
    defaultAgent: 'claude',
    maxSessions: 5,
    portRangeStart: 3284,
    debounceMs: 3000,
    screenshotIntervalMs: 10000,
    approvalTimeoutMs: 300000,
    healthCheckIntervalMs: 10000,
    idleTimeoutMs: 600000,
    truncateAt: 4000,
    screenshotFontSize: 14,
    screenshotCols: 80,
    autoApprove: false,
    autoDeleteGroups: true,
    singleNumberMode: false,
    projectDirs: ['~/development', '~/projects'],
    autoCleanupOnCritical: true,
  };
}

describe('ScreenshotService', () => {
  it('renders text to PNG with expected dimensions', async () => {
    const config = { ...createConfig(), screenshotCols: 40, screenshotFontSize: 12 };
    const service = new ScreenshotService(config);

    const png = await service.renderText('line1\nline2');
    const metadata = await sharp(png).metadata();

    const charWidth = Math.ceil(config.screenshotFontSize * 0.62);
    const expectedWidth = config.screenshotCols * charWidth + 24 * 2;

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(expectedWidth);
    expect(metadata.height).toBeGreaterThanOrEqual(100);
  });

  it('escapes XML-sensitive characters while rendering', async () => {
    const service = new ScreenshotService(createConfig());
    const png = await service.renderText('<tag attr="x">Tom & Jerry</tag>');
    const metadata = await sharp(png).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
  });

  it('capture trims trailing empty lines and delegates to renderer', async () => {
    const config = createConfig();
    const service = new ScreenshotService(config, {
      capturePane: () => 'first line\nsecond line\n\n\n',
    });

    const png = await service.capture(3284);
    const metadata = await sharp(png).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
  });
});
