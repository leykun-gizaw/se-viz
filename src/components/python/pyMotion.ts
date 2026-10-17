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
import { diffObjects, type PyEvent } from '../../engine/trace/objectDiff.ts';
import type { Cell, Step } from '../../engine/trace/types.ts';

/** What the canvas showed, and how it got there. */
export interface MotionState {
  /** The step on screen. */
  shown: Step;
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
  return { shown: step, fromIndex: state.shown.index, events, adjacent, keys, seq, jumps };
}

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
}

export function motionCues(state: MotionState, reduce: boolean): MotionCues {
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
      default:
        // Pops, releases, unbinds and removals animate as exits of elements no longer rendered.
        break;
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
};

/** The current render's cues, for the frame, object and value views. */
export const MotionCuesContext = createContext<MotionCues>(NO_CUES);

export function useMotionCues(): MotionCues {
  return useContext(MotionCuesContext);
}
