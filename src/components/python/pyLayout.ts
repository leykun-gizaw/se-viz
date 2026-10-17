/**
 * Where Python objects sit in the objects area (Phase 30), as a pure function of the step.
 *
 * - Objects are ordered by **first appearance** in the trace, so a box keeps its place as the
 *   program runs.
 * - An object a frame refers to starts its own row. An object referenced **only from inside other
 *   objects** (an inner list, a dict's list value) sits **next to its parent**, to its right; its
 *   own children nest further right. An object both a frame and another object refer to keeps its
 *   own row, and gets two arrows.
 * - Anything left (only reachable through a cycle of inner objects) starts a row of its own.
 *
 * @packageDocumentation
 */
import type { Step, Trace } from '../../engine/trace/types.ts';

/** One object and the objects drawn beside it. */
export interface ObjectNode {
  id: string;
  children: ObjectNode[];
}

/** Each object id's rank by first appearance across the trace (step, then position in the step). */
export function firstAppearance(trace: Trace): Map<string, number> {
  const rank = new Map<string, number>();
  for (const step of trace.steps) {
    for (const block of step.heap) if (!rank.has(block.id)) rank.set(block.id, rank.size);
  }
  return rank;
}

/** The rows of the objects area for one step. */
export function layoutObjects(step: Step, rank: Map<string, number>): ObjectNode[] {
  const blocks = new Map(step.heap.map((b) => [b.id, b]));
  const order = step.heap
    .map((b) => b.id)
    .sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
  const fromFrames = new Set<string>();
  for (const frame of step.stack) {
    for (const v of frame.variables) {
      if (v.kind === 'pointer' && v.target !== null) fromFrames.add(v.target);
    }
  }

  const placed = new Set<string>();
  const grow = (id: string): ObjectNode => {
    placed.add(id);
    const children: ObjectNode[] = [];
    for (const cell of blocks.get(id)?.cells ?? []) {
      const t = cell.kind === 'pointer' ? cell.target : null;
      if (t !== null && blocks.has(t) && !placed.has(t) && !fromFrames.has(t)) {
        children.push(grow(t));
      }
    }
    return { id, children };
  };

  const rows: ObjectNode[] = [];
  for (const id of order) if (fromFrames.has(id) && !placed.has(id)) rows.push(grow(id));
  for (const id of order) if (!placed.has(id)) rows.push(grow(id));
  // Rows in first-appearance order of their root (the leftovers were appended after).
  return rows.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}
