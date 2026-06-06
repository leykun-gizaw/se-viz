/**
 * CoachBubble (Phase 17) — the chess.com-style coach pop-up. When the current step has a
 * {@link CoachNote}, this overlays a small typed bubble that **points at the element it's about**
 * (resolved by `data-coach-anchor` / `data-coach-line` within the stage content box) with a tail, or
 * sits in a consistent fallback corner when there's no anchor. It auto-appears, is dismissable
 * (close button / `Esc` / click-away) without blocking stepping, and — because the caller keys it by
 * step — reappears when you step back. Honors `prefers-reduced-motion`.
 *
 * Positioning is collision-aware (see `placeCoachBubble`); the bubble is re-measured on resize,
 * scroll, and layout settle so it tracks its anchor.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  coachVariantMeta,
  fallbackPlacement,
  placeCoachBubble,
  type TailSide,
} from '../engine/trace/coach.ts';
import type { CoachNote, CoachVariant } from '../engine/trace/types.ts';

/** Small per-variant glyph, drawn from scratch so it inherits the accent color. */
function VariantIcon({ variant }: { variant: CoachVariant }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  switch (variant) {
    case 'idea': // lightbulb
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.1V16h6v-.4c0-.8.4-1.5 1-2.1A6 6 0 0 0 12 3z" />
        </svg>
      );
    case 'watch-out': // triangle !
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12 3l9 16H3l9-16z" />
          <path d="M12 9v5M12 17h.01" />
        </svg>
      );
    case 'predict': // question
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.2 9.3a2.8 2.8 0 0 1 5.3 1.2c0 1.8-2.5 2.2-2.5 3.8M12 17h.01" />
        </svg>
      );
    case 'recap': // checklist
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h10M4 12h10M4 18h7M17 7l2 2 3-3.5" />
        </svg>
      );
  }
}

interface Placement {
  left: number;
  top: number;
  tail: TailSide | null;
  tailOffset: number;
}

/** Find an element inside `root` whose attribute equals `value` (escape-free, exact match). */
function findByAttr(root: HTMLElement, attr: string, value: string): Element | null {
  for (const el of root.querySelectorAll(`[${attr}]`)) {
    if (el.getAttribute(attr) === value) return el;
  }
  return null;
}

export interface CoachBubbleProps {
  note: CoachNote;
  /** The stage content box the bubble is positioned within (and queried for anchors). */
  containerRef: RefObject<HTMLElement | null>;
}

export function CoachBubble({ note, containerRef }: CoachBubbleProps) {
  const reduce = useReducedMotion();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const meta = coachVariantMeta(note.variant);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const bubbleEl = bubbleRef.current;
    if (!container || !bubbleEl) return;
    const cRect = container.getBoundingClientRect();
    const bubble = { width: bubbleEl.offsetWidth, height: bubbleEl.offsetHeight };
    const size = { width: cRect.width, height: cRect.height };

    let anchorEl: Element | null = null;
    if (note.anchorId) anchorEl = findByAttr(container, 'data-coach-anchor', note.anchorId);
    if (!anchorEl && note.anchorLine !== undefined) {
      anchorEl = findByAttr(container, 'data-coach-line', String(note.anchorLine));
    }

    if (anchorEl) {
      const a = anchorEl.getBoundingClientRect();
      const anchor = {
        x: a.left - cRect.left,
        y: a.top - cRect.top,
        width: a.width,
        height: a.height,
      };
      setPlacement(placeCoachBubble(anchor, size, bubble));
    } else {
      const fb = fallbackPlacement(size, bubble);
      setPlacement({ left: fb.left, top: fb.top, tail: null, tailOffset: 0 });
    }
  }, [containerRef, note.anchorId, note.anchorLine]);

  // Measure after layout, and keep tracking the anchor across resize / scroll / spring settle.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    window.addEventListener('resize', measure);
    // Capture-phase scroll catches inner scroll containers (the memory canvas).
    window.addEventListener('scroll', measure, true);
    const raf = requestAnimationFrame(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      cancelAnimationFrame(raf);
    };
  }, [measure, containerRef]);

  // Esc dismisses (in presentation the global Esc also exits — acceptable). Click-away dismisses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissed(true);
    };
    const onDown = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) setDismissed(true);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  // Tail: a small rotated square poking out of the bubble edge toward the anchor.
  const tailStyle: React.CSSProperties = { position: 'absolute' };
  if (placement?.tail === 'left')
    Object.assign(tailStyle, { left: -5, top: placement.tailOffset - 5 });
  else if (placement?.tail === 'right')
    Object.assign(tailStyle, { right: -5, top: placement.tailOffset - 5 });
  else if (placement?.tail === 'top')
    Object.assign(tailStyle, { top: -5, left: placement.tailOffset - 5 });
  else if (placement?.tail === 'bottom')
    Object.assign(tailStyle, { bottom: -5, left: placement.tailOffset - 5 });

  return (
    <AnimatePresence>
      {!dismissed ? (
        <motion.div
          ref={bubbleRef}
          role="status"
          aria-live="polite"
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          transition={{ duration: reduce ? 0 : 0.16, ease: 'easeOut' }}
          style={{
            left: placement?.left ?? 0,
            top: placement?.top ?? 0,
            // Hide until first measured to avoid a flash at (0,0).
            visibility: placement ? 'visible' : 'hidden',
          }}
          className={`pointer-events-auto absolute z-30 w-64 max-w-[18rem] rounded-lg border bg-surface p-3 shadow-none ${meta.accentBorder}`}
        >
          {placement?.tail ? (
            <span
              aria-hidden="true"
              style={tailStyle}
              className={`h-[10px] w-[10px] rotate-45 border bg-surface ${meta.accentBorder}`}
            />
          ) : null}

          <div className="mb-1 flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded ${meta.accentBg} ${meta.accentText}`}
            >
              <VariantIcon variant={note.variant} />
            </span>
            <span
              className={`font-sans text-[11px] font-semibold uppercase tracking-wide ${meta.accentText}`}
            >
              {note.title ?? meta.label}
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss coach note"
              title="Dismiss (Esc)"
              className="ml-auto flex h-5 w-5 items-center justify-center rounded text-ink-faint hover:bg-surface-3 hover:text-ink"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <p className="font-sans text-[13px] leading-snug text-ink">{note.body}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
