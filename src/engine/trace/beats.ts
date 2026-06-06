/**
 * Execute-to-reveal beat model (Phase 16) — the pure, testable core of debugger-style stepping.
 *
 * Each logical step `n` is split into two visual **beats**:
 * - **arrive(n):** highlight `step(n)`'s line ("about to run"), but render the memory/inline values
 *   of `step n-1` (the pre-state) with **no pulse**. For the first step, the pre-state is empty.
 * - **apply(n):** render `step(n)`'s snapshot — memory updates and the changed cell pulses ("the
 *   reveal").
 *
 * Advancing goes `arrive(n) → apply(n) → arrive(n+1) → …`; reversing walks the same sequence
 * backwards, symmetrically. In **single-beat** mode every position is an `apply` and motion is by
 * whole steps (today's behavior). The functions here are React-free so the advance/reverse sequence
 * can be unit-tested directly.
 *
 * @packageDocumentation
 */

import type { Step } from './types.ts';

/** Which half of a logical step a position is on. */
export type Beat = 'arrive' | 'apply';

/** The user's stepping preference. `two-beat` is the Phase 16 default; `single` is pre-Phase-16. */
export type SteppingMode = 'two-beat' | 'single';

/** A position in the playback timeline: a logical step plus which beat of it. */
export interface BeatPosition {
  /** Logical step index (0-based). */
  step: number;
  /** Which beat. In `single` mode this is always `apply`. */
  beat: Beat;
}

/**
 * Whether a trace's view supports the arrive/apply pre/post split. Memory and dual-trace render a
 * per-step state that can show a pre-state, so they get two beats; the `pipeline` and `before-after`
 * concept views have no line-by-line memory, so they are forced single-beat ("unaffected").
 *
 * @param view - The trace's `view` (undefined ⇒ memory).
 */
export function viewSupportsBeats(view: string | undefined): boolean {
  return view === undefined || view === 'memory' || view === 'dual-trace';
}

/** The starting position for a mode: `(0, arrive)` in two-beat, `(0, apply)` in single. */
export function initialPosition(mode: SteppingMode): BeatPosition {
  return { step: 0, beat: mode === 'two-beat' ? 'arrive' : 'apply' };
}

/** Whether {@link advanceBeat} would move (i.e. we're not already at the final beat). */
export function canAdvance(pos: BeatPosition, total: number, mode: SteppingMode): boolean {
  if (total <= 0) return false;
  if (mode === 'single') return pos.step < total - 1;
  return !(pos.step >= total - 1 && pos.beat === 'apply');
}

/** Whether {@link reverseBeat} would move (i.e. we're not already at the first beat). */
export function canReverse(pos: BeatPosition, mode: SteppingMode): boolean {
  if (mode === 'single') return pos.step > 0;
  return !(pos.step <= 0 && pos.beat === 'arrive');
}

/** Advance one unit — a beat in two-beat mode, a whole step in single. Clamps at the end. */
export function advanceBeat(pos: BeatPosition, total: number, mode: SteppingMode): BeatPosition {
  if (!canAdvance(pos, total, mode)) return pos;
  if (mode === 'single') return { step: pos.step + 1, beat: 'apply' };
  if (pos.beat === 'arrive') return { step: pos.step, beat: 'apply' };
  return { step: pos.step + 1, beat: 'arrive' };
}

/** Reverse one unit, symmetric to {@link advanceBeat}. Clamps at the start. */
export function reverseBeat(pos: BeatPosition, mode: SteppingMode): BeatPosition {
  if (!canReverse(pos, mode)) return pos;
  if (mode === 'single') return { step: pos.step - 1, beat: 'apply' };
  if (pos.beat === 'apply') return { step: pos.step, beat: 'arrive' };
  return { step: pos.step - 1, beat: 'apply' };
}

/** Jump to a logical step, landing on its fully-applied state (used by scrub / Home / End). */
export function goToStep(step: number, total: number): BeatPosition {
  return { step: Math.min(Math.max(step, 0), Math.max(total - 1, 0)), beat: 'apply' };
}

/**
 * Re-map a position when the mode changes: collapsing to single snaps to the current step's applied
 * state (so the change is revealed); expanding to two-beat keeps the position unchanged.
 */
export function clampToMode(pos: BeatPosition, mode: SteppingMode): BeatPosition {
  return mode === 'single' ? { step: pos.step, beat: 'apply' } : pos;
}

/**
 * Which snapshots to render for a position. `displayIndex` is the step whose memory/console/inline
 * values are shown; `diffPrevIndex` is the snapshot to diff against for pulses. An index of `-1`
 * denotes the empty pre-state (before the first step).
 *
 * - apply(n) / single: show step n, diff against n-1 (so the change pulses).
 * - arrive(n): show step n-1 (the pre-state), diff against itself (so nothing pulses).
 */
export interface BeatRender {
  displayIndex: number;
  diffPrevIndex: number;
}

export function resolveBeatRender(pos: BeatPosition, mode: SteppingMode): BeatRender {
  if (mode === 'single' || pos.beat === 'apply') {
    return { displayIndex: pos.step, diffPrevIndex: pos.step - 1 };
  }
  // arrive: render the previous snapshot (or empty), diffed against itself ⇒ no pulse.
  return { displayIndex: pos.step - 1, diffPrevIndex: pos.step - 1 };
}

/** A short human label for the current beat, for the step counter. Empty in single mode. */
export function beatLabel(pos: BeatPosition, mode: SteppingMode): string {
  if (mode === 'single') return '';
  return pos.beat === 'arrive' ? 'about to run' : 'ran';
}

/** The synthetic empty pre-state shown on `arrive(0)` — no frames, no heap. Stable identity. */
export const EMPTY_STEP: Step = {
  id: '__pre__',
  index: -1,
  narration: '',
  highlightedLines: [],
  stack: [],
  heap: [],
};
