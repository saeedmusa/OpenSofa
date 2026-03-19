import { useState, useEffect, useCallback } from 'react';

interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => ({
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : true,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth < 1024 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : false,
    isTouch: typeof window !== 'undefined' ? 'ontouchstart' in window : false,
  }));

  const handleResize = useCallback(() => {
    setState({
      isMobile: window.innerWidth < 768,
      isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
      isDesktop: window.innerWidth >= 1024,
      isTouch: 'ontouchstart' in window,
    });
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedResize);
    };
  }, [handleResize]);

  return state;
}
