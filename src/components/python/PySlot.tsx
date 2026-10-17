/**
 * A slot's value on the Python canvas (Phase 30; moved out of `PyViews.tsx` in Phase 34 so the
 * NumPy view shares it): a primitive inline or a reference chip, and the cross-fade with the green
 * pulse when the value changed this step.
 */
import { motion, PresenceContext } from 'framer-motion';
import { useAnchorRef } from '../../engine/anchorContext.ts';
import type { Cell } from '../../engine/trace/types.ts';
import { useMotionCues } from './pyMotion.ts';

/** A reference: the azure chip its arrow leaves from. */
function RefChip({ cell, anchored }: { cell: Cell & { kind: 'pointer' }; anchored: boolean }) {
  const ref = useAnchorRef(cell.id);
  return (
    <span
      ref={anchored ? ref : undefined}
      data-coach-anchor={anchored ? cell.id : undefined}
      title={`reference to ${cell.type} ${cell.target ?? ''}`}
      className="inline-flex h-4 w-6 items-center justify-center rounded-sm border border-pointer bg-pointer-soft align-middle"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-pointer" />
    </span>
  );
}

/** A slot's content: a primitive inline, or a reference chip. */
function ValueContent({
  cell,
  anchored,
  format,
}: {
  cell: Cell;
  anchored: boolean;
  /** How a primitive's text is shown (Phase 34: long floats in array cells are shortened). */
  format?: ((text: string) => string) | undefined;
}) {
  if (cell.kind === 'pointer') {
    if (cell.target === null) {
      return (
        <span
          title="an object past the display limit"
          className="font-mono text-[13px] text-ink-faint"
        >
          {cell.display ?? '…'}
        </span>
      );
    }
    return <RefChip cell={cell} anchored={anchored} />;
  }
  const raw = cell.kind === 'scalar' ? (cell.value === null ? '?' : String(cell.value)) : cell.type;
  const text = format ? format(raw) : raw;
  return (
    <span title={cell.type} className="whitespace-pre font-mono text-[13px] font-semibold text-ink">
      {text}
    </span>
  );
}

/** A slot's value; a changed one cross-fades old → new with the green pulse. */
export function SlotValue({
  cell,
  format,
}: {
  cell: Cell;
  format?: ((text: string) => string) | undefined;
}) {
  const cues = useMotionCues();
  const was = cues.changed.get(cell.id);
  const now = <ValueContent cell={cell} anchored format={format} />;
  if (!was) return now;
  if (!cues.animate) {
    // Reduced motion: no fade, but the change is still marked for this step.
    return <span className="rounded bg-changed-soft px-1 text-changed">{now}</span>;
  }
  // Its own presence scope: under an `AnimatePresence initial={false}` (every row is), framer
  // blocks the initial animation of everything mounted inside the row, so the fade wouldn't play.
  return (
    <PresenceContext.Provider value={null}>
      <span className="inline-grid items-center justify-items-end">
        <motion.span
          key={`was:${cues.transition}`}
          aria-hidden="true"
          className="px-1 [grid-area:1/1]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <ValueContent cell={was} anchored={false} format={format} />
        </motion.span>
        <motion.span
          key={`now:${cues.transition}`}
          className="rounded px-1 [grid-area:1/1]"
          initial={{
            opacity: 0,
            backgroundColor: 'var(--se-changed-soft)',
            color: 'var(--se-changed)',
          }}
          animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)', color: 'var(--se-text)' }}
          transition={{ opacity: { duration: 0.45 }, default: { duration: 0.9, ease: 'easeOut' } }}
        >
          {now}
        </motion.span>
      </span>
    </PresenceContext.Provider>
  );
}
