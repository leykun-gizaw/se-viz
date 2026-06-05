/**
 * The narration bar at the bottom: an amber step marker, the current step's narration, and the
 * progress dots from the design (filled = visited, amber = current, faint = remaining).
 */
import type { TracePlayer } from '../engine/trace/useTrace.ts';

function ProgressDots({ index, total }: { index: number; total: number }) {
  // Cap the dot count so long traces stay tidy.
  const max = 16;
  const count = Math.min(total, max);
  const activeDot = total <= max ? index : Math.round((index / (total - 1)) * (count - 1));
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-1 w-3 rounded-full ${
            i === activeDot ? 'bg-active' : i < activeDot ? 'bg-pointer' : 'bg-surface-3'
          }`}
        />
      ))}
    </div>
  );
}

export function NarrationBar({
  player,
  presenting = false,
}: {
  player: TracePlayer;
  presenting?: boolean;
}) {
  const { step, index, total } = player;
  return (
    <div className="flex items-center justify-between gap-6 border-t border-hairline bg-surface px-5 py-3">
      <p
        aria-live="polite"
        className={`flex items-start gap-3 ${presenting ? 'text-base' : 'text-sm'} text-ink`}
      >
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-active" />
        <span>{step.narration}</span>
      </p>
      <ProgressDots index={index} total={total} />
    </div>
  );
}
