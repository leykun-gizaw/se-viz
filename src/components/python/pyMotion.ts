/**
 * Diff motion for the Python canvas (Phase 30) — the pure state machine behind it.
 *
 * The canvas remembers which step it showed last. When the shown step changes by **one** (a step or
 * a beat, forwards or backwards), it plays the object-level events between the two
 * ({@link diffObjects}); stepping back therefore plays the inverse event. A jump of more than one
 * step (scrubbing, Home / End, a timeline chip) shows the new state at once, without motion. On an
 * `arrive` beat the shown step is the pre-state, which is what the canvas already shows, so nothing
 * moves until `apply`, as for C.
 *
 * List and tuple items also get **React keys** that follow the alignment: an item inserted at the
 * front gets a fresh key and the others keep theirs, so the new item slides in and the rest slide
 * over (positional cell ids alone would make every item look changed).
 *
 * @packageDocumentation
 */
import { createContext, useContext } from 'react';
import { arraysIn, isArray, sharedCells, writeThrough } from '../../engine/trace/ndarray.ts';
import { diffObjects, type PyEvent } from '../../engine/trace/objectDiff.ts';
import {
  cellAt,
  columnId,
  columnKeys,
  isTable,
  rowId,
  type Derivation,
} from '../../engine/trace/pandas.ts';
import type { Cell, Step } from '../../engine/trace/types.ts';

/** What the canvas showed, and how it got there. */
export interface MotionState {
  /** The step on screen. */
  shown: Step;
  /** The step shown before it (itself on the first render). */
  from: Step;
  /** The index of the step shown before it (equal to `shown.index` on the first render). */
  fromIndex: number;
  /** The events from the previously shown step to {@link shown} (empty after a jump). */
  events: PyEvent[];
  /** Whether {@link shown} is one step away from the previous one (so motion plays). */
  adjacent: boolean;
  /** Per list / tuple object id: a React key per item, in order. */
  keys: Record<string, string[]>;
  /** Counter for fresh item keys. */
  seq: number;
  /** How many jumps (non-adjacent moves) so far: arrows re-mount on a jump instead of gliding. */
  jumps: number;
}

const isOmitted = (c: Cell) => c.name === '…';
const isSequence = (kind: string | undefined) => kind === 'list' || kind === 'tuple';

function itemKeys(
  step: Step,
  prev: Record<string, string[]>,
  events: PyEvent[],
  seq: number,
): { keys: Record<string, string[]>; seq: number } {
  const keys: Record<string, string[]> = {};
  for (const block of step.heap) {
    if (!isSequence(block.objectKind)) continue;
    const ids = block.cells.filter((c) => !isOmitted(c)).map((c) => c.id);
    const before = prev[block.id] as string[] | undefined;
    const next = before ? [...before] : undefined;
    if (next) {
      const mine = events.filter(
        (e): e is Extract<PyEvent, { kind: 'item-added' | 'item-removed' }> =>
          (e.kind === 'item-added' || e.kind === 'item-removed') &&
          e.objectId === block.id &&
          !e.cellId.endsWith('[…]'),
      );
      // Removals from the back first, so the earlier indices stay valid; then additions in order.
      for (const e of mine
        .filter((x) => x.kind === 'item-removed')
        .sort((a, b) => b.index - a.index)) {
        next.splice(e.index, 1);
      }
      for (const e of mine
        .filter((x) => x.kind === 'item-added')
        .sort((a, b) => a.index - b.index)) {
        next.splice(e.index, 0, `${e.cellId}#${seq++}`);
      }
    }
    keys[block.id] = next && next.length === ids.length ? next : ids;
  }
  return { keys, seq };
}

/** The state for the first step a canvas shows: nothing to animate yet. */
export function initialMotion(step: Step): MotionState {
  return {
    shown: step,
    from: step,
    fromIndex: step.index,
    events: [],
    adjacent: false,
    jumps: 0,
    ...itemKeys(step, {}, [], 0),
  };
}

/** Move the canvas to `step`, deriving the events to animate (if it is one step away). */
export function advanceMotion(state: MotionState, step: Step): MotionState {
  if (step === state.shown) return state;
  const adjacent = Math.abs(step.index - state.shown.index) === 1;
  const events = adjacent ? diffObjects(state.shown, step) : [];
  // After a jump, keys restart from positions (nothing animates, so nothing can be mismatched).
  const { keys, seq } = itemKeys(step, adjacent ? state.keys : {}, events, state.seq);
  const jumps = adjacent ? state.jumps : state.jumps + 1;
  return {
    shown: step,
    from: state.shown,
    fromIndex: state.shown.index,
    events,
    adjacent,
    keys,
    seq,
    jumps,
  };
}

