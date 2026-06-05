/**
 * Theme state. Dark is primary; the toggle flips `data-theme` on <html>, which re-resolves every
 * `--se-*` token (see index.css). No persistence (out of scope for Phase 1).
 */
import { useCallback, useState } from 'react';

export type Theme = 'dark' | 'light';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const nextTheme: Theme = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nextTheme;
      return nextTheme;
    });
  }, []);

  return { theme, toggle };
}
