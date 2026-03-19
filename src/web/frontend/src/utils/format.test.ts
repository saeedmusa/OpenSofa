/**
 * Tests for format utilities
 */

import { describe, it, expect } from 'vitest';
import { formatSize, formatRelativeTime, formatDuration } from '../utils/format';

describe('formatSize', () => {
  it('should format bytes', () => {
    expect(formatSize(0)).toBe('0B');
    expect(formatSize(100)).toBe('100B');
    expect(formatSize(1023)).toBe('1023B');
  });

  it('should format kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0K');
    expect(formatSize(1536)).toBe('1.5K');
    expect(formatSize(1024 * 100)).toBe('100.0K');
  });

  it('should format megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0M');
    expect(formatSize(1024 * 1024 * 5.5)).toBe('5.5M');
    expect(formatSize(1024 * 1024 * 100)).toBe('100.0M');
  });
});

describe('formatRelativeTime', () => {
  it('should format minutes', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 1000)).toBe('0m'); // 1 second ago
    expect(formatRelativeTime(now - 60000)).toBe('1m'); // 1 minute ago
    expect(formatRelativeTime(now - 60000 * 30)).toBe('30m'); // 30 minutes ago
    expect(formatRelativeTime(now - 60000 * 59)).toBe('59m'); // 59 minutes ago
  });

  it('should format hours', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60000 * 60)).toBe('1h'); // 1 hour ago
    expect(formatRelativeTime(now - 60000 * 60 * 12)).toBe('12h'); // 12 hours ago
    expect(formatRelativeTime(now - 60000 * 60 * 23)).toBe('23h'); // 23 hours ago
  });

  it('should format days', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60000 * 60 * 24)).toBe('1d'); // 1 day ago
    expect(formatRelativeTime(now - 60000 * 60 * 24 * 7)).toBe('7d'); // 7 days ago
  });
});

describe('formatDuration', () => {
  it('should format seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('should format minutes', () => {
    expect(formatDuration(60)).toBe('1m 0s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });

  it('should format hours', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3661)).toBe('1h 1m');
    expect(formatDuration(7325)).toBe('2h 2m');
  });
});
