/**
 * Step explanation model (Phase 28) — the pure function behind the explanation panel.
 *
 * {@link explainBeat} turns a trace position (logical step + beat) into everything the panel shows:
 * a header (step number, highlighted lines, the source text of those lines), "What this step did"
 * (authored {@link StepExplanation.did}, else the narration), "What changed" (derived from
 * {@link diffSteps} plus heap and output changes), the previous and next steps, and the authored
 * concept. Authored text always wins; everything else is derived from the trace, never invented.
 *
 * Two-beat stepping (Phase 16) is respected: on an `arrive` beat the step hasn't run yet, so the
 * panel reports it as "about to run" and withholds its effects (`did`, `changes` and the next step's
 * narration are `null`).
 *
 * @packageDocumentation
 */
import type { Beat, SteppingMode } from './beats.ts';
import { diffSteps } from './diff.ts';
import {
  blockLabel,
  cellLabel,
  displayScalar,
  frameLabel,
  indexCells,
  lineTexts,
  type CellInfo,
} from './labels.ts';
import type { Cell, HeapBlock, PointerTarget, Step, Trace } from './types.ts';

/** The kinds of row in "What changed". */
export type ChangeKind =
  | 'value' // a scalar's value changed
  | 'pointer' // a pointer now targets something else
  | 'call' // a frame was pushed
  | 'return' // a frame was popped
  | 'alloc' // a heap block appeared
  | 'free' // a heap block was freed / released
  | 'leak' // a heap block became unreachable
  | 'declare' // a new variable appeared in a frame that already existed
  | 'output'; // the program printed something

/** One "What changed" row. `from`/`to` are present for value-like changes. */
export interface ChangeRow {
  kind: ChangeKind;
  /** What changed, e.g. `n in factorial(3)`, `factorial(2)`, `node 0x8e0`. */
  subject: string;
  from?: string;
  to?: string;
}

/** A compact reference to a step, for the header and the previous / next sections. */
export interface StepRef {
  /** Zero-based index. */
  index: number;
  /** One-based step number, as the transport shows it. */
  number: number;
  /** Highlighted line numbers, ascending. */
  lines: number[];
  /** Source text of those lines (trimmed). */
  code: string[];
  /** The step's narration, or `null` when it would reveal effects not shown yet (arrive beat). */
  narration: string | null;
}

/** Everything the explanation panel renders for one beat. */
export interface BeatExplanation {
  /** `about-to-run` on an arrive beat (two-beat mode), else `ran`. */
  status: 'about-to-run' | 'ran';
  total: number;
  current: StepRef;
  /** "What this step did" — `null` on an arrive beat. */
  did: { items: string[]; authored: boolean } | null;
  /** "What changed" rows — `null` on an arrive beat; `[]` means "Nothing changed". */
  changes: ChangeRow[] | null;
  /** When set, "What changed" is shown elsewhere on screen and this note replaces the rows. */
  changesNote: string | null;
  /** The previous step (it has run), or `null` at the first step. */
  previous: StepRef | null;
  /** The next step, or `null` at the last step. */
  next: StepRef | null;
  /** Authored concept text, or `null` (section hidden). */
  concept: string | null;
}

function stepRef(trace: Trace, step: Step, revealNarration: boolean): StepRef {
  const lines = [...step.highlightedLines].sort((a, b) => a - b);
  return {
    index: step.index,
    number: step.index + 1,
    lines,
    code: lineTexts(trace.source, lines),
    narration: revealNarration ? step.narration : null,
  };
}

function targetLabel(
  target: PointerTarget,
  cells: Map<string, CellInfo>,
  blocks: Map<string, HeapBlock>,
): string {
  if (target === null) return 'NULL';
  const block = blocks.get(target);
  if (block) return blockLabel(block);
  const cell = cells.get(target);
  if (cell) return cellLabel(cell);
  return target;
}

const isLive = (b: HeapBlock) => b.state === undefined || b.state === 'allocated';
const isFreed = (b: HeapBlock) => b.state === 'freed' || b.state === 'dangling';

