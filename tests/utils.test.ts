/**
 * Tests for Utility Functions
 */

import { describe, it, expect } from 'vitest';
import { sleep } from '../src/utils/sleep.js';
import { expandPath, getConfigDir, getDbPath, getConfigPath } from '../src/utils/expand-path.js';

describe('Utils', () => {
  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
    });

    it('should resolve immediately for 0ms', async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it('should handle short sleeps accurately', async () => {
      const start = Date.now();
      await sleep(10);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(5);
    });
  });

  describe('expandPath', () => {
    it('should expand ~ to home directory', () => {
      const result = expandPath('~/test');
      expect(result).not.toContain('~');
      expect(result).toContain('test');
    });

    it('should return path unchanged if no ~', () => {
      const result = expandPath('/absolute/path');
      expect(result).toBe('/absolute/path');
    });

    it('should handle relative paths', () => {
      const result = expandPath('relative/path');
      expect(result).toBe('relative/path');
    });

    it('should expand ~/ with multiple path segments', () => {
      const result = expandPath('~/foo/bar/baz');
      expect(result).not.toContain('~');
      expect(result).toContain('foo');
      expect(result).toContain('bar');
      expect(result).toContain('baz');
    });

    it('should handle tilde only', () => {
      const result = expandPath('~');
      expect(result).not.toContain('~');
    });
  });

  describe('getConfigDir', () => {
    it('should return a valid directory path', () => {
      const dir = getConfigDir();
      expect(dir).toBeDefined();
      expect(dir.length).toBeGreaterThan(0);
      expect(dir).toContain('.opensofa');
    });
  });

  describe('getConfigPath', () => {
    it('should return config file path with .yaml extension', () => {
      const path = getConfigPath();
      expect(path).toBeDefined();
      expect(path).toContain('.yaml');
      expect(path).toContain('.opensofa');
    });
  });

  describe('getDbPath', () => {
    it('should return database file path with .db extension', () => {
      const path = getDbPath();
      expect(path).toBeDefined();
      expect(path).toContain('.db');
      expect(path).toContain('.opensofa');
    });
  });
});