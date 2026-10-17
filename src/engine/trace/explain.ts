/**
 * Step explanation model (Phase 28; derived sections from Phase 32) — the pure function behind the
 * explanation panel.
 *
 * {@link explainBeat} turns a trace position (logical step + beat) into everything the panel shows:
 * a header (step number, highlighted lines, the source text of those lines), "What this step did",
 * "What changed", "Branch taken", "Loop iteration", "Calls and returns", "Exceptions", the previous
 * and next steps, and the concept.
 *
 * **Authored text always wins, section by section** ({@link StepExplanation}); a section without
 * authored text shows what {@link deriveExplanation} works out from the trace (Phase 32), and
 * "What this step did" falls back to the narration when nothing can be derived. Nothing is invented:
 * a fact that can't be derived is left out.
 *
 * Two-beat stepping (Phase 16) is respected: on an `arrive` beat the step hasn't run yet, so the
 * panel reports it as "about to run" and withholds its effects (`changes`, the derived sections and
 * the next step's narration); "What this step did" then says only what is about to run (derived),
 * or nothing.
 *
 * @packageDocumentation
 */
import { deriveExplanation } from '../explain/derive.ts';
import type { ChangeKind, ChangeRow } from '../explain/types.ts';
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

export type { ChangeKind, ChangeRow };

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
  /**
   * "What this step did": authored, else derived (Phase 32), else the narration. `markdown` says
   * whether the items are inline Markdown (authored or derived) or plain text (the narration). On an
   * arrive beat it is the derived "about to run" description, or `null`.
   */
  did: { items: string[]; authored: boolean; markdown: boolean } | null;
  /** "What changed" rows — `null` on an arrive beat; `[]` means "Nothing changed". */
  changes: ChangeRow[] | null;
  /** When set, "What changed" is shown elsewhere on screen and this note replaces the rows. */
  changesNote: string | null;
  /** Authored "What changed" text (Phase 32), shown instead of the rows; `null` when not authored. */
  changedText: string[] | null;
  /** "Branch taken" (Phase 32): authored or derived; `[]` hides the section. Empty on arrive. */
  branch: string[];
  /** "Loop iteration" (Phase 32). */
  loop: string[];
  /** "Calls and returns" (Phase 32). */
  calls: string[];
  /** "Exceptions" (Phase 32). */
  exceptions: string[];
  /** The previous step (it has run), or `null` at the first step. */
  previous: StepRef | null;
  /** The next step, or `null` at the last step. */
  next: StepRef | null;
  /** Authored concept text, else a derived glossary entry (Phase 32), or `null` (section hidden). */
  concept: string | null;
}

/** Authored lines for a section, or `null` when none are authored (empty entries don't count). */
function authoredList(list: readonly string[] | undefined): string[] | null {
  const items = (list ?? []).filter((d) => d.trim() !== '');
  return items.length > 0 ? items : null;
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
  const derived = deriveExplanation(trace, i, arriving ? 'arrive' : 'apply');
  const authoredText = step.explain ?? {};

  const authored = authoredList(authoredText.did);
  let did: BeatExplanation['did'];
  if (arriving) {
    // The authored breakdown describes effects: hold it back. A derived "about to run" may show.
    did = authored || derived.did.length === 0 ? null : { items: derived.did, authored: false, markdown: true };
  } else if (authored) did = { items: authored, authored: true, markdown: true };
  else if (derived.did.length > 0) did = { items: derived.did, authored: false, markdown: true };
  else did = { items: [step.narration], authored: false, markdown: false };

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
    } else if (derived.changes !== null) {
      changes = derived.changes;
    } else {
      changes = view === 'memory' ? memoryChanges(trace, prev, step) : dualTraceChanges(prev, step);
    }
  }

  const concept = authoredText.concept?.trim() ? authoredText.concept.trim() : derived.concept;
  const section = (own: string[] | undefined, fallback: string[]) =>
    arriving ? [] : (authoredList(own) ?? fallback);

  return {
    status: arriving ? 'about-to-run' : 'ran',
    total,
    current: stepRef(trace, step, !arriving),
    did,
    changes,
    changesNote,
    changedText: arriving ? null : authoredList(authoredText.changed),
    branch: section(authoredText.branch, derived.branch),
    loop: section(authoredText.loop, derived.loop),
    calls: section(authoredText.calls, derived.calls),
    exceptions: section(authoredText.exceptions, derived.exceptions),
    previous: prev ? stepRef(trace, prev, true) : null,
    next: nextStep ? stepRef(trace, nextStep, !arriving) : null,
    concept,
  };
}
