import { useCallback, useRef } from 'react';

/**
 * Hold-to-repeat: fires once immediately, then repeats after `delay`ms
 * at `interval`ms. Accelerates to `fastInterval` after `accelAfter` repeats.
 */
export function useRepeatAction(
  action: () => void,
  delay = 280,
  interval = 100,
  fastInterval = 40,
  accelAfter = 6,
) {
  const timeoutRef = useRef<number>(0);
  const intervalRef = useRef<number>(0);
  const countRef = useRef(0);

  const stop = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
    countRef.current = 0;
  }, []);

  const start = useCallback(() => {
    action();
    countRef.current = 0;

    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        countRef.current++;
        action();
        if (countRef.current === accelAfter) {
          clearInterval(intervalRef.current);
          intervalRef.current = window.setInterval(action, fastInterval);
        }
      }, interval);
    }, delay);
  }, [action, delay, interval, fastInterval, accelAfter]);

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  };
}
