/**
 * Tests for terminal utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  getResponsiveDimensions,
  TERMINAL_DIMENSIONS,
  DEFAULT_TERMINAL_DIMENSIONS,
} from '../utils/terminal';

describe('getResponsiveDimensions', () => {
  it('should return mobile dimensions for small screens', () => {
    const result = getResponsiveDimensions(320);
    expect(result).toEqual({ cols: 80, rows: 24 });
  });

  it('should return mobile dimensions for screens just below tablet breakpoint', () => {
    const result = getResponsiveDimensions(767);
    expect(result).toEqual({ cols: 80, rows: 24 });
  });

  it('should return tablet dimensions at tablet breakpoint', () => {
    const result = getResponsiveDimensions(768);
    expect(result).toEqual({ cols: 120, rows: 36 });
  });

  it('should return tablet dimensions for medium screens', () => {
    const result = getResponsiveDimensions(900);
    expect(result).toEqual({ cols: 120, rows: 36 });
  });

  it('should return tablet dimensions for screens just below desktop breakpoint', () => {
    const result = getResponsiveDimensions(1023);
    expect(result).toEqual({ cols: 120, rows: 36 });
  });

  it('should return desktop dimensions at desktop breakpoint', () => {
    const result = getResponsiveDimensions(1024);
    expect(result).toEqual({ cols: 200, rows: 50 });
  });

  it('should return desktop dimensions for large screens', () => {
    const result = getResponsiveDimensions(1920);
    expect(result).toEqual({ cols: 200, rows: 50 });
  });

  it('should return desktop dimensions for very large screens', () => {
    const result = getResponsiveDimensions(3840); // 4K
    expect(result).toEqual({ cols: 200, rows: 50 });
  });

  it('should handle zero width', () => {
    const result = getResponsiveDimensions(0);
    expect(result).toEqual({ cols: 80, rows: 24 });
  });

  it('should handle negative width gracefully', () => {
    const result = getResponsiveDimensions(-100);
    expect(result).toEqual({ cols: 80, rows: 24 });
  });

  it('should handle decimal widths', () => {
    const result = getResponsiveDimensions(767.9);
    expect(result).toEqual({ cols: 80, rows: 24 });
  });
});

describe('TERMINAL_DIMENSIONS constant', () => {
  it('should have mobile dimensions', () => {
    expect(TERMINAL_DIMENSIONS.mobile).toEqual({ cols: 80, rows: 24 });
  });

  it('should have tablet dimensions', () => {
    expect(TERMINAL_DIMENSIONS.tablet).toEqual({ cols: 120, rows: 36 });
  });

  it('should have desktop dimensions', () => {
    expect(TERMINAL_DIMENSIONS.desktop).toEqual({ cols: 200, rows: 50 });
  });

  it('should have increasing column counts', () => {
    expect(TERMINAL_DIMENSIONS.mobile.cols).toBeLessThan(TERMINAL_DIMENSIONS.tablet.cols);
    expect(TERMINAL_DIMENSIONS.tablet.cols).toBeLessThan(TERMINAL_DIMENSIONS.desktop.cols);
  });

  it('should have increasing row counts', () => {
    expect(TERMINAL_DIMENSIONS.mobile.rows).toBeLessThan(TERMINAL_DIMENSIONS.tablet.rows);
    expect(TERMINAL_DIMENSIONS.tablet.rows).toBeLessThan(TERMINAL_DIMENSIONS.desktop.rows);
  });
});

describe('DEFAULT_TERMINAL_DIMENSIONS', () => {
  it('should equal tablet dimensions', () => {
    expect(DEFAULT_TERMINAL_DIMENSIONS).toEqual(TERMINAL_DIMENSIONS.tablet);
  });

  it('should have valid cols and rows', () => {
    expect(DEFAULT_TERMINAL_DIMENSIONS.cols).toBeGreaterThan(0);
    expect(DEFAULT_TERMINAL_DIMENSIONS.rows).toBeGreaterThan(0);
  });
});

describe('Dimension bounds', () => {
  it('should never return dimensions below VT100 minimum', () => {
    // VT100 minimum is 80x24
    const results = [
      getResponsiveDimensions(0),
      getResponsiveDimensions(100),
      getResponsiveDimensions(500),
      getResponsiveDimensions(767),
    ];
    
    for (const result of results) {
      expect(result.cols).toBeGreaterThanOrEqual(80);
      expect(result.rows).toBeGreaterThanOrEqual(24);
    }
  });

  it('should never exceed reasonable maximums', () => {
    // Max should be reasonable for most use cases
    const results = [
      getResponsiveDimensions(1024),
      getResponsiveDimensions(2000),
      getResponsiveDimensions(5000),
    ];
    
    for (const result of results) {
      expect(result.cols).toBeLessThanOrEqual(200);
      expect(result.rows).toBeLessThanOrEqual(50);
    }
  });
});
