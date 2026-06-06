/**
 * A horizontal two-pane split with a draggable divider. Used in the workbench to let the instructor
 * trade width between the code panel (left) and the visualization (right) — drag the divider, or
 * focus it and use ←/→ for keyboard control. The ratio (left pane's fraction of the width) is
 * persisted via {@link usePersistentState} so it survives reloads.
 *
 * `interactive={false}` (presentation mode) renders a thin static divider that still honors the
 * saved ratio but can't be dragged — keeping the editing affordance out of the projected view.
 */
import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState.ts';

export interface SplitPaneProps {
  storageKey: string;
  defaultRatio: number;
  left: ReactNode;
  right: ReactNode;
  /** Min / max fraction the left pane may occupy. */
  minRatio?: number;
  maxRatio?: number;
  /** When false, the divider is a static line (no drag / focus) — e.g. presentation mode. */
  interactive?: boolean;
}

export function SplitPane({
  storageKey,
  defaultRatio,
  left,
  right,
  minRatio = 0.2,
  maxRatio = 0.8,
  interactive = true,
}: SplitPaneProps) {
  const [ratio, setRatio] = usePersistentState(storageKey, defaultRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const clamp = useCallback(
    (r: number) => Math.min(maxRatio, Math.max(minRatio, r)),
    [minRatio, maxRatio],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    // preventDefault suppresses the default focus, so focus explicitly to enable keyboard resizing.
    e.currentTarget.focus();
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      setRatio(clamp((e.clientX - rect.left) / rect.width));
    },
    [clamp, setRatio],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Stop ←/→ from also reaching the global step-navigation handler on window.
      if (e.key === 'ArrowLeft') {
        setRatio((r) => clamp(r - 0.02));
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'ArrowRight') {
        setRatio((r) => clamp(r + 0.02));
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [clamp, setRatio],
  );

  const leftFraction = clamp(ratio);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1">
      <div className="min-h-0 min-w-0" style={{ flexBasis: `${leftFraction * 100}%`, flexShrink: 0 }}>
        {left}
      </div>

      {interactive ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the code and visualization panels"
          aria-valuenow={Math.round(leftFraction * 100)}
          aria-valuemin={Math.round(minRatio * 100)}
          aria-valuemax={Math.round(maxRatio * 100)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          className="group relative mx-1 flex w-2 shrink-0 cursor-col-resize touch-none items-center justify-center"
        >
          <div className="h-full w-px bg-hairline transition-colors group-hover:bg-pointer group-focus-visible:bg-pointer" />
          <div className="absolute h-8 w-1 rounded-full bg-hairline-strong transition-colors group-hover:bg-pointer" />
        </div>
      ) : (
        <div className="mx-2 w-px shrink-0 bg-hairline" />
      )}

      <div className="min-h-0 min-w-0 flex-1">{right}</div>
    </div>
  );
}
