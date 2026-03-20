/**
 * Safe haptic feedback — wraps navigator.vibrate in try-catch.
 * Chrome blocks vibrate calls without a user gesture; this silently handles that.
 */
export function safeVibrate(pattern: number | number[] = 30): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Blocked by browser (no user gesture) — non-critical, ignore
  }
}
