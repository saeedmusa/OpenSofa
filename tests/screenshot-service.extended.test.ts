/**
 * Extended tests for Screenshot Service
 * Covers tmux failure scenarios and large output handling
 */

import { describe, it, expect, vi } from 'vitest';
import { ScreenshotService } from '../src/screenshot-service.js';
import type { OpenSofaConfig } from '../src/types.js';

function createConfig(overrides: Partial<OpenSofaConfig> = {}): OpenSofaConfig {
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
    ...overrides,
  };
}

describe('ScreenshotService Extended', () => {
  describe('Tmux failure scenarios', () => {
    it('should handle tmux command not found', async () => {
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => {
            const error = new Error('spawn tmux ENOENT');
            (error as any).code = 'ENOENT';
            throw error;
          },
        }
      );

      await expect(service.capture(3284)).rejects.toThrow('tmux');
    });

    it('should handle tmux session not found', async () => {
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => {
            throw new Error('can\'t find session: agentapi-3284');
          },
        }
      );

      await expect(service.capture(3284)).rejects.toThrow('session');
    });

    it('should handle tmux permission denied', async () => {
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => {
            const error = new Error('EACCES: permission denied');
            (error as any).code = 'EACCES';
            throw error;
          },
        }
      );

      await expect(service.capture(3284)).rejects.toThrow('permission');
    });

    it('should handle tmux command timeout', async () => {
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => {
            throw new Error('Command failed: tmux capture-pane -t agentapi-3284');
          },
        }
      );

      await expect(service.capture(3284)).rejects.toThrow();
    });

    it('should handle empty tmux output gracefully', async () => {
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => '',
        }
      );

      // Should still render without error
      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle tmux output with only whitespace', async () => {
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => '   \n\t\n   ',
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });
  });

  describe('Large output handling', () => {
    it('should handle very long lines without crashing', async () => {
      const longLine = 'A'.repeat(10000);
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => longLine,
        }
      );

      // Should handle without crashing
      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle many lines of output', async () => {
      const manyLines = Array(1000).fill('Line content here').join('\n');
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => manyLines,
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle extremely large output with truncation', async () => {
      // 50,000 lines would be huge - should be handled gracefully
      const hugeOutput = Array(50000)
        .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`)
        .join('\n');
      
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => hugeOutput,
        }
      );

      // Should not crash, might truncate
      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle Unicode and special characters in output', async () => {
      const unicodeOutput = `
┌─────────────────────────────────────┐
│  Unicode Test: äöü ñ 中文 العربية  │
│  Emoji: 🚀 💻 🔥 🎉                  │
│  Symbols: → ← ↑ ↓ ✓ ✗               │
└─────────────────────────────────────┘
      `;
      
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => unicodeOutput,
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle ANSI escape codes', async () => {
      const ansiOutput = `
\x1b[32mSuccess:\x1b[0m Build completed
\x1b[31mError:\x1b[0m Something failed
\x1b[33mWarning:\x1b[0m Check this
\x1b[1mBold text\x1b[0m and \x1b[4munderlined\x1b[0m
      `;
      
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => ansiOutput,
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle binary garbage in output', async () => {
      // Some programs might output binary data
      const binaryGarbage = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]).toString('utf-8');
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => `Some text\n${binaryGarbage}\nMore text`,
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle single character output', async () => {
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => 'X',
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle output with only newlines', async () => {
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => '\n\n\n\n\n',
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle terminal resize artifacts', async () => {
      // Output that might occur during terminal resize
      const resizeArtifact = `
┌──────────┐┌──────────┐
│Content A ││Content B │
└──────────┘└──────────┘
      `;
      
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => resizeArtifact,
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle terminal progress bars', async () => {
      const progressBar = `
Building project...
[████████████████████░░░░░░░░░░░░░░░░] 45%
Processing: src/components/header.tsx
      `;
      
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => progressBar,
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });

    it('should handle null bytes in output', async () => {
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => 'Hello\x00World\x00Test',
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration variations', () => {
    it('should handle small column configuration', async () => {
      const service = new ScreenshotService(
        createConfig({ screenshotCols: 20 }),
        {
          capturePane: () => 'This is a test with some longer content',
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
    });

    it('should handle large column configuration', async () => {
      const service = new ScreenshotService(
        createConfig({ screenshotCols: 200 }),
        {
          capturePane: () => 'Wide terminal content here',
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
    });

    it('should handle small font size', async () => {
      const service = new ScreenshotService(
        createConfig({ screenshotFontSize: 8 }),
        {
          capturePane: () => 'Small font test',
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
    });

    it('should handle large font size', async () => {
      const service = new ScreenshotService(
        createConfig({ screenshotFontSize: 24 }),
        {
          capturePane: () => 'Large font test',
        }
      );

      const png = await service.capture(3284);
      expect(png).toBeInstanceOf(Buffer);
    });
  });

  describe('Error propagation', () => {
    it('should propagate capture errors with context', async () => {
      const customError = new Error('Custom capture failure');
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => {
            throw customError;
          },
        }
      );

      try {
        await service.capture(3284);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('capture');
      }
    });

    it('should handle rendering errors gracefully', async () => {
      // Test that rendering errors are properly caught
      const service = new ScreenshotService(
        createConfig(),
        {
          capturePane: () => 'test',
        }
      );

      // Mock the renderText method to throw
      const originalRender = (service as any).renderText.bind(service);
      (service as any).renderText = () => {
        throw new Error('SVG rendering failed');
      };

      await expect(service.capture(3284)).rejects.toThrow('SVG');

      // Restore
      (service as any).renderText = originalRender;
    });
  });
});