/** Memory-view changes from `prev` to `next`. */
function memoryChanges(trace: Trace, prev: Step, next: Step): ChangeRow[] {
  const rows: ChangeRow[] = [];
  const src = trace.source;
  const lang = trace.language;
  const diff = diffSteps(prev, next);
  const nextCells = indexCells(next, src, lang);
  const prevCells = indexCells(prev, src, lang);
  const nextBlocks = new Map(next.heap.map((b) => [b.id, b]));
  const prevBlocks = new Map(prev.heap.map((b) => [b.id, b]));

  for (const f of diff.framesPopped) {
    rows.push({ kind: 'return', subject: frameLabel(f, src, lang) });
  }
  for (const f of diff.framesPushed) rows.push({ kind: 'call', subject: frameLabel(f, src, lang) });

  // New variables in frames that already existed (a declaration mid-function). Variables of a
  // freshly pushed frame are part of the call row, not listed separately.
  const prevFrames = new Map(prev.stack.map((f) => [f.id, f]));
  for (const frame of next.stack) {
    const before = prevFrames.get(frame.id);
    if (!before) continue;
    const known = new Set(before.variables.map((v) => v.id));
    for (const v of frame.variables) {
      if (known.has(v.id)) continue;
      const info = nextCells.get(v.id);
      const row: ChangeRow = { kind: 'declare', subject: info ? cellLabel(info) : v.name };
      if (v.kind === 'scalar') row.to = displayScalar(v.value);
      else if (v.kind === 'pointer') row.to = targetLabel(v.target, nextCells, nextBlocks);
      rows.push(row);
    }
  }

  // Heap lifecycle.
  for (const block of next.heap) {
    const before = prevBlocks.get(block.id);
    if (!before) {
      rows.push({ kind: 'alloc', subject: blockLabel(block) });
    } else if (isLive(before) && isFreed(block)) {
      rows.push({ kind: 'free', subject: blockLabel(block) });
    } else if (before.state !== 'leaked' && block.state === 'leaked') {
      rows.push({ kind: 'leak', subject: blockLabel(block) });
    }
  }
  for (const block of prev.heap) {
    if (!nextBlocks.has(block.id) && isLive(block)) {
      rows.push({ kind: 'free', subject: blockLabel(block) });
    }
  }

  // Value changes and pointer retargets on cells present in both steps (not inside a new frame).
  for (const c of diff.valuesChanged) {
    const info = nextCells.get(c.id);
    rows.push({
      kind: 'value',
      subject: info ? cellLabel(info) : c.id,
      from: displayScalar(c.from),
      to: displayScalar(c.to),
    });
  }
  for (const p of diff.pointersRetargeted) {
    const info = nextCells.get(p.id);
    rows.push({
      kind: 'pointer',
      subject: info ? cellLabel(info) : p.id,
      from: targetLabel(p.from, prevCells, prevBlocks),
      to: targetLabel(p.to, nextCells, nextBlocks),
    });
  }

  // A name rebound across kinds (Python `x = 1` then `x = [x]`, Phase 30). Never on C traces.
  const show = (c: Cell, cells: Map<string, CellInfo>, blocks: Map<string, HeapBlock>) =>
    c.kind === 'scalar'
      ? displayScalar(c.value)
      : c.kind === 'pointer'
        ? targetLabel(c.target, cells, blocks)
        : c.type;
  for (const k of diff.kindsChanged) {
    const info = nextCells.get(k.id);
    rows.push({
      kind: k.to.kind === 'pointer' ? 'pointer' : 'value',
      subject: info ? cellLabel(info) : k.id,
      from: show(k.from, prevCells, prevBlocks),
      to: show(k.to, nextCells, nextBlocks),
    });
  }

  // Output: lines printed this step (stdout is cumulative).
  const before = prev.stdout ?? [];
  const after = next.stdout ?? [];
  const printed =
    after.length > before.length && before.every((l, i) => l === after[i])
      ? after.slice(before.length)
      : [];
  if (printed.length > 0) rows.push({ kind: 'output', subject: printed.join('\n') });

  return rows;
}

/** Dual-trace changes: the rows each column flags `changed`. */
function dualTraceChanges(prev: Step, next: Step): ChangeRow[] {
  const rows: ChangeRow[] = [];
  if (next.dualTrace) {
    for (const side of ['left', 'right'] as const) {
      const col = next.dualTrace[side];
      const prevRows = new Map((prev.dualTrace?.[side].rows ?? []).map((r) => [r.name, r]));
      for (const row of col.rows) {
        if (!row.changed) continue;
        const was = prevRows.get(row.name);
        rows.push({
          kind: 'value',
          subject: `${row.name} (${col.label})`,
          ...(was && was.value !== row.value ? { from: was.value } : {}),
          to: row.value,
        });
      }
    }
  }
  return rows;
}

/** Views whose changes are already the whole picture on screen: a note points at them instead. */
const VIEW_NOTES: Record<string, string> = {
  pipeline: 'The highlighted stage in the pipeline is what this step did.',
  'before-after': 'The highlighted lines in the before and after panels show what changed.',
};

/**
 * Explain one position of the player.
 *
 * @param trace - The trace being played.
 * @param index - The logical step index (clamped to the trace).
 * @param beat - The current beat (`arrive` = about to run, `apply` = ran).
 * @param mode - The effective stepping mode; in `single` mode every position is treated as `apply`.
 */
export function explainBeat(
  trace: Trace,
  index: number,
  beat: Beat,
  mode: SteppingMode,
): BeatExplanation {
  const total = trace.steps.length;
  const i = Math.min(Math.max(index, 0), total - 1);
  const step = trace.steps[i];
  const prev = i > 0 ? trace.steps[i - 1] : null;
  const nextStep = i < total - 1 ? trace.steps[i + 1] : null;
  const arriving = mode === 'two-beat' && beat === 'arrive';
  const view = trace.view ?? 'memory';

  const authored = (step.explain?.did ?? []).filter((d) => d.trim() !== '');
  const did = arriving
    ? null
    : authored.length > 0
      ? { items: authored, authored: true }
      : { items: [step.narration], authored: false };

  let changes: ChangeRow[] | null = null;
  let changesNote: string | null = null;
  if (!arriving) {
    if (!prev) {
      // A trace may start mid-program (a list already built), so "everything appeared" would be
      // wrong. The first step has nothing to compare against.
      changes = [];
      changesNote = 'The first step: nothing to compare yet. The panels show the starting state.';
    } else if (VIEW_NOTES[view]) {
      changes = [];
      changesNote = VIEW_NOTES[view];
    } else {
      changes = view === 'memory' ? memoryChanges(trace, prev, step) : dualTraceChanges(prev, step);
    }
  }

  const concept = step.explain?.concept?.trim() ? step.explain.concept.trim() : null;

  return {
    status: arriving ? 'about-to-run' : 'ran',
    total,
    current: stepRef(trace, step, !arriving),
    did,
    changes,
    changesNote,
    previous: prev ? stepRef(trace, prev, true) : null,
    next: nextStep ? stepRef(trace, nextStep, !arriving) : null,
    concept,
  };
}
