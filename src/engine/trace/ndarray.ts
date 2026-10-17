/**
 * Reading NumPy array blocks (Phase 34): their elements, where each element sits in memory, and
 * which elements two arrays share. Pure functions over recorded steps — shared by the object diff,
 * the Python canvas's motion and the derived explanations.
 *
 * A view (`a[1:4]`, `m.T`, `a.reshape(2, 3)`) has no memory of its own: its elements are elements
 * of the array that owns the data (the end of its `base` chain). The recorder gives each array a
 * {@link NdarrayInfo.layout}: element `(i, j, …)` sits `offset + i·strides[0] + j·strides[1] + …`
 * bytes into the owner's data. Two arrays with the same owner share exactly the elements at equal
 * byte positions — that is what "writing through a view changes the base" means.
 *
 * @packageDocumentation
 */
import type { Cell, HeapBlock, NdarrayInfo, Step } from './types.ts';

/** An array block: a heap block with its NumPy facts. */
export type ArrayBlock = HeapBlock & { objectKind: 'ndarray'; ndarray: NdarrayInfo };

export function isArray(block: HeapBlock | undefined): block is ArrayBlock {
  return block?.objectKind === 'ndarray' && block.ndarray !== undefined;
}

/** The `N more` cell past the cap. */
export const isOmittedCell = (c: Cell) => c.name === '…';

/** An array's captured element cells, flat in C order (without the `N more` cell). */
export function elementCells(block: HeapBlock): Cell[] {
  return block.cells.filter((c) => !isOmittedCell(c));
}

/** Whether every element was captured (the array is within the 200-value cap). */
export function fullyCaptured(block: ArrayBlock): boolean {
  return elementCells(block).length === block.ndarray.size;
}

/** The index of the `flat`-th element (C order) of an array of `shape`. */
export function unravel(flat: number, shape: readonly number[]): number[] {
  const idx = new Array<number>(shape.length).fill(0);
  let rest = flat;
  for (let d = shape.length - 1; d >= 0; d--) {
    const n = shape[d];
    idx[d] = n > 0 ? rest % n : 0;
    rest = n > 0 ? Math.floor(rest / n) : 0;
  }
  return idx;
}

/** `(2, 3)`, `(3,)`, `()`: a shape as Python prints it. */
export function shapeText(shape: readonly number[]): string {
  if (shape.length === 1) return `(${shape[0]},)`;
  return `(${shape.join(', ')})`;
}

/** The array that owns `block`'s data: the end of its `base` chain (itself when it owns its data). */
export function memoryOwner(step: Step, block: ArrayBlock): string | null {
  let current: ArrayBlock = block;
  const seen = new Set<string>();
  while (current.ndarray.base !== null) {
    if (seen.has(current.id)) return null;
    seen.add(current.id);
    const next = step.heap.find((b) => b.id === current.ndarray.base);
    // A base past the object cap, or a base that isn't an array: the owner can't be named.
    if (!isArray(next)) return current === block ? null : current.id;
    current = next;
  }
  return current.id;
}

/** The byte position of each captured element in its owner's memory, or `null` without a layout. */
export function bytePositions(block: ArrayBlock): number[] | null {
  const layout = block.ndarray.layout;
  if (!layout) return null;
  const { shape } = block.ndarray;
  return elementCells(block).map((_, i) => {
    const idx = unravel(i, shape);
    return idx.reduce((pos, k, d) => pos + k * (layout.strides[d] ?? 0), layout.offset);
  });
}

/**
 * The elements `a` and `b` share, as a map from each shared cell id of `a` to the cell id of `b`
 * at the same memory. Empty when they don't share memory (different owners, a copy, or no layout).
 */
export function sharedCells(step: Step, a: ArrayBlock, b: ArrayBlock): Map<string, string> {
  const out = new Map<string, string>();
  if (a.id === b.id) return out;
  const owner = memoryOwner(step, a);
  if (owner === null || owner !== memoryOwner(step, b)) return out;
  if (a.ndarray.layout?.itemsize !== b.ndarray.layout?.itemsize) return out;
  const pa = bytePositions(a);
  const pb = bytePositions(b);
  if (!pa || !pb) return out;
  const cellsA = elementCells(a);
  const cellsB = elementCells(b);
  const byPos = new Map<number, string>();
  pb.forEach((p, i) => {
    if (!byPos.has(p)) byPos.set(p, cellsB[i].id);
  });
  pa.forEach((p, i) => {
    const other = byPos.get(p);
    if (other !== undefined) out.set(cellsA[i].id, other);
  });
  return out;
}

/** Every array in the step. */
export function arraysIn(step: Step): ArrayBlock[] {
  return step.heap.filter(isArray);
}

/**
 * Cells written in one array whose memory another array shares, and which changed there too:
 * pairs `[written cell, the same element in the other array]`. Given the cells whose value changed
 * between two steps, this finds the write-through of a view (and of a base seen through a view).
 */
export function writeThrough(step: Step, changed: ReadonlySet<string>): [string, string][] {
  const arrays = arraysIn(step);
  const pairs: [string, string][] = [];
  for (const a of arrays) {
    if (!elementCells(a).some((c) => changed.has(c.id))) continue;
    for (const b of arrays) {
      if (a.id === b.id) continue;
      for (const [ca, cb] of sharedCells(step, a, b)) {
        if (changed.has(ca) && changed.has(cb)) pairs.push([ca, cb]);
      }
    }
  }
  return pairs;
}

/** The block a cell id belongs to (`o3[0,1]` → `o3`). */
export function ownerOfCell(cellId: string): string {
  const i = cellId.search(/[[.{]/);
  return i < 0 ? cellId : cellId.slice(0, i);
}
