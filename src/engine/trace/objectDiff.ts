/**
 * Object-level diff for Python traces (Phase 30) — the pure half of diff motion. Where
 * {@link diffSteps} reports cells by id, this names what happened to each **object** between two
 * adjacent steps, in the terms the renderer animates: an object created, an item appended or
 * inserted, an item removed, a value changed, a dict key added or removed, an attribute set, a
 * reference retargeted, a frame pushed or popped.
 *
 * List items are aligned by value, not by position: `insert(0, x)` is one `item-added` at index 0
 * (not a value change on every shifted index plus an append, which is what the positional cell ids
 * alone would say), and `pop(0)` is one `item-removed` at index 0. When the two sequences don't
 * differ by exactly one item, the diff falls back to positions.
 *
 * Stepping backwards plays the inverse: `diffObjects(b, a)` is {@link invertEvents} of
 * `diffObjects(a, b)` (as a set; the tests check every kind).
 *
 * @packageDocumentation
 */
import { bytePositions, elementCells, isArray } from './ndarray.ts';
import type { Cell, HeapBlock, PointerTarget, Step } from './types.ts';

/** One thing that happened to the Python state between two steps. */
export type PyEvent =
  | { kind: 'frame-pushed'; frameId: string }
  | { kind: 'frame-popped'; frameId: string }
  | { kind: 'object-created'; objectId: string }
  /** An object no longer reachable (the inverse of `object-created`). */
  | { kind: 'object-released'; objectId: string }
  /** A new name in a frame that already existed (including a frame's `return` value). */
  | { kind: 'name-bound'; frameId: string; cellId: string }
  | { kind: 'name-unbound'; frameId: string; cellId: string }
  /** A list / tuple / set item; `atEnd` is an append (or, for sets, the last member in order). */
  | { kind: 'item-added'; objectId: string; cellId: string; index: number; atEnd: boolean }
  | { kind: 'item-removed'; objectId: string; cellId: string; index: number; atEnd: boolean }
  /** A slot's value changed: a scalar's value, or the slot's kind (primitive ↔ reference). */
  | { kind: 'value-changed'; ownerId: string; cellId: string; from: Cell; to: Cell }
  | { kind: 'key-added'; objectId: string; cellId: string }
  | { kind: 'key-removed'; objectId: string; cellId: string }
  /** An instance attribute was set: new (`from: null`) or given a new value. */
  | { kind: 'attribute-set'; objectId: string; cellId: string; from: Cell | null; to: Cell }
  | { kind: 'attribute-deleted'; objectId: string; cellId: string; from: Cell }
  | {
      kind: 'reference-retargeted';
      ownerId: string;
      cellId: string;
      from: PointerTarget;
      to: PointerTarget;
    }
  /**
   * Phase 34: a NumPy array's shape changed in place (`a.shape = (3, 2)`), its elements staying
   * where they are in memory. Its cells are re-indexed (`o1[3]` is now `o1[1,1]`), so they are not
   * reported as removed and added; the canvas moves each element to its new place.
   */
  | { kind: 'array-reshaped'; objectId: string; from: number[]; to: number[] };

export type PyEventKind = PyEvent['kind'];

/** A slot's identity for alignment: its kind plus its value or target. */
function sig(cell: Cell): string {
  if (cell.kind === 'scalar') return `s${cell.type}\u0000${String(cell.value)}`;
  if (cell.kind === 'pointer') return `p${String(cell.target)}`;
  return `${cell.kind}${cell.id}`;
}

/** Whether `long` with item `k` taken out is exactly `short`. */
function sameWithout(long: Cell[], short: Cell[], k: number): boolean {
  return short.every((c, i) => sig(c) === sig(long[i < k ? i : i + 1]));
}