/**
 * How a new pandas table enters (Phase 35), when it was made from a table on screen a step ago:
 * - `filter`: it first shows its source's rows, the dropped ones marked, which then fade out while
 *   the kept rows close up (`rows` is the source's captured rows in its order, `kept` or not, with
 *   the values shown for this table's columns, then any kept rows past a capped source's window);
 * - `sort`: its rows start in their source order (`start`, by row key) and move to their new places.
 */
export type TableEntrance =
  | {
      kind: 'filter';
      rows: { key: string; label: string; kept: boolean; cells: (Cell | undefined)[] }[];
    }
  | { kind: 'sort'; start: string[] };

/** The per-element animation cues a render needs, derived from a {@link MotionState}. */
export interface MotionCues {
  /** Play motion this render (one step away, and the user hasn't asked for reduced motion). */
  animate: boolean;
  /** Reduced motion: changes are marked statically instead of animated. */
  reduce: boolean;
  /** A key that changes with every transition, to re-fire one-shot animations. */
  transition: string;
  /** Frame, object, name, item, key and attribute ids that just appeared. */
  entering: Set<string>;
  /** Cell id → the cell before, for every slot whose value (or kind) changed. */
  changed: Map<string, Cell>;
  /** Cell ids whose reference moved to another object (the arrow redraws). */
  retargeted: Set<string>;
  /** Objects whose items were added or removed (their items animate layout). */
  restructured: Set<string>;
  /** Per list / tuple object id: the React key of each item (see {@link MotionState.keys}). */
  keys: Record<string, string[]>;
  /** Changes whenever arrows should be redrawn without gliding (a jump, or reduced motion). */
  arrowsKey: string;
  /**
   * NumPy (Phase 34): array cells written this step together with the same element in another
   * array that shares the memory (a view and its base). Both are highlighted.
   */
  shared: Set<string>;
  /**
   * NumPy (Phase 34): for each cell of a new view (a slice, `reshape`, `.T`), the cell of an
   * existing array holding the same element, which it animates from.
   */
  flights: Map<string, string>;
  /** pandas (Phase 35): how each new table made from a table on screen enters ({@link TableEntrance}). */
  tables: Map<string, TableEntrance>;
}

/** `o12` → 12: object ids are numbered in first-seen order. */
const idNumber = (id: string) => Number(id.replace(/^\D+/, '')) || 0;

/**
 * Cells of new views that come from an existing array: each new view's cells are matched with the
 * array it shares the most elements with (the most recently seen one on a tie: `grid.T` comes from
 * `grid`, not from the array `grid` is a view of).
 */
function viewFlights(events: readonly PyEvent[], from: Step, step: Step): Map<string, string> {
  const flights = new Map<string, string>();
  const existed = new Set(from.heap.map((b) => b.id));
  const arrays = arraysIn(step);
  for (const e of events) {
    if (e.kind !== 'object-created') continue;
    const made = step.heap.find((b) => b.id === e.objectId);
    if (!isArray(made)) continue;
    let best: Map<string, string> | null = null;
    let bestId = '';
    for (const other of arrays) {
      if (other.id === made.id || !existed.has(other.id)) continue;
      const shared = sharedCells(step, made, other);
      if (shared.size === 0) continue;
      const better =
        best === null ||
        shared.size > best.size ||
        (shared.size === best.size && idNumber(other.id) > idNumber(bestId));
      if (better) {
        best = shared;
        bestId = other.id;
      }
    }
    for (const [mine, theirs] of best ?? []) flights.set(mine, theirs);
  }
  return flights;
}

/**
 * The entrances of the new tables made this step from a table shown the step before (Phase 35), and
 * the cues that go with them: a new column slides in (`columns-added`), a filled value cross-fades
 * from the one it replaced (`values`). Forwards only: stepping back over it just removes the table.
 */
