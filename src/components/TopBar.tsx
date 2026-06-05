/**
 * The slim top bar: SE-Viz mark, the lesson breadcrumb (course · topic · file), the transport
 * cluster, and the theme + presentation toggles.
 *
 * Breadcrumb segments come straight from {@link Trace} metadata, which is sourced from
 * `docs/CURRICULUM.md` — course codes are never fabricated here (the design exploration's "SE 220"
 * for static libraries was wrong; the data layer is the single source of truth).
 */
import type { TracePlayer } from '../engine/trace/useTrace.ts';
import type { Theme } from '../hooks/useTheme.ts';
import { Transport } from './Transport.tsx';

function Mark() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pointer text-white">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 4l16 8-16 8 4-8-4-8z" />
        </svg>
      </span>
      <span className="font-sans text-sm font-bold tracking-tight text-ink">SE-Viz</span>
    </div>
  );
}

function Breadcrumb({ player }: { player: TracePlayer }) {
  const { trace } = player;
  const segments = [trace.course, trace.topic, trace.file].filter(Boolean) as string[];
  if (segments.length === 0) segments.push(trace.title);
  return (
    <nav aria-label="Lesson" className="flex items-center gap-2 font-sans text-xs text-ink-muted">
      {segments.map((seg, i) => (
        <span key={seg} className="flex items-center gap-2">
          {i > 0 ? <span className="text-ink-faint">›</span> : null}
          <span className={i === segments.length - 1 ? 'font-semibold text-ink' : ''}>{seg}</span>
        </span>
      ))}
    </nav>
  );
}

export interface TopBarProps {
  player: TracePlayer;
  theme: Theme;
  onToggleTheme: () => void;
  onEnterPresentation: () => void;
}

export function TopBar({ player, theme, onToggleTheme, onEnterPresentation }: TopBarProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-hairline bg-surface px-4 py-2.5">
      <div className="flex items-center gap-4">
        <Mark />
        <span className="h-4 w-px bg-hairline" />
        <Breadcrumb player={player} />
      </div>
      <div className="flex items-center gap-3">
        <Transport player={player} />
        <span className="h-4 w-px bg-hairline" />
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink hover:bg-surface-3"
        >
          {theme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z" />
            </svg>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={onEnterPresentation}
          aria-label="Enter presentation mode"
          title="Presentation mode (f)"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink hover:bg-surface-3"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
