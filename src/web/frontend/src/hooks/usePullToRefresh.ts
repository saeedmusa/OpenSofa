import { useState, useCallback, useRef } from 'react';
import { safeVibrate } from '../utils/haptics';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

interface UsePullToRefreshReturn {
  isRefreshing: boolean;
  pullProgress: number;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing || startY.current === 0) return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0 && window.scrollY === 0) {
      const progress = Math.min(diff / threshold, 1);
      setPullProgress(progress);
    }
  }, [isRefreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (pullProgress >= 1 && !isRefreshing) {
      setIsRefreshing(true);
      safeVibrate(30);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullProgress(0);
    startY.current = 0;
    currentY.current = 0;
  }, [pullProgress, isRefreshing, onRefresh]);

  return {
    isRefreshing,
    pullProgress,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
