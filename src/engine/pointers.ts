/**
 * Pointer resolution — pure helpers that walk a {@link Step}'s memory and resolve every pointer
 * cell to what it targets (another cell, a heap block, or `NULL`). The SVG arrow overlay consumes
 * this; keeping it pure makes target resolution and danger-detection unit-testable without a DOM.
 *
 * @packageDocumentation
 */

import type { Cell, HeapBlock, PointerCell, PointerTarget, Step } from './trace/types.ts';

/** Recursively collect every cell in a list, descending into arrays and structs. */
function walkCells(cells: Cell[], visit: (cell: Cell) => void): void {
  for (const cell of cells) {
    visit(cell);
    if (cell.kind === 'array') walkCells(cell.elements, visit);
    else if (cell.kind === 'struct') walkCells(cell.fields, visit);
  }
}

/** Index a step's cells and heap blocks by id for O(1) target lookup. */
export interface StepIndex {
  cells: Map<string, Cell>;
  blocks: Map<string, HeapBlock>;
}

/** Build the {@link StepIndex} for a step (cells across all frames + heap, plus heap blocks). */
export function indexStep(step: Step): StepIndex {
  const cells = new Map<string, Cell>();
  const blocks = new Map<string, HeapBlock>();
  for (const frame of step.stack) {
    walkCells(frame.variables, (c) => cells.set(c.id, c));
  }
  for (const block of step.heap) {
    blocks.set(block.id, block);
    walkCells(block.cells, (c) => cells.set(c.id, c));
  }
  return { cells, blocks };
}

/** Every pointer cell in the step, in stack-then-heap, declaration order. */
export function collectPointerCells(step: Step): PointerCell[] {
  const out: PointerCell[] = [];
  const push = (c: Cell) => {
    if (c.kind === 'pointer') out.push(c);
  };
  for (const frame of step.stack) walkCells(frame.variables, push);
  for (const block of step.heap) walkCells(block.cells, push);
  return out;
}

/** What a pointer target id resolves to within a step. */
export type TargetKind = 'cell' | 'block' | 'null' | 'unknown';

/** A pointer cell resolved against a step's memory, ready for the overlay to draw. */
export interface ResolvedPointer {
  /** The pointer cell's stable id (arrow source / anchor id). */
  id: string;
  /** The pointer's name (e.g. `head`, `next`). */
  name: string;
  /** The raw target id, or `null` for `NULL`. */
  target: PointerTarget;
  /** Whether the target is a cell, a heap block, `NULL`, or unresolvable. */
  targetKind: TargetKind;
  /**
   * Whether this arrow is a dangling/UB read: it aims at a heap block in the `freed` or `dangling`
   * state. The overlay draws these red + dashed (PDF screen 04). Derived, never authored per arrow.
   */
  danger: boolean;
}

/**
 * Classify a single target id against a pre-built {@link StepIndex}.
 *
 * @param target - The pointer's target id, or `null`.
 * @param index - The step index from {@link indexStep}.
 * @returns The {@link TargetKind}.
 */
export function classifyTarget(target: PointerTarget, index: StepIndex): TargetKind {
  if (target === null) return 'null';
  if (index.blocks.has(target)) return 'block';
  if (index.cells.has(target)) return 'cell';
  return 'unknown';
}

/**
 * Resolve every pointer in a step to a {@link ResolvedPointer}, including danger detection.
 *
 * @param step - The step to resolve.
 * @returns One {@link ResolvedPointer} per pointer cell in the step.
 */
export function resolvePointers(step: Step): ResolvedPointer[] {
  const index = indexStep(step);
  return collectPointerCells(step).map((p) => {
    const targetKind = classifyTarget(p.target, index);
    const block =
      targetKind === 'block' && p.target !== null ? index.blocks.get(p.target) : undefined;
    const danger = block?.state === 'freed' || block?.state === 'dangling';
    return { id: p.id, name: p.name, target: p.target, targetKind, danger };
  });
}

/**
 * Build a map from each target id to the names of pointer cells aimed at it. Used to label array
 * elements like `[1]·p` (PDF screen 03).
 *
 * @param step - The step to scan.
 * @returns A map of target id → pointer names targeting it.
 */
export function pointersByTarget(step: Step): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const p of collectPointerCells(step)) {
    if (p.target === null) continue;
    const list = map.get(p.target);
    if (list) list.push(p.name);
    else map.set(p.target, [p.name]);
  }
  return map;
}
