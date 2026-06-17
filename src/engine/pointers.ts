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

/** The static segment's cells (`.data` + `.bss` + `.rodata`), or `[]` when absent (Phase 24). */
function staticCells(step: Step): Cell[] {
  const s = step.staticData;
  return s ? [...s.data, ...s.bss, ...s.rodata] : [];
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
  // Static-segment cells join the lookup so a pointer can resolve to (or live in) `.data`/`.bss`/
  // `.rodata` — e.g. a stack pointer onto a `.rodata` string, or a `.bss` array of head pointers.
  walkCells(staticCells(step), (c) => cells.set(c.id, c));
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
  walkCells(staticCells(step), push); // pointers living in `.data`/`.bss` (e.g. a bucket array)
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

/** Number of hues in the arrow palette (`--se-arrow-0 … --se-arrow-{N-1}` in index.css). */
export const ARROW_PALETTE_SIZE = 5;

/** Deterministic 32-bit string hash (FNV-style) — no randomness, so colors never flicker. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = ((h ^ id.charCodeAt(i)) * 16777619) >>> 0;
  }
  return h;
}

/**
 * Assign each arrow id a palette slot so simultaneous arrows are individually traceable.
 *
 * Goals, in priority order:
 * 1. **Distinct within a step** — whenever there are ≤ {@link ARROW_PALETTE_SIZE} arrows, no two
 *    share a hue (the linked-list "several identical `next` arrows" problem).
 * 2. **Stable across steps** — the slot is derived from a hash of the pointer's stable id, so an
 *    arrow keeps its hue while it retargets/animates between steps. Collisions are resolved by
 *    probing in canonical (sorted) id order, so a given set of ids always resolves the same way;
 *    an id only shifts hue when a *colliding* id appears or disappears.
 *
 * With more arrows than palette slots, later ids fall back to their raw hash slot (reuse).
 *
 * @param ids - The arrow ids visible this step (danger/NULL arrows excluded by the caller).
 * @returns Map of id → palette slot (`0 .. ARROW_PALETTE_SIZE-1`).
 */
export function arrowColorSlots(ids: readonly string[]): Map<string, number> {
  const slots = new Map<string, number>();
  const taken = new Set<number>();
  for (const id of [...new Set(ids)].sort()) {
    const want = hashId(id) % ARROW_PALETTE_SIZE;
    let slot = want;
    if (taken.size < ARROW_PALETTE_SIZE) {
      while (taken.has(slot)) slot = (slot + 1) % ARROW_PALETTE_SIZE;
    }
    slots.set(id, slot);
    taken.add(slot);
  }
  return slots;
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
