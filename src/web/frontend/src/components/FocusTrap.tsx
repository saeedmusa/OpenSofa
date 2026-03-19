import { useEffect, useRef, useCallback, type ReactNode } from 'react';

interface FocusTrapProps {
  active: boolean;
  children: ReactNode;
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function FocusTrap({ active, children, onEscape }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }, []);

  useEffect(() => {
    if (active) {
      previousFocus.current = document.activeElement as HTMLElement;
      
      const container = containerRef.current;
      if (container) {
        const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        firstFocusable?.focus();
      }
    }

    return () => {
      if (active && previousFocus.current) {
        previousFocus.current.focus();
      }
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape, getFocusableElements]);

  return (
    <div ref={containerRef} {...(active && { 'aria-modal': true, role: 'dialog' })}>
      {children}
    </div>
  );
}
