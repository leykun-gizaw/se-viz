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

/** Every id declared in a step (frames, all cells, heap blocks), in declaration order with dupes. */
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
 * - ids (frames, cells, heap blocks) are unique within a step;
 * - `activeId` (when present) resolves to an id present in that step;
 * - every non-null pointer `target` resolves to an id present in that step;
 * - every annotation `fromId` / `toId` resolves to an id present in that step.
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
  if (view === 'dual-trace' && (trace.leftSource === undefined || trace.rightSource === undefined)) {
    issue(-1, "view 'dual-trace' requires both trace.leftSource and trace.rightSource");
  }

  trace.steps.forEach((step, i) => {
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

    for (const ann of step.annotations ?? []) {
      if (!idSet.has(ann.fromId)) {
        issue(i, `annotation "${ann.id}" fromId "${ann.fromId}" is not in the step`);
      }
      if (!idSet.has(ann.toId)) {
        issue(i, `annotation "${ann.id}" toId "${ann.toId}" is not in the step`);
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

/** Convenience: validate many traces and return all issues flattened. */
export function validateTraces(traces: readonly Trace[]): TraceIssue[] {
  return traces.flatMap((t) => validateTrace(t));
}
