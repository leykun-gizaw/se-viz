/**
 * The Studio timeline (Phase 28) — bottom of the stage. A step bar (a range input, so it's keyboard
 * operable and replaces the top bar's scrub) with tick marks at derived events, and a row of
 * labeled event markers ("factorial(3) called", "loop iteration 2") that jump to their step.
 * Markers come from {@link deriveTimelineMarkers}: when nothing reliable can be derived, there are
 * none.
 */
import { useEffect, useMemo, useRef } from 'react';
import { deriveTimelineMarkers } from '../../engine/trace/timeline.ts';
import type { TracePlayer } from '../../engine/trace/useTrace.ts';

/** Thumb diameter in px — must match `.se-timeline` in index.css (ticks are centred on it). */
const THUMB = 14;

/** CSS `left` for step `i` of `total`, aligned with the range thumb's centre. */
function position(i: number, total: number): string {
  const f = total <= 1 ? 0.5 : i / (total - 1);
  return `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${f})`;
}

export function Timeline({ player }: { player: TracePlayer }) {
  const { trace, index, total } = player;
  const markers = useMemo(() => deriveTimelineMarkers(trace), [trace]);
  // The most recent marker at or before the current step — the event you're "in".
  const currentMarker = [...markers].reverse().find((m) => m.index <= index);

  // Keep the current event chip in view as the trace plays (scrolls only the chip row).
  const rowRef = useRef<HTMLOListElement>(null);
  const currentIndex = currentMarker?.index;
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!row || !chip) return;
    const left = chip.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = Math.max(0, left - 16);
    }
  }, [currentIndex]);

  return (
    <div className="shrink-0 border-t border-hairline bg-surface px-4 pb-2.5 pt-2">
      <div className="flex items-center gap-3">
        <div className="relative h-6 min-w-0 flex-1">
          {/* Track, progress fill, and event ticks (decorative; the input below is the control). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3"
          />
          <div
            aria-hidden="true"
            style={{ width: position(index, total) }}
            className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-pointer"
          />
          {markers.map((m) => (
            <span
              key={m.index}
              aria-hidden="true"
              style={{ left: position(m.index, total) }}
              className={`pointer-events-none absolute top-0.5 h-5 w-0.5 -translate-x-1/2 rounded-full ${
                m.index <= index ? 'bg-ink-muted' : 'bg-hairline-strong'
              }`}
            />
          ))}
          <input
            type="range"
            min={0}
            max={Math.max(total - 1, 0)}
            value={index}
            aria-label="Timeline: jump to a step"
            aria-valuetext={`Step ${index + 1} of ${total}`}
            onChange={(e) => player.goTo(Number(e.target.value))}
            className="se-timeline absolute inset-0"
          />
        </div>
        <span className="shrink-0 font-mono text-[11px] text-ink-muted">
          Step <span className="font-semibold text-ink">{index + 1}</span> / {total}
        </span>
      </div>

      {markers.length > 0 ? (
        <ol ref={rowRef} aria-label="Events" className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
          {markers.map((m) => {
            const current = m === currentMarker;
            return (
              <li key={m.index} className="shrink-0">
                <button
                  type="button"
                  onClick={() => player.goTo(m.index)}
                  aria-current={current ? 'step' : undefined}
                  title={`Jump to step ${m.index + 1}: ${m.label}`}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 font-sans text-[12px] transition-colors ${
                    current
                      ? 'border-active/60 bg-active-soft text-ink'
                      : m.index <= index
                        ? 'border-hairline bg-surface-2 text-ink hover:bg-surface-3'
                        : 'border-hairline bg-surface text-ink-muted hover:bg-surface-2'
                  }`}
                >
                  <span className="font-mono text-[10px] text-ink-faint">{m.index + 1}</span>
                  {m.label}
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
