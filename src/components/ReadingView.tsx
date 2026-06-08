/**
 * The theory reading view (Phase 19) — shown in place of the Stage when a Theory entry is selected.
 * A typography-focused, scrollable, keyboard-accessible reading pane: a breadcrumb (course · topic ·
 * Theory), the document title, the rendered Markdown body, and a "Continue to the visualization →"
 * bridge that jumps to the topic's first module. Reuses the design tokens — no restyle — and works
 * in both themes at a comfortable, presentation-legible measure.
 */
import { useMemo } from 'react';
import { parseMarkdown } from '../engine/markdown.ts';
import type { TheoryDoc } from '../content/theory.ts';
import type { Theme } from '../hooks/useTheme.ts';
import { Markdown } from './Markdown.tsx';

function BookIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M4 19a2 2 0 0 0 2 2h13" />
    </svg>
  );
}

export interface ReadingViewProps {
  doc: TheoryDoc;
  /** The topic's first visualization module — target of the continue bridge (null if none). */
  firstModule: { id: string; label: string } | null;
  theme: Theme;
  onToggleTheme: () => void;
  /** Select another entry (used by the continue bridge to open the first module). */
  onSelect: (id: string) => void;
}

export function ReadingView({
  doc,
  firstModule,
  theme,
  onToggleTheme,
  onSelect,
}: ReadingViewProps) {
  const blocks = useMemo(() => parseMarkdown(doc.body), [doc.body]);
  const crumbs = [doc.course, doc.topic, 'Theory'];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-hairline bg-surface px-4 py-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pointer text-white">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M4 4l16 8-16 8 4-8-4-8z" />
              </svg>
            </span>
            <span className="font-sans text-sm font-bold tracking-tight text-ink">SE-Viz</span>
          </div>
          <span className="h-4 w-px bg-hairline" />
          <nav
            aria-label="Theory location"
            className="flex items-center gap-2 font-sans text-xs text-ink-muted"
          >
            {crumbs.map((seg, i) => (
              <span key={seg} className="flex items-center gap-2">
                {i > 0 ? <span className="text-ink-faint">›</span> : null}
                <span className={i === crumbs.length - 1 ? 'font-semibold text-ink' : ''}>
                  {seg}
                </span>
              </span>
            ))}
          </nav>
        </div>
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
      </header>

      <main
        tabIndex={0}
        aria-label={`${doc.title} — theory reading`}
        className="min-h-0 flex-1 overflow-auto bg-bg"
      >
        <article className="mx-auto max-w-[70ch] px-6 py-10 sm:px-10">
          <div className="mb-3 flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-pointer">
            <BookIcon />
            Theory · read first
          </div>
          <h1 className="mb-2 font-sans text-3xl font-bold tracking-tight text-ink">{doc.title}</h1>
          <p className="mb-8 font-sans text-sm text-ink-faint">
            {doc.course} · {doc.topic}
          </p>

          <Markdown blocks={blocks} />

          {firstModule ? (
            <div className="mt-12 border-t border-hairline pt-6">
              <button
                type="button"
                onClick={() => onSelect(firstModule.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-pointer bg-pointer-soft px-4 py-2.5 font-sans text-sm font-semibold text-pointer transition-colors hover:bg-pointer hover:text-white"
              >
                Continue to the visualization
                <span aria-hidden="true">→</span>
              </button>
              <p className="mt-2 font-sans text-xs text-ink-faint">
                Next: see <span className="text-ink-muted">{firstModule.label}</span> run.
              </p>
            </div>
          ) : null}
        </article>
      </main>
    </div>
  );
}
