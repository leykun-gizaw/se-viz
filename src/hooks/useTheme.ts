/**
 * Theme state. Light is the default; the toggle flips `data-theme` on <html>, which re-resolves every
 * `--se-*` token (see index.css). The choice is persisted to `localStorage` (key `se-viz-theme`) and
 * applied before first paint by the inline script in `index.html`, so an instructor's preference
 * survives reloads with no flash.
 */
import { useCallback, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'se-viz-theme';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Apply a theme to <html> and persist it (best-effort; ignores storage failures). */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.style.background = theme === 'light' ? '#f5f4f1' : '#0d0e11';
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* persistence is best-effort */
  }
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const nextTheme: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  return { theme, toggle };
}
