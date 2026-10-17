/**
 * Trace validation — correctness infrastructure for a teaching tool, where an authoring slip (a
 * wrong line number, a pointer to a non-existent id, a duplicated id) would silently mis-teach.
 *
 * `validateTrace` checks the structural invariants every trace must satisfy and returns a list of
 * human-readable issues (empty = valid). A Vitest test runs it over the whole catalog so any future
 * content error fails CI loudly. It validates structure, not pedagogy — it can't know that
 * `2 + 2 = 5` is wrong, but it guarantees every id, line, and reference is internally consistent.
 *
 * @packageDocumentation
 */

import type { Cell, Step, Trace } from './types.ts';

/** One validation problem, tagged with where it occurred. */
export interface TraceIssue {
  /** The offending trace's id. */
  traceId: string;
  /** The step index the problem is in, or `-1` for trace-level problems. */
  stepIndex: number;
  /** Human-readable description. */
  message: string;
}

/** Collect every cell id in a list, recursing into arrays and structs (with duplicates kept). */
function collectCellIds(cells: Cell[], out: string[]): void {
  for (const cell of cells) {
    out.push(cell.id);
    if (cell.kind === 'array') collectCellIds(cell.elements, out);
    else if (cell.kind === 'struct') collectCellIds(cell.fields, out);
  }
}

/** The three static sub-segments flattened into one cell list (empty when `staticData` is absent). */
function staticCells(step: Step): Cell[] {
  const s = step.staticData;
  if (!s) return [];
  return [...s.data, ...s.bss, ...s.rodata];
}

/**
 * Every id declared in a step (frames, all cells, heap blocks, static segment), in declaration
 * order with dupes. The static cells join the same id universe (Phase 24) so cross-region
 * uniqueness is enforced and pointers may target static cells.
 */
function allIdsInStep(step: Step): string[] {
  const ids: string[] = [];
  for (const frame of step.stack) {
    ids.push(frame.id);
    collectCellIds(frame.variables, ids);
  }
  for (const block of step.heap) {
    ids.push(block.id);
    collectCellIds(block.cells, ids);
  }
  collectCellIds(staticCells(step), ids);
  return ids;
}

/** Number of source lines (the line numbers `highlightedLines` may reference, 1-based). */
function sourceLineCount(source: string): number {
  return source.replace(/\n$/, '').split('\n').length;
}

/**
 * Validate a single trace against the structural invariants:
 * - `steps[i].index === i`;
 * - every `highlightedLines` entry is within `1..sourceLineCount`;
 * - ids (frames, cells, heap blocks, and static-segment cells) are unique within a step;
 * - `activeId` (when present) resolves to an id present in that step;
 * - every non-null pointer `target` (on the stack, heap, or in the static segment) resolves to an
 *   id present in that step — including targets that land in `.data` / `.bss` / `.rodata`;
 * - every annotation `fromId` / `toId` resolves to an id present in that step;
 * - Python traces (Phase 30) follow the extra rules in {@link validatePython}.
 *
 * @param trace - The trace to validate.
 * @returns A list of {@link TraceIssue}s; empty means the trace is structurally valid.
 */
