import { useRef, useCallback } from 'react';

/**
 * Rate-limited celebration hook.
 * Ensures max 1 celebration effect per session to avoid being intrusive.
 */
export const useCelebration = () => {
  const hasCelebrated = useRef(false);

  const celebrate = useCallback((callback: () => void) => {
    if (hasCelebrated.current) return;
    hasCelebrated.current = true;
    callback();
  }, []);

  const canCelebrate = !hasCelebrated.current;

  return { celebrate, canCelebrate };
};
