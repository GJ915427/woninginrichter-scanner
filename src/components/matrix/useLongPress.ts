import { useRef, useCallback, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { isGestureBeyondThreshold } from '../../utils/matrix-overlay-state';

export interface UseLongPressOptions {
  onLongPress: (e: ReactMouseEvent | ReactTouchEvent) => void;
  onClick?: (e: ReactMouseEvent) => void;
  thresholdMs?: number;
  moveTolerancePx?: number;
}

/**
 * Custom hook voor Fitts' Law touch long-press en click-bleed onderdrukking.
 * - Activeert na 500ms continue hold (zonder te wachten op release).
 * - Annuleert deterministisch bij beweging > 10px (scrollen).
 * - Onderschept de navolgende synthetische click via onClickCapture (prevent click-bleed).
 */
export function useLongPress({
  onLongPress,
  onClick,
  thresholdMs = 500,
  moveTolerancePx = 10,
}: UseLongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);
  const savedEventRef = useRef<ReactMouseEvent | ReactTouchEvent | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const start = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      // Alleen primaire muisknop of touch
      if ('button' in e && e.button !== 0) return;

      isLongPressTriggeredRef.current = false;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startCoordsRef.current = { x: clientX, y: clientY };
      savedEventRef.current = e;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        if (savedEventRef.current) {
          onLongPress(savedEventRef.current);
        }
      }, thresholdMs);
    },
    [onLongPress, thresholdMs]
  );

  const move = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      if (!startCoordsRef.current || !timerRef.current) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      if (
        isGestureBeyondThreshold(
          startCoordsRef.current.x,
          startCoordsRef.current.y,
          clientX,
          clientY,
          moveTolerancePx
        )
      ) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        startCoordsRef.current = null;
      }
    },
    [moveTolerancePx]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startCoordsRef.current = null;
    savedEventRef.current = null;
  }, []);

  const handleClickCapture = useCallback(
    (e: ReactMouseEvent) => {
      if (isLongPressTriggeredRef.current) {
        e.preventDefault();
        e.stopPropagation();
        // Reset flag na onderdrukking
        isLongPressTriggeredRef.current = false;
      } else if (onClick) {
        onClick(e);
      }
    },
    [onClick]
  );

  return {
    handlers: {
      onMouseDown: start,
      onTouchStart: start,
      onMouseMove: move,
      onTouchMove: move,
      onMouseUp: cancel,
      onTouchEnd: cancel,
      onMouseLeave: cancel,
      onTouchCancel: cancel,
      onClickCapture: handleClickCapture,
    },
    isLongPressTriggered: () => isLongPressTriggeredRef.current,
  };
}