export function validateTrace(trace: Trace): TraceIssue[] {
  const issues: TraceIssue[] = [];
  const issue = (stepIndex: number, message: string) =>
    issues.push({ traceId: trace.id, stepIndex, message });

  const lineCount = sourceLineCount(trace.source);
  const view = trace.view ?? 'memory';

  // Trace-level concept-view invariants (Phase 11).
  if (
    view === 'dual-trace' &&
    (trace.leftSource === undefined || trace.rightSource === undefined)
  ) {
    issue(-1, "view 'dual-trace' requires both trace.leftSource and trace.rightSource");
  }

  if (trace.language === 'python') validatePython(trace, issue);

  trace.steps.forEach((step, i) => {
    // `objectKind` marks a Python object; a C trace never sets it (Phase 30).
    if (trace.language !== 'python') {
      for (const block of step.heap) {
        if (block.objectKind !== undefined) {
          issue(i, `heap block "${block.id}" has objectKind but the trace is not Python`);
        }
      }
    }

    if (step.index !== i) {
      issue(i, `step.index is ${step.index} but its array position is ${i}`);
    }

    for (const line of step.highlightedLines) {
      if (!Number.isInteger(line) || line < 1 || line > lineCount) {
        issue(i, `highlightedLines entry ${line} is outside the source (1..${lineCount})`);
      }
    }

    // Build the id universe for this step and check uniqueness.
    const ids = allIdsInStep(step);
    const idSet = new Set(ids);
    if (idSet.size !== ids.length) {
      const seen = new Set<string>();
      const dupes = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) dupes.add(id);
        seen.add(id);
      }
      issue(i, `duplicate id(s) within the step: ${[...dupes].join(', ')}`);
    }

    // activeId may point at a memory element or (in the pipeline view) a pipeline node.
    const activeUniverse = new Set(idSet);
    for (const node of step.pipeline?.nodes ?? []) activeUniverse.add(node.id);
    if (step.activeId !== undefined && !activeUniverse.has(step.activeId)) {
      issue(i, `activeId "${step.activeId}" does not resolve to any element in the step`);
    }

    // Pointer targets must resolve (null = NULL, allowed).
    const checkPointerTargets = (cells: Cell[]) => {
      for (const cell of cells) {
        if (cell.kind === 'pointer') {
          if (cell.target !== null && !idSet.has(cell.target)) {
            issue(i, `pointer "${cell.id}" targets "${cell.target}", which is not in the step`);
          }
        } else if (cell.kind === 'array') {
          checkPointerTargets(cell.elements);
        } else if (cell.kind === 'struct') {
          checkPointerTargets(cell.fields);
        }
      }
    };
    step.stack.forEach((f) => checkPointerTargets(f.variables));
    step.heap.forEach((b) => checkPointerTargets(b.cells));
    // Static-segment pointers resolve against the same id universe — a `.data`/`.bss` global may
    // point into `.rodata`, the heap, or the stack, and a stack/heap pointer may point into static.
    checkPointerTargets(staticCells(step));

    for (const ann of step.annotations ?? []) {
      if (!idSet.has(ann.fromId)) {
        issue(i, `annotation "${ann.id}" fromId "${ann.fromId}" is not in the step`);
      }
      if (!idSet.has(ann.toId)) {
        issue(i, `annotation "${ann.id}" toId "${ann.toId}" is not in the step`);
      }
    }

    // Coach note (Phase 17): its anchor must resolve, like activeId / annotations. `anchorId` may
    // point at a memory element or a pipeline node (the activeUniverse); `anchorLine` is 1-based into
    // the source. No anchor is fine (the bubble falls back to a consistent spot).
    if (step.coach) {
      if (step.coach.anchorId !== undefined && !activeUniverse.has(step.coach.anchorId)) {
        issue(
          i,
          `coach anchorId "${step.coach.anchorId}" does not resolve to any element in the step`,
        );
      }
      const cl = step.coach.anchorLine;
      if (cl !== undefined && (!Number.isInteger(cl) || cl < 1 || cl > lineCount)) {
        issue(i, `coach anchorLine ${cl} is outside the source (1..${lineCount})`);
      }
    }

    // Step explanation (Phase 28): authored strings must carry text, or the panel would show an
    // empty bullet / an empty Concept section instead of its fallback.
    if (step.explain) {
      (step.explain.did ?? []).forEach((d, k) => {
        if (typeof d !== 'string' || d.trim() === '') {
          issue(i, `explain.did[${k}] is empty`);
        }
      });
      const concept = step.explain.concept;
      if (concept !== undefined && (typeof concept !== 'string' || concept.trim() === '')) {
        issue(i, 'explain.concept is empty (omit it instead)');
      }
    }

    // ── Concept-view payloads (Phase 11) ─────────────────────────────────────────────────────
    // Each concept view requires the matching per-step payload; pipeline edges must reference
    // existing nodes; before/after and dual-trace highlight lines must be in range of their source.
    if (view === 'pipeline') {
      if (!step.pipeline) {
        issue(i, "view 'pipeline' step is missing its `pipeline` payload");
      } else {
        const nodeIds = step.pipeline.nodes.map((n) => n.id);
        const nodeIdSet = new Set(nodeIds);
        if (nodeIdSet.size !== nodeIds.length) {
          issue(i, 'duplicate pipeline node id(s) within the step');
        }
        for (const edge of step.pipeline.edges) {
          if (!nodeIdSet.has(edge.from)) {
            issue(i, `pipeline edge from "${edge.from}" references a missing node`);
          }
          if (!nodeIdSet.has(edge.to)) {
            issue(i, `pipeline edge to "${edge.to}" references a missing node`);
          }
        }
      }
    } else if (view === 'before-after') {
      if (!step.beforeAfter) {
        issue(i, "view 'before-after' step is missing its `beforeAfter` payload");
      } else {
        const beforeLines = sourceLineCount(step.beforeAfter.before);
        const afterLines = sourceLineCount(step.beforeAfter.after);
        for (const l of step.beforeAfter.beforeHighlights ?? []) {
          if (!Number.isInteger(l) || l < 1 || l > beforeLines) {
            issue(i, `beforeHighlights entry ${l} is outside before (1..${beforeLines})`);
          }
        }
        for (const l of step.beforeAfter.afterHighlights ?? []) {
          if (!Number.isInteger(l) || l < 1 || l > afterLines) {
            issue(i, `afterHighlights entry ${l} is outside after (1..${afterLines})`);
          }
        }
      }
    } else if (view === 'dual-trace') {
      if (!step.dualTrace) {
        issue(i, "view 'dual-trace' step is missing its `dualTrace` payload");
      } else {
        const sides = [
          ['left', step.dualTrace.left, trace.leftSource] as const,
          ['right', step.dualTrace.right, trace.rightSource] as const,
        ];
        for (const [side, col, src] of sides) {
          if (col.line !== undefined) {
            const n = src ? sourceLineCount(src) : 0;
            if (!Number.isInteger(col.line) || col.line < 1 || col.line > n) {
              issue(i, `dual-trace ${side} line ${col.line} is outside its source (1..${n})`);
            }
          }
        }
      }
    }
  });

  return issues;
}

