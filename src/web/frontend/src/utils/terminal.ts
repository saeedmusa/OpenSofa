/**
 * Terminal dimension utilities for responsive sizing
 */

export interface TerminalDimensions {
  cols: number;
  rows: number;
}

/**
 * Default terminal dimensions for responsive sizing
 * 
 * - Mobile (<768px): 80 cols x 24 rows (standard VT100)
 * - Tablet (768-1024px): 120 cols x 36 rows
 * - Desktop (>1024px): 200 cols x 50 rows
 */
export const TERMINAL_DIMENSIONS = {
  mobile: { cols: 80, rows: 24 },
  tablet: { cols: 120, rows: 36 },
  desktop: { cols: 200, rows: 50 },
} as const;

/**
 * Get terminal dimensions based on viewport width
 */
export function getResponsiveDimensions(width: number): TerminalDimensions {
  if (width < 768) {
    return TERMINAL_DIMENSIONS.mobile;
  }
  if (width < 1024) {
    return TERMINAL_DIMENSIONS.tablet;
  }
  return TERMINAL_DIMENSIONS.desktop;
}

/**
 * Default dimensions to use when client size is unknown
 * Using tablet size as a reasonable middle ground
 */
export const DEFAULT_TERMINAL_DIMENSIONS: TerminalDimensions = TERMINAL_DIMENSIONS.tablet;