/** The first index where two sequences differ (the shorter's length if one extends the other). */
function firstDifference(a: Cell[], b: Cell[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (sig(a[i]) !== sig(b[i])) return i;
  return n;
}

/** The change, if any, to one slot present in both steps. */
function slotChange(ownerId: string, before: Cell, after: Cell): PyEvent | null {
  if (before.kind === 'pointer' && after.kind === 'pointer') {
    if (before.target === after.target) return null;
    return {
      kind: 'reference-retargeted',
      ownerId,
      cellId: after.id,
      from: before.target,
      to: after.target,
    };
  }
  if (before.kind !== after.kind)
    return { kind: 'value-changed', ownerId, cellId: after.id, from: before, to: after };
  if (before.kind === 'scalar' && after.kind === 'scalar' && before.value !== after.value) {
    return { kind: 'value-changed', ownerId, cellId: after.id, from: before, to: after };
  }
  return null;
}

/** Slots matched by id: changes for those in both, and adds / removes for the rest. */
function bySlotId(
  ownerId: string,
  before: Cell[],
  after: Cell[],
  added: (cell: Cell, index: number) => PyEvent,
  removed: (cell: Cell, index: number) => PyEvent,
  changed: (before: Cell, after: Cell) => PyEvent | null = (b, a) => slotChange(ownerId, b, a),
): PyEvent[] {
  const out: PyEvent[] = [];
  const prev = new Map(before.map((c) => [c.id, c]));
  const next = new Set(after.map((c) => c.id));
  after.forEach((cell, i) => {
    const was = prev.get(cell.id);
    if (!was) out.push(added(cell, i));
    else {
      const e = changed(was, cell);
      if (e) out.push(e);
    }
  });
  before.forEach((cell, i) => {
    if (!next.has(cell.id)) out.push(removed(cell, i));
  });
  return out;
}

const isOmitted = (c: Cell) => c.name === '…';

/** A list or tuple: one aligned insert / remove when possible, else position by position. */
function sequenceEvents(id: string, before: Cell[], after: Cell[]): PyEvent[] {
  const a = before.filter((c) => !isOmitted(c));
  const b = after.filter((c) => !isOmitted(c));
  const out: PyEvent[] = [];
  if (b.length === a.length + 1) {
    const k = firstDifference(a, b);
    if (sameWithout(b, a, k)) {
      out.push({
        kind: 'item-added',
        objectId: id,
        cellId: b[k].id,
        index: k,
        atEnd: k === a.length,
      });
      return [...out, ...omittedEvents(id, before, after)];
    }
  } else if (a.length === b.length + 1) {
    const k = firstDifference(a, b);
    if (sameWithout(a, b, k)) {
      out.push({
        kind: 'item-removed',
        objectId: id,
        cellId: a[k].id,
        index: k,
        atEnd: k === b.length,
      });
      return [...out, ...omittedEvents(id, before, after)];
    }
  }
  const common = Math.min(a.length, b.length);
  for (let i = 0; i < common; i++) {
    const e = slotChange(id, a[i], b[i]);
    if (e) out.push(e);
  }
  for (let i = common; i < b.length; i++) {
    out.push({ kind: 'item-added', objectId: id, cellId: b[i].id, index: i, atEnd: true });
  }
  for (let i = common; i < a.length; i++) {
    out.push({ kind: 'item-removed', objectId: id, cellId: a[i].id, index: i, atEnd: true });
  }
  return [...out, ...omittedEvents(id, before, after)];
}

/** The "N more" cell past the container cap changes like any slot. */
function omittedEvents(id: string, before: Cell[], after: Cell[]): PyEvent[] {
  const a = before.filter(isOmitted);
  const b = after.filter(isOmitted);
  return bySlotId(
    id,
    a,
    b,
    (c) => ({
      kind: 'item-added',
      objectId: id,
      cellId: c.id,
      index: after.length - 1,
      atEnd: true,
    }),
    (c) => ({
      kind: 'item-removed',
      objectId: id,
      cellId: c.id,
      index: before.length - 1,
      atEnd: true,
    }),
  );
}

/** What changed inside one object present in both steps. */
function objectEvents(before: HeapBlock, after: HeapBlock): PyEvent[] {
  const id = after.id;
  switch (after.objectKind) {
    case 'list':
    case 'tuple':
      return sequenceEvents(id, before.cells, after.cells);
    case 'set':
    case 'frozenset':
      return bySlotId(
        id,
        before.cells,
        after.cells,
        (c, i) => ({
          kind: 'item-added',
          objectId: id,
          cellId: c.id,
          index: i,
          atEnd: i === after.cells.length - 1,
        }),
        (c, i) => ({
          kind: 'item-removed',
          objectId: id,
          cellId: c.id,
          index: i,
          atEnd: i === before.cells.length - 1,
        }),
      );
    case 'dict':
      return bySlotId(
        id,
        before.cells,
        after.cells,
        (c) => ({ kind: 'key-added', objectId: id, cellId: c.id }),
        (c) => ({ kind: 'key-removed', objectId: id, cellId: c.id }),
      );
    case 'instance':
      return bySlotId(
        id,
        before.cells,
        after.cells,
        (c) => ({ kind: 'attribute-set', objectId: id, cellId: c.id, from: null, to: c }),
        (c) => ({ kind: 'attribute-deleted', objectId: id, cellId: c.id, from: c }),
        (b, a) =>
          slotChange(id, b, a)
            ? { kind: 'attribute-set', objectId: id, cellId: a.id, from: b, to: a }
            : null,
      );
    case 'ndarray': {
      // A shape changed in place, every element where it was: one event, no per-cell churn.
      if (isArray(before) && isArray(after)) {
        const a = before.ndarray;
        const b = after.ndarray;
        if (a.shape.join() !== b.shape.join()) {
          const reshaped: PyEvent = { kind: 'array-reshaped', objectId: id, from: a.shape, to: b.shape };
          if (sameElements(before, after)) return [reshaped];
          return [reshaped, ...fixedSlots(id, before, after)];
        }
      }
      return fixedSlots(id, before, after);
    }
    default:
      return fixedSlots(id, before, after);
  }
}

/** Whether two states of one array hold the same values at the same memory (an in-place reshape). */
function sameElements(before: HeapBlock, after: HeapBlock): boolean {
  if (!isArray(before) || !isArray(after) || before.ndarray.size !== after.ndarray.size) return false;
  const pa = bytePositions(before);
  const pb = bytePositions(after);
  const ca = elementCells(before);
  const cb = elementCells(after);
  if (!pa || !pb || ca.length !== cb.length) return false;
  const at = new Map(pa.map((p, i) => [p, ca[i]]));
  return pb.every((p, i) => {
    const was = at.get(p);
    return was !== undefined && sig(was) === sig(cb[i]);
  });
}

/**
 * Functions, classes, summaries, `repr` objects and arrays: fixed slots matched by id, which can
 * only change value (an array's `N more` cell, or its cells after a reshape, come and go).
 */
function fixedSlots(id: string, before: HeapBlock, after: HeapBlock): PyEvent[] {
  return bySlotId(
    id,
    before.cells,
    after.cells,
    (c, i) => ({ kind: 'item-added', objectId: id, cellId: c.id, index: i, atEnd: true }),
    (c, i) => ({ kind: 'item-removed', objectId: id, cellId: c.id, index: i, atEnd: true }),
  );
}

/**
 * The object-level events from `prev` to `next` (`prev` `null` = everything is new). Frames pushed
 * and objects created are single events: their contents are not listed again.
 */
export function diffObjects(prev: Step | null, next: Step): PyEvent[] {
  const events: PyEvent[] = [];
  const prevFrames = new Map((prev?.stack ?? []).map((f) => [f.id, f]));
  const nextFrames = new Set(next.stack.map((f) => f.id));
  for (const f of prev?.stack ?? []) {
    if (!nextFrames.has(f.id)) events.push({ kind: 'frame-popped', frameId: f.id });
  }
  for (const frame of next.stack) {
    const was = prevFrames.get(frame.id);
    if (!was) {
      events.push({ kind: 'frame-pushed', frameId: frame.id });
      continue;
    }
    events.push(
      ...bySlotId(
        frame.id,
        was.variables,
        frame.variables,
        (c) => ({ kind: 'name-bound', frameId: frame.id, cellId: c.id }),
        (c) => ({ kind: 'name-unbound', frameId: frame.id, cellId: c.id }),
      ),
    );
  }

  const prevBlocks = new Map((prev?.heap ?? []).map((b) => [b.id, b]));
  const nextBlocks = new Set(next.heap.map((b) => b.id));
  for (const block of next.heap) {
    const was = prevBlocks.get(block.id);
    if (!was) events.push({ kind: 'object-created', objectId: block.id });
    else events.push(...objectEvents(was, block));
  }
  for (const block of prev?.heap ?? []) {
    if (!nextBlocks.has(block.id)) events.push({ kind: 'object-released', objectId: block.id });
  }
  return events;
}

/** The event that undoes `e` (what stepping back over it plays). */
export function invertEvent(e: PyEvent): PyEvent {
  switch (e.kind) {
    case 'frame-pushed':
      return { kind: 'frame-popped', frameId: e.frameId };
    case 'frame-popped':
      return { kind: 'frame-pushed', frameId: e.frameId };
    case 'object-created':
      return { kind: 'object-released', objectId: e.objectId };
    case 'object-released':
      return { kind: 'object-created', objectId: e.objectId };
    case 'name-bound':
      return { ...e, kind: 'name-unbound' };
    case 'name-unbound':
      return { ...e, kind: 'name-bound' };
    case 'item-added':
      return { ...e, kind: 'item-removed' };
    case 'item-removed':
      return { ...e, kind: 'item-added' };
    case 'key-added':
      return { ...e, kind: 'key-removed' };
    case 'key-removed':
      return { ...e, kind: 'key-added' };
    case 'value-changed':
    case 'reference-retargeted':
      return { ...e, from: e.to, to: e.from } as PyEvent;
    case 'attribute-set':
      return e.from === null
        ? { kind: 'attribute-deleted', objectId: e.objectId, cellId: e.cellId, from: e.to }
        : { ...e, from: e.to, to: e.from };
    case 'attribute-deleted':
      return {
        kind: 'attribute-set',
        objectId: e.objectId,
        cellId: e.cellId,
        from: null,
        to: e.from,
      };
    case 'array-reshaped':
      return { ...e, from: e.to, to: e.from };
  }
}

/** The events that undo a whole transition, in reverse order. */
export function invertEvents(events: readonly PyEvent[]): PyEvent[] {
  return events.map(invertEvent).reverse();
}
