'use client';

import { useEffect } from 'react';

export interface MatrixKeyboardShortcutsOptions {
  onNextOrder?: () => void;
  onPrevOrder?: () => void;
  onCloseOverlays?: () => void;
  activeOverlay?: unknown;
  isEnabled?: boolean;
}

export function useMatrixKeyboardShortcuts({
  onNextOrder,
  onPrevOrder,
  onCloseOverlays,
  activeOverlay,
  isEnabled = true,
}: MatrixKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeOverlay !== null && activeOverlay !== undefined) {
          e.preventDefault();
          onCloseOverlays?.();
          return;
        }
      }

      if (activeOverlay !== null && activeOverlay !== undefined) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNextOrder?.();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onPrevOrder?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled, onNextOrder, onPrevOrder, onCloseOverlays, activeOverlay]);
}
