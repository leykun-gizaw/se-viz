/**
 * The narration card (Phase 28) — the one-line narration, moved from the full-width bottom bar into
 * a card directly **under the code panel**, so it sits next to the line it describes. It names the
 * highlighted line(s), shows the condition chip (`i <= n → true`) when the step has one, and is the
 * polite live region that announces each step. Presentation mode keeps the bottom bar.
 */
import type { TracePlayer } from '../engine/trace/useTrace.ts';
import { ConditionChip } from './NarrationBar.tsx';

export function NarrationCard({ player }: { player: TracePlayer }) {
  const { step } = player;
  const lines = [...step.highlightedLines].sort((a, b) => a - b);
  return (
    <div className="shrink-0 rounded-lg border border-hairline bg-surface px-4 py-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-active" />
        <span className="font-mono text-[11px] text-ink-muted">
          {lines.length === 0
            ? 'Narration'
            : `${lines.length === 1 ? 'Line' : 'Lines'} ${lines.join(', ')}`}
        </span>
        {step.condition ? <ConditionChip condition={step.condition} /> : null}
      </div>
      <p aria-live="polite" className="font-sans text-sm leading-relaxed text-ink">
        {step.narration}
      </p>
    </div>
  );
}
