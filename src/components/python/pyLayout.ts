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
 * - **NumPy (Phase 34):** a new array made by arithmetic on arrays (`c = a + b`, `mask = a > 2`)
 *   sits next to its first array operand, to its right, instead of starting a row at the bottom.
 *
 * @packageDocumentation
 */
import type { PyExpr, Step, Trace } from '../../engine/trace/types.ts';

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

/** The names an arithmetic expression combines (`a + b * 2` → `a`, `b`), left to right. */
function operandNames(e: PyExpr | undefined, out: string[] = []): string[] {
  if (!e) return out;
  if (e.type === 'name') out.push(e.id);
  else if (e.type === 'binop') {
    operandNames(e.left, out);
    operandNames(e.right, out);
  } else if (e.type === 'compare') {
    operandNames(e.left, out);
    e.comparators.forEach((c) => operandNames(c, out));
  } else if (e.type === 'unary') operandNames(e.operand, out);
  return out;
}

/** What a name in the top frame (or the global frame) refers to, in `step`. */
function targetOf(step: Step, name: string): string | null {
  const frames = [step.stack[step.stack.length - 1], step.stack[0]];
  for (const f of frames) {
    const cell = f?.variables.find((v) => v.name === name);
    if (cell) return cell.kind === 'pointer' ? cell.target : null;
  }
  return null;
}

/**
 * For each NumPy array made by arithmetic on other arrays, the array it is drawn beside: the first
 * array operand of the statement that made it (Phase 34). Worked out once per trace, from the step
 * where the new array first appears and the statement on its line.
 */
export function besideOperands(trace: Trace): Map<string, string> {
  const out = new Map<string, string>();
  const seen = new Set<string>();
  trace.steps.forEach((step, k) => {
    for (const block of step.heap) {
      if (seen.has(block.id)) continue;
      seen.add(block.id);
      const prev = trace.steps[k - 1];
      if (block.objectKind !== 'ndarray' || !prev) continue;
      const stmt = trace.statements?.[String(step.highlightedLines[0])];
      const value = stmt?.kind === 'Assign' || stmt?.kind === 'AugAssign' ? stmt.value : undefined;
      if (!value || (value.type !== 'binop' && value.type !== 'compare' && value.type !== 'unary'))
        continue;
      const arrays = operandNames(value)
        .map((n) => targetOf(prev, n))
        .filter((id): id is string => {
          const b = id === null ? undefined : prev.heap.find((x) => x.id === id);
          return b?.objectKind === 'ndarray' && id !== block.id;
        });
      // The first array operand: `m + a` sits by `m`, not by the row `a` broadcast into it.
      const first = arrays[0];
      if (first !== undefined) out.set(block.id, first);
    }
  });
  return out;
}

/** The rows of the objects area for one step. */
export function layoutObjects(
  step: Step,
  rank: Map<string, number>,
  beside: ReadonlyMap<string, string> = new Map(),
): ObjectNode[] {
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

  // Arrays drawn beside an operand wait until the operand's tree is placed.
  const waiting = new Set(
    [...beside.keys()].filter((id) => blocks.has(id) && blocks.has(beside.get(id)!)),
  );
  const rows: ObjectNode[] = [];
  for (const id of order) {
    if (fromFrames.has(id) && !placed.has(id) && !waiting.has(id)) rows.push(grow(id));
  }
  for (const id of order) if (!placed.has(id) && !waiting.has(id)) rows.push(grow(id));
  const find = (nodes: ObjectNode[], id: string): ObjectNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const inner = find(n.children, id);
      if (inner) return inner;
    }
    return null;
  };
  // In first-appearance order, so an array beside an array that is itself beside one nests.
  for (const id of order) {
    if (!waiting.has(id) || placed.has(id)) continue;
    const host = find(rows, beside.get(id)!);
    if (host) host.children.push(grow(id));
    else rows.push(grow(id));
  }
  // Rows in first-appearance order of their root (the leftovers were appended after).
  return rows.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}
