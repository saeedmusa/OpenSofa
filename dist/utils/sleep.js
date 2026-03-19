/**
 * OpenSofa - Sleep Utility
 *
 * Promisified setTimeout for async delays.
 */
/**
 * Sleep for a specified number of milliseconds
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=sleep.js.map