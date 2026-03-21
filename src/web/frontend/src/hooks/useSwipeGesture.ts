import { useRef, useCallback, useEffect } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // Minimum distance in px (default: 50)
  disabled?: boolean;
}

interface TouchStart {
  x: number;
  y: number;
  time: number;
}

/**
 * Hook for detecting swipe gestures on touch devices.
 * 
 * Features:
 * - 50px threshold to prevent accidental triggers
 * - Horizontal swipe detection (ignores vertical scrolls)
 * - Disabled during text input (prevents keyboard conflicts)
 * - Works on iOS Safari and Android Chrome
 */
export function useSwipeGesture<T extends HTMLElement>(
  options: SwipeGestureOptions
): React.RefObject<T | null> {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    disabled = false,
  } = options;

  const ref = useRef<T>(null);
  const touchStart = useRef<TouchStart | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;

    // Skip if target is an input/textarea (keyboard conflict prevention)
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, [disabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (disabled || !touchStart.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const elapsed = Date.now() - touchStart.current.time;

    touchStart.current = null;

    // Only process if:
    // 1. Horizontal movement exceeds threshold
    // 2. Horizontal movement is greater than vertical (not a scroll)
    // 3. Gesture completed within 500ms (not a slow drag)
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < threshold || absY > absX || elapsed > 500) {
      return;
    }

    if (deltaX > 0 && onSwipeRight) {
      onSwipeRight();
    } else if (deltaX < 0 && onSwipeLeft) {
      onSwipeLeft();
    }
  }, [disabled, threshold, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return ref;
}
