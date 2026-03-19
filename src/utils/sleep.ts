/**
 * OpenSofa - Sleep Utility
 * 
 * Promisified setTimeout for async delays.
 */

/**
 * Sleep for a specified number of milliseconds
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}