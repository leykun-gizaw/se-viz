/**
 * The theory **slide deck** (Phase 20) — replaces the Phase 19 reading view. A theory doc is split
 * into slides on top-level `---` breaks and shown on a **fixed 16:9 canvas (1280×720) scaled to fit**
 * the viewport (CSS transform, centered, letterboxed) so every slide looks identical when screen-
 * shared. Slide 1 is an auto title slide built from the frontmatter; the rest are the authored
 * segments rendered at slide-scale type.
 *
 * Navigation: `Slide k / N`, prev/next buttons, progress dots, `←/→` (Home/End) keys, and a
 * fullscreen **presentation** surface (`f`, `Esc` to exit) — the primary screen-share view. A
 * persistent "Continue to the visualization →" bridge jumps to the topic's first module. Dark +
 * light; no slide-transition animation (reduced-motion safe); keyboard-accessible.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { parseMarkdown, splitSlides, type Block } from '../engine/markdown.ts';
import type { TheoryDoc } from '../content/theory.ts';
import type { Theme } from '../hooks/useTheme.ts';
import { Markdown } from './Markdown.tsx';

const SLIDE_W = 1280;
const SLIDE_H = 720;

type Slide = { kind: 'title' } | { kind: 'content'; blocks: Block[] };

function BookIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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

/** Scale that fits a fixed 1280×720 slide inside `ref`'s box (with a little letterbox breathing room). */
function useFitScale(ref: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setScale(Math.min(w / SLIDE_W, h / SLIDE_H) * 0.96);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

function TitleSlide({ doc }: { doc: TheoryDoc }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="mb-5 flex items-center gap-2 font-sans text-[18px] font-semibold uppercase tracking-[0.18em] text-pointer">
        <BookIcon size={22} />
        Theory
      </div>
      <h1 className="font-sans text-[64px] font-bold leading-[1.05] tracking-tight text-ink">
        {doc.title}
      </h1>
      <p className="mt-5 font-sans text-[26px] text-ink-muted">
        {doc.course} · {doc.topic}
      </p>
      <p className="mt-12 font-sans text-[17px] text-ink-faint">
        Use → / ← to move between slides · press f for fullscreen
      </p>
    </div>
  );
}

/** The 1280×720 slide, scaled to fit its own container and letterboxed. Self-measuring. */
function SlideStage({ slide, doc, place }: { slide: Slide; doc: TheoryDoc; place: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scale = useFitScale(ref);
  return (
    <div
      ref={ref}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-bg"
    >
      <div
        style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
        className="shrink-0 origin-center overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl"
      >
        <div className="flex h-full w-full flex-col overflow-y-auto px-20 py-16">
          {slide.kind === 'title' ? (
            <TitleSlide doc={doc} />
          ) : (
            <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Markdown blocks={slide.blocks} scale="slide" place={place} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function Dots({
  total,
  current,
  onSelect,
}: {
  total: number;
  current: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Go to slide ${i + 1}`}
          aria-current={i === current ? 'true' : undefined}
          className={`h-1.5 rounded-full transition-all ${
            i === current ? 'w-5 bg-pointer' : 'w-1.5 bg-surface-3 hover:bg-hairline-strong'
          }`}
        />
      ))}
    </div>
  );
}

export interface TheoryDeckProps {
  doc: TheoryDoc;
  /** The topic's first visualization module — target of the continue bridge (null if none). */
  firstModule: { id: string; label: string } | null;
  theme: Theme;
  onToggleTheme: () => void;
  /** Select another entry (used by the continue bridge to open the first module). */
  onSelect: (id: string) => void;
}

export function TheoryDeck({ doc, firstModule, theme, onToggleTheme, onSelect }: TheoryDeckProps) {
  const slides = useMemo<Slide[]>(() => {
    const content = splitSlides(doc.body).map(
      (seg): Slide => ({ kind: 'content', blocks: parseMarkdown(seg) }),
    );
    return [{ kind: 'title' }, ...content];
  }, [doc.body]);

  const total = slides.length;
  const [current, setCurrent] = useState(0);
  const [presenting, setPresenting] = useState(false);

  const go = useCallback((n: number) => setCurrent(Math.min(total - 1, Math.max(0, n))), [total]);
  const next = useCallback(() => setCurrent((c) => Math.min(total - 1, c + 1)), [total]);
  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          go(0);
          break;
        case 'End':
          e.preventDefault();
          go(total - 1);
          break;
        case 'f':
        case 'F':
          setPresenting((p) => !p);
          break;
        case 'Escape':
          setPresenting(false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, go, total]);

  const slide = slides[current];
  const place = `"${doc.title}" slide ${current + 1}`;

  const continueButton = firstModule ? (
    <button
      type="button"
      onClick={() => onSelect(firstModule.id)}
      title={`Continue to ${firstModule.label}`}
      className="inline-flex items-center gap-2 rounded-md border border-pointer bg-pointer-soft px-3 py-1.5 font-sans text-xs font-semibold text-pointer transition-colors hover:bg-pointer hover:text-white"
    >
      Continue to the visualization
      <span aria-hidden="true">→</span>
    </button>
  ) : null;

  const transport = (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-ink-muted">
        Slide <span className="font-semibold text-ink">{current + 1}</span> / {total}
      </span>
      <div className="flex items-center gap-1.5">
        <NavButton label="Previous slide" onClick={prev} disabled={current === 0}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </NavButton>
        <NavButton label="Next slide" onClick={next} disabled={current === total - 1}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </NavButton>
      </div>
      <Dots total={total} current={current} onSelect={go} />
    </div>
  );

  if (presenting) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg">
        <SlideStage slide={slide} doc={doc} place={place} />
        <div className="flex items-center justify-between gap-4 border-t border-hairline bg-surface px-6 py-3">
          {transport}
          <div className="flex items-center gap-2">
            {continueButton}
            <button
              type="button"
              onClick={() => setPresenting(false)}
              title="Exit fullscreen (Esc)"
              className="rounded-md border border-hairline bg-surface-2 px-3 py-1.5 font-sans text-xs text-ink hover:bg-surface-3"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            {[doc.course, doc.topic, 'Theory'].map((seg, i, arr) => (
              <span key={seg} className="flex items-center gap-2">
                {i > 0 ? <span className="text-ink-faint">›</span> : null}
                <span className={i === arr.length - 1 ? 'font-semibold text-ink' : ''}>{seg}</span>
              </span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPresenting(true)}
            aria-label="Enter fullscreen presentation"
            title="Fullscreen presentation (f)"
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
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink hover:bg-surface-3"
          >
            {theme === 'dark' ? (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
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
        </div>
      </header>

      <SlideStage slide={slide} doc={doc} place={place} />

      <footer className="flex items-center justify-between gap-4 border-t border-hairline bg-surface px-4 py-2.5">
        {transport}
        {continueButton}
      </footer>
    </div>
  );
}
