import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

describe('useOnlineStatus', () => {
  it('should return true when online', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('should return false when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });
});
