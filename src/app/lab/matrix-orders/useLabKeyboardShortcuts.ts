'use client';

// [VISUAL-MUTATION-AUTHORIZED: Geïsoleerde /lab/matrix-orders UX Spike route conform HITL verzoek]
import { useEffect } from 'react';
import { ActiveOverlay } from '@/types/matrix';

export interface UseLabKeyboardShortcutsParams {
  goToNextOrder: () => void;
  goToPreviousOrder: () => void;
  activeOverlay: ActiveOverlay | null;
  closeOverlay: () => void;
}

/**
 * useLabKeyboardShortcuts (INV-GOV-22)
 * Gecolokeerde custom hook voor ergonomische toetsenbordnavigatie op de lab-route.
 * Handelt Alt+ArrowRight / Alt+ArrowLeft order switching en Escape overlay closing af.
 * Vrijwaart page.tsx van window event listener ballast (< 50 LOC).
 */
export function useLabKeyboardShortcuts({
  goToNextOrder,
  goToPreviousOrder,
  activeOverlay,
  closeOverlay,
}: UseLabKeyboardShortcutsParams): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeOverlay !== null) {
        e.preventDefault();
        closeOverlay();
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        if (
          target?.matches?.('input, textarea, select, [contenteditable="true"]') ||
          activeOverlay !== null
        ) {
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextOrder();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPreviousOrder();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToNextOrder, goToPreviousOrder, activeOverlay, closeOverlay]);
}