function tableEntrances(
  state: MotionState,
  derived: ReadonlyMap<string, Derivation>,
  entering: Set<string>,
  changed: Map<string, Cell>,
): Map<string, TableEntrance> {
  const out = new Map<string, TableEntrance>();
  if (!state.adjacent || state.shown.index < state.fromIndex) return out;
  for (const e of state.events) {
    if (e.kind !== 'object-created') continue;
    const d = derived.get(e.objectId);
    if (!d || d.step !== state.shown.index) continue;
    const made = state.shown.heap.find((b) => b.id === e.objectId);
    const src = state.from.heap.find((b) => b.id === d.source);
    if (!isTable(made) || !isTable(src)) continue;
    const mine = made.table.rowKeys;
    const inSource = new Set(src.table.rowKeys);
    const all = mine.every((k) => inSource.has(k));
    const r = d.relation;
    if (r.kind === 'filter') {
      const kept = new Set(mine);
      const dropped = new Set(r.dropped);
      const cols = columnKeys(made);
      const sameKind = made.table.kind === src.table.kind;
      const madeLabels = new Map(mine.map((k, i) => [k, made.table.rowLabels[i] ?? k]));
      out.set(made.id, {
        kind: 'filter',
        rows: [
          // The source's captured rows, in its order: the kept ones and the dropped ones.
          ...src.table.rowKeys
            .map((key, i) => ({ key, i }))
            .filter(({ key }) => kept.has(key) || dropped.has(key))
            .map(({ key, i }) => ({
              key,
              label: src.table.rowLabels[i] ?? key,
              kept: kept.has(key),
              cells: cols.map((c) =>
                kept.has(key) ? cellAt(made, key, c) : sameKind ? cellAt(src, key, c) : undefined,
              ),
            })),
          // Kept rows past the source's captured ones (a capped source) follow.
          ...mine
            .filter((k) => !inSource.has(k))
            .map((key) => ({
              key,
              label: madeLabels.get(key) ?? key,
              kept: true,
              cells: cols.map((c) => cellAt(made, key, c)),
            })),
        ],
      });
    } else if (r.kind === 'sort' && all) {
      const at = new Map(src.table.rowKeys.map((k, i) => [k, i]));
      out.set(made.id, { kind: 'sort', start: [...mine].sort((a, b) => at.get(a)! - at.get(b)!) });
    } else if (r.kind === 'columns-added') {
      for (const key of r.added) entering.add(columnId(made.id, key));
    } else if (r.kind === 'values') {
      const cells = new Map(src.cells.map((c) => [c.id, c]));
      for (const [m, s] of r.changed) {
        const was = cells.get(s);
        if (was) changed.set(m, was);
      }
    }
  }
  return out;
}

export function motionCues(
  state: MotionState,
  reduce: boolean,
  derived: ReadonlyMap<string, Derivation> = new Map(),
): MotionCues {
  const entering = new Set<string>();
  const changed = new Map<string, Cell>();
  const retargeted = new Set<string>();
  const restructured = new Set<string>();
  for (const e of state.events) {
    switch (e.kind) {
      case 'frame-pushed':
        entering.add(e.frameId);
        break;
      case 'object-created':
        entering.add(e.objectId);
        break;
      case 'name-bound':
      case 'key-added':
        entering.add(e.cellId);
        break;
      case 'item-added':
      case 'item-removed':
        if (e.kind === 'item-added') entering.add(e.cellId);
        restructured.add(e.objectId);
        break;
      case 'value-changed':
        changed.set(e.cellId, e.from);
        break;
      case 'attribute-set':
        if (e.from === null) entering.add(e.cellId);
        else if (e.from.kind === 'pointer' && e.to.kind === 'pointer') retargeted.add(e.cellId);
        else changed.set(e.cellId, e.from);
        break;
      case 'reference-retargeted':
        retargeted.add(e.cellId);
        break;
      case 'array-reshaped':
      case 'rows-reordered':
        restructured.add(e.objectId);
        break;
      case 'column-added':
        entering.add(columnId(e.objectId, e.key));
        break;
      case 'row-added':
        entering.add(rowId(e.objectId, e.key));
        break;
      default:
        // Pops, releases, unbinds and removals animate as exits of elements no longer rendered.
        break;
    }
  }
  const tables = tableEntrances(state, derived, entering, changed);
  const shared = new Set<string>();
  if (state.adjacent) {
    const written = new Set<string>();
    for (const id of changed.keys()) written.add(id);
    for (const [a, b] of writeThrough(state.shown, written)) {
      shared.add(a);
      shared.add(b);
    }
  }
  return {
    animate: state.adjacent && !reduce,
    reduce,
    transition: `${state.fromIndex}>${state.shown.index}`,
    entering,
    changed,
    retargeted,
    restructured,
    keys: state.keys,
    arrowsKey: reduce ? `r${state.shown.index}` : `j${state.jumps}`,
    shared,
    flights: state.adjacent ? viewFlights(state.events, state.from, state.shown) : new Map(),
    tables,
  };
}

/** No motion: the first render, a jump, and server rendering. */
export const NO_CUES: MotionCues = {
  animate: false,
  reduce: false,
  transition: '',
  entering: new Set(),
  changed: new Map(),
  retargeted: new Set(),
  restructured: new Set(),
  keys: {},
  arrowsKey: '',
  shared: new Set(),
  flights: new Map(),
  tables: new Map(),
};

/** The current render's cues, for the frame, object and value views. */
export const MotionCuesContext = createContext<MotionCues>(NO_CUES);

export function useMotionCues(): MotionCues {
  return useContext(MotionCuesContext);
}
