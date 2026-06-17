/**
 * Step diffing — given two adjacent {@link Step}s (full memory snapshots), compute the structural
 * changes between them so the renderer knows what to animate.
 *
 * The diff is intentionally small but real: it covers everything the Phase 0 slice needs (frames
 * pushed/popped, cells added/removed, scalar values changed, pointers retargeted) and gives later
 * phases a stable shape to extend. Because every step carries full state, the diff is a pure
 * function of the two snapshots — no execution model required.
 *
 * @packageDocumentation
 */

import type { Cell, CellId, HeapBlock, PointerTarget, StackFrame, Step } from './types.ts';

/** A scalar value that changed between two steps, for the same {@link CellId}. */
export interface ValueChange {
  id: CellId;
  from: string | number | boolean | null;
  to: string | number | boolean | null;
}

/** A pointer whose {@link PointerTarget} changed between two steps, for the same {@link CellId}. */
export interface PointerRetarget {
  id: CellId;
  from: PointerTarget;
  to: PointerTarget;
}

/**
 * The structural delta between step `prev` and step `next`. Arrays are empty (never `undefined`)
 * when nothing of that category changed, so consumers can iterate without guards.
 */
export interface StepDiff {
  /** Frames present in `next` but not `prev` (a call happened). */
  framesPushed: StackFrame[];
  /** Frames present in `prev` but not `next` (a return happened). */
  framesPopped: StackFrame[];
  /** Cell ids that appeared in `next` (including cells inside newly pushed frames/blocks). */
  cellsAdded: CellId[];
  /** Cell ids that disappeared in `next` (including cells inside popped frames/blocks). */
  cellsRemoved: CellId[];
  /** Scalar value changes for cells present in both steps. */
  valuesChanged: ValueChange[];
  /** Pointer retargets for pointer cells present in both steps. */
  pointersRetargeted: PointerRetarget[];
}

/**
 * Recursively flatten a cell and its descendants (array elements, struct fields) into a flat
 * `id -> Cell` map. Ids are unique within a trace, so a flat map is sufficient for diffing.
 */
function collectCells(cells: Cell[], into: Map<CellId, Cell>): void {
  for (const cell of cells) {
    into.set(cell.id, cell);
    switch (cell.kind) {
      case 'array':
        collectCells(cell.elements, into);
        break;
      case 'struct':
        collectCells(cell.fields, into);
        break;
      case 'scalar':
      case 'pointer':
        break;
    }
  }
}

/** Build the full `id -> Cell` map for a step, across every frame, heap block, and static segment. */
function indexStepCells(step: Step): Map<CellId, Cell> {
  const map = new Map<CellId, Cell>();
  for (const frame of step.stack) {
    collectCells(frame.variables, map);
  }
  for (const block of step.heap as HeapBlock[]) {
    collectCells(block.cells, map);
  }
  // Static-segment cells diff like any other (Phase 24): a `.bss` global pulsing as it's written,
  // a `.data` pointer retargeting, a static cell appearing — all derived here, not authored.
  const s = step.staticData;
  if (s) {
    collectCells(s.data, map);
    collectCells(s.bss, map);
    collectCells(s.rodata, map);
  }
  return map;
}

/**
 * Diff two steps. `prev` may be `null` for the first step, in which case every frame is "pushed"
 * and every cell is "added", with no value/pointer changes.
 *
 * @param prev - The earlier step, or `null` if `next` is the first step.
 * @param next - The later step.
 * @returns The {@link StepDiff} describing what changed from `prev` to `next`.
 */
export function diffSteps(prev: Step | null, next: Step): StepDiff {
  const prevFrames = new Map<string, StackFrame>((prev?.stack ?? []).map((f) => [f.id, f]));
  const nextFrames = new Map<string, StackFrame>(next.stack.map((f) => [f.id, f]));

  const framesPushed = next.stack.filter((f) => !prevFrames.has(f.id));
  const framesPopped = (prev?.stack ?? []).filter((f) => !nextFrames.has(f.id));

  const prevCells = prev ? indexStepCells(prev) : new Map<CellId, Cell>();
  const nextCells = indexStepCells(next);

  const cellsAdded: CellId[] = [];
  const cellsRemoved: CellId[] = [];
  const valuesChanged: ValueChange[] = [];
  const pointersRetargeted: PointerRetarget[] = [];

  for (const [id, cell] of nextCells) {
    const before = prevCells.get(id);
    if (!before) {
      cellsAdded.push(id);
      continue;
    }
    if (cell.kind === 'scalar' && before.kind === 'scalar' && cell.value !== before.value) {
      valuesChanged.push({ id, from: before.value, to: cell.value });
    }
    if (cell.kind === 'pointer' && before.kind === 'pointer' && cell.target !== before.target) {
      pointersRetargeted.push({ id, from: before.target, to: cell.target });
    }
  }

  for (const id of prevCells.keys()) {
    if (!nextCells.has(id)) {
      cellsRemoved.push(id);
    }
  }

  return {
    framesPushed,
    framesPopped,
    cellsAdded,
    cellsRemoved,
    valuesChanged,
    pointersRetargeted,
  };
}

/**
 * The set of cell ids that should show the green "value-changed" pulse this step. Driven entirely
 * by {@link diffSteps} (never hard-coded per fixture) so the pulse is a property of the data, not
 * the content module.
 *
 * @param prev - The earlier step, or `null` for the first step (no pulses).
 * @param next - The later step.
 * @returns A set of {@link CellId}s whose scalar value changed from `prev` to `next`.
 */
export function pulsedCellIds(prev: Step | null, next: Step): Set<CellId> {
  return new Set(diffSteps(prev, next).valuesChanged.map((c) => c.id));
}

/**
 * The set of pointer cell ids whose target changed this step (the arrowhead should glide). Also
 * derived from {@link diffSteps}.
 *
 * @param prev - The earlier step, or `null` for the first step (no retargets).
 * @param next - The later step.
 * @returns A set of {@link CellId}s whose pointer target changed from `prev` to `next`.
 */
export function retargetedPointerIds(prev: Step | null, next: Step): Set<CellId> {
  return new Set(diffSteps(prev, next).pointersRetargeted.map((p) => p.id));
}
