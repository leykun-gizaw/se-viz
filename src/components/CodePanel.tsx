/**
 * The code panel: source with line numbers, the current step's line(s) highlighted, lightweight C
 * syntax coloring, and (Phase 16) **inline values** on the active line(s). Ligatures are OFF (via
 * `.se-code`) so operators render literally — `->`, `!=`, `<=`, `++`.
 *
 * Inline values mirror the memory canvas's change signal into the code: each variable the active
 * line touches is shown after the line — the one that **changed this beat** pulses green, the rest
 * are muted — resolved against the **active frame** (so recursion's repeated names show the right
 * frame's value). They respect the current beat: pre-state (no pulse) on `arrive`, the revealed
 * value (pulse) on `apply`.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { tokenizeLine, type TokenType } from '../engine/highlightC.ts';
import { pulsedCellIds } from '../engine/trace/diff.ts';
import {
  findActiveFrame,
  resolveInlineValues,
  type InlineValue,
} from '../engine/trace/inlineValues.ts';
import type { Step, Trace } from '../engine/trace/types.ts';

const TOKEN_CLASS: Record<TokenType, string> = {
  keyword: 'text-kw',
  type: 'text-ty',
  fn: 'text-fn',
  string: 'text-str',
  number: 'text-num',
  comment: 'text-comment italic',
  preproc: 'text-kw',
  punct: 'text-punct',
  plain: 'text-ink',
};

/** One inline value chip. Changed values pulse green (honoring reduced motion), read ones are muted. */
function InlineChip({ value, pulseKey }: { value: InlineValue; pulseKey: string }) {
  const reduce = useReducedMotion();
  const label = `${value.name}${value.pointer ? ' ' : ' = '}${value.display}`;

  if (!value.changed) {
    return (
      <span className={`rounded px-1 ${value.pointer ? 'text-pointer' : 'text-ink-muted'}`}>
        {label}
      </span>
    );
  }
  return (
    <motion.span
      key={`${value.cellId}:${pulseKey}`}
      initial={
        reduce ? false : { backgroundColor: 'var(--se-changed-soft)', color: 'var(--se-changed)' }
      }
      animate={{ backgroundColor: 'rgba(0,0,0,0)', color: 'var(--se-text)' }}
      transition={{ duration: reduce ? 0 : 0.9, ease: 'easeOut' }}
      className="rounded px-1 font-semibold"
    >
      {label}
    </motion.span>
  );
}

function InlineValues({ values, pulseKey }: { values: InlineValue[]; pulseKey: string }) {
  if (values.length === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="ml-auto flex shrink-0 items-center gap-3 pl-6 text-[12px] text-ink-muted"
    >
      {values.map((v) => (
        <InlineChip key={v.cellId} value={v} pulseKey={pulseKey} />
      ))}
    </span>
  );
}

export interface CodePanelProps {
  trace: Trace;
  /** The logical step — drives the line highlight. */
  step: Step;
  /** The snapshot the inline values reflect (pre-state on `arrive`, post-state on `apply`). */
  displayStep?: Step;
  /** The snapshot to diff `displayStep` against (which inline values changed). */
  displayPrevStep?: Step | null;
  /** Re-fires the inline pulse on the `apply` beat. */
  pulseKey?: string;
  /** Larger type for presentation mode. */
  presenting?: boolean;
}

export function CodePanel({
  trace,
  step,
  displayStep,
  displayPrevStep,
  pulseKey = '',
  presenting = false,
}: CodePanelProps) {
  const lines = trace.source.replace(/\n$/, '').split('\n');
  const highlighted = new Set(step.highlightedLines);

  // Inline values are resolved against the displayed snapshot's active frame; the active frame is
  // located by the *logical* step's activeId (which names the frame the highlighted line runs in).
  const snapshot = displayStep ?? step;
  const changedIds = pulsedCellIds(displayPrevStep ?? null, snapshot);
  const activeFrame = findActiveFrame(snapshot, step.activeId);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2">
        <span className="font-mono text-[11px] text-ink-faint">&lt;/&gt;</span>
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
          {trace.file ?? `${trace.id}.c`}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-2">
        <pre className={`se-code ${presenting ? 'text-base leading-7' : 'text-sm leading-6'}`}>
          <code>
            {lines.map((line, i) => {
              const lineNo = i + 1;
              const isActive = highlighted.has(lineNo);
              const tokens = tokenizeLine(line);
              const inline = isActive
                ? resolveInlineValues({
                    lines: [lineNo],
                    source: trace.source,
                    frame: activeFrame,
                    changedIds,
                  })
                : [];
              return (
                <div
                  key={lineNo}
                  data-active={isActive}
                  className={`flex px-4 ${isActive ? 'bg-(--se-line-active) ring-1 ring-inset ring-active/40' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className="mr-4 w-6 shrink-0 select-none text-right text-ink-faint"
                  >
                    {lineNo}
                  </span>
                  <span className="whitespace-pre">
                    {line === ''
                      ? ' '
                      : tokens.map((t, ti) => (
                          <span key={ti} className={TOKEN_CLASS[t.type]}>
                            {t.text}
                          </span>
                        ))}
                  </span>
                  {inline.length > 0 ? <InlineValues values={inline} pulseKey={pulseKey} /> : null}
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