/**
 * The extra invariants of a Python trace (Phase 30, `docs/PYTHON_TRACE_FORMAT.md`), on top of the
 * shared ones (step indices, unique ids, every pointer target resolving within its step):
 * - every heap block is a Python object: it has an `objectKind`;
 * - a reference names an **object**: a non-null pointer target is a heap block id, never a cell;
 * - ids are stable: an object id keeps its `objectKind`, a frame id keeps its function name, for
 *   the whole trace. (A frame id may leave and come back: a generator's frame is suspended at
 *   each `yield` and resumed as the same activation.)
 * - NumPy arrays (Phase 34): a block has `ndarray` facts exactly when its `objectKind` is
 *   `'ndarray'`; it holds at most `size` element cells; and its `base`, when set, is an object of
 *   the same step.
 * - pandas (Phase 35): a block has `table` facts exactly when it is a `'dataframe'` or `'series'`
 *   (of that kind), and `groupby` facts exactly when it is a `'groupby'`; a table's row labels and
 *   keys line up, it holds at most one cell per captured row and column, and it captures no more
 *   rows or columns than its shape has; a GroupBy's `source`, when set, is an object of the step.
 */
function validatePython(trace: Trace, issue: (stepIndex: number, message: string) => void): void {
  const kindOf = new Map<string, string>();
  const frameName = new Map<string, string>();

  trace.steps.forEach((step, i) => {
    const blocks = new Set(step.heap.map((b) => b.id));
    for (const block of step.heap) {
      if (block.objectKind === undefined) {
        issue(i, `Python object "${block.id}" has no objectKind`);
        continue;
      }
      const was = kindOf.get(block.id);
      if (was !== undefined && was !== block.objectKind) {
        issue(i, `object "${block.id}" changed kind from ${was} to ${block.objectKind}`);
      }
      kindOf.set(block.id, block.objectKind);
      if ((block.objectKind === 'ndarray') !== (block.ndarray !== undefined)) {
        issue(i, `object "${block.id}": ndarray facts must go with objectKind 'ndarray'`);
      } else if (block.ndarray) {
        const { size, base } = block.ndarray;
        const elements = block.cells.filter((c) => c.name !== '…').length;
        if (elements > size) issue(i, `array "${block.id}" has ${elements} cells but size ${size}`);
        if (base !== null && !blocks.has(base)) {
          issue(i, `array "${block.id}" is a view of "${base}", which is not an object here`);
        }
      }
      const tabular = block.objectKind === 'dataframe' || block.objectKind === 'series';
      if (
        tabular !== (block.table !== undefined) ||
        (block.table && block.table.kind !== block.objectKind)
      ) {
        issue(
          i,
          `object "${block.id}": table facts must go with objectKind 'dataframe' / 'series'`,
        );
      } else if (block.table) {
        const t = block.table;
        const cols = t.kind === 'series' ? 1 : t.columns.length;
        if (t.rowKeys.length !== t.rowLabels.length) {
          issue(
            i,
            `table "${block.id}" has ${t.rowKeys.length} row keys but ${t.rowLabels.length} labels`,
          );
        }
        if (block.cells.length > t.rowKeys.length * cols) {
          issue(i, `table "${block.id}" has more cells than captured rows × columns`);
        }
        if (t.rowKeys.length + t.rowsOmitted !== t.shape[0]) {
          issue(i, `table "${block.id}": captured plus omitted rows is not its row count`);
        }
        if (t.kind === 'dataframe' && t.columns.length + t.columnsOmitted !== t.shape[1]) {
          issue(i, `table "${block.id}": captured plus omitted columns is not its column count`);
        }
      }
      if ((block.objectKind === 'groupby') !== (block.groupby !== undefined)) {
        issue(i, `object "${block.id}": groupby facts must go with objectKind 'groupby'`);
      } else if (block.groupby?.source != null && !blocks.has(block.groupby.source)) {
        issue(
          i,
          `groupby "${block.id}" groups "${block.groupby.source}", which is not an object here`,
        );
      }
    }

    // A target missing from the step altogether is already flagged by the shared check.
    const ids = new Set(allIdsInStep(step));
    const checkRefs = (cells: Cell[]) => {
      for (const cell of cells) {
        if (
          cell.kind === 'pointer' &&
          cell.target !== null &&
          ids.has(cell.target) &&
          !blocks.has(cell.target)
        ) {
          issue(i, `reference "${cell.id}" targets "${cell.target}", which is not an object`);
        } else if (cell.kind === 'array') checkRefs(cell.elements);
        else if (cell.kind === 'struct') checkRefs(cell.fields);
      }
    };
    step.stack.forEach((f) => checkRefs(f.variables));
    step.heap.forEach((b) => checkRefs(b.cells));

    for (const frame of step.stack) {
      const name = frameName.get(frame.id);
      if (name !== undefined && name !== frame.name) {
        issue(i, `frame "${frame.id}" changed name from ${name} to ${frame.name}`);
      }
      frameName.set(frame.id, frame.name);
    }
  });
}

/** Convenience: validate many traces and return all issues flattened. */
export function validateTraces(traces: readonly Trace[]): TraceIssue[] {
  return traces.flatMap((t) => validateTrace(t));
}
