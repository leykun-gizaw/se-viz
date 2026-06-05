/**
 * The narration bar at the bottom: an amber step marker, an optional condition chip (branch/loop
 * test, e.g. `i <= n → true`), the current step's narration, and the progress dots from the design
 * (filled = visited, amber = current, faint = remaining).
 */
import type { StepCondition } from '../engine/trace/types.ts';
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

/** A condition test rendered as a chip: `expr → true` (green) or `expr → false` (muted). */
function ConditionChip({ condition }: { condition: StepCondition }) {
  const { expr, result } = condition;
  return (
    <span
      className={`se-code inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
        result
          ? 'border-changed bg-changed-soft text-changed'
          : 'border-hairline bg-surface-2 text-ink-muted'
      }`}
    >
      {expr} <span aria-hidden="true">→</span> {String(result)}
    </span>
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
        className={`flex items-center gap-3 ${presenting ? 'text-base' : 'text-sm'} text-ink`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-active" />
        {step.condition ? <ConditionChip condition={step.condition} /> : null}
        <span>{step.narration}</span>
      </p>
      <ProgressDots index={index} total={total} />
    </div>
  );
}
