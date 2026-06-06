/**
 * `useState` that mirrors its value to `localStorage` under `key`, so a layout/UI preference (split
 * ratio, sidebar collapsed) survives reloads. Reads the stored value on init (falling back to
 * `initialValue`), and writes on every update. Storage failures are ignored (private mode, quota).
 */
import { useCallback, useState } from 'react';

export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* unreadable storage — fall back to the initial value */
    }
    return initialValue;
  });

  const setPersisted = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* persistence is best-effort */
        }
        return next;
      });
    },
    [key],
  );

  return [state, setPersisted];
}
