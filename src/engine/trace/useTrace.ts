/**
 * `useTrace` — the trace player store.
 *
 * Phase 0–1 gave it step navigation + autoplay (the pure timing lives in `../autoplay.ts`).
 * **Phase 16** adds execute-to-reveal **beats**: each logical step is split into `arrive` (about to
 * run; pre-state, no pulse) and `apply` (the reveal; the change pulses). The pure beat model lives
 * in `./beats.ts` so the advance/reverse sequence is unit-tested; this hook wires it to React state,
 * persists the stepping mode, and exposes the snapshots each beat should render
 * (`displayStep`/`displayPrevStep`) alongside the logical `step` (which drives the line highlight,
 * narration, and counter).
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState.ts';
import { DEFAULT_SPEED_INDEX, PLAYBACK_SPEEDS, type PlaybackSpeed } from '../autoplay.ts';
import {
  advanceBeat,
  beatLabel,
  canAdvance,
  canReverse,
  clampToMode,
  EMPTY_STEP,
  goToStep,
  initialPosition,
  resolveBeatRender,
  reverseBeat,
  viewSupportsBeats,
  type Beat,
  type BeatPosition,
  type SteppingMode,
} from './beats.ts';
import type { Step, Trace } from './types.ts';

/** The reactive state and controls returned by {@link useTrace}. */
export interface TracePlayer {
  /** The trace being played. */
  trace: Trace;
  /** Current zero-based **logical** step index. */
  index: number;
  /** Total number of logical steps. */
  total: number;
  /** The current **logical** step — drives the code-line highlight, narration, condition, counter. */
  step: Step;
  /** The previous logical step, or `null` at the first step. */
  prevStep: Step | null;
  /** Whether {@link TracePlayer.next} would advance (a beat in two-beat mode, a step in single). */
  canNext: boolean;
  /** Whether {@link TracePlayer.prev} would go back. */
  canPrev: boolean;
  /** Advance one beat (two-beat) or step (single). Clamps at the end. */
  next: () => void;
  /** Reverse one beat/step. Clamps at the start. Pauses autoplay. */
  prev: () => void;
  /** Jump to a logical step (lands on its applied state). Pauses autoplay. */
  goTo: (index: number) => void;
  /** Return to the very first beat/step. Pauses autoplay. */
  reset: () => void;

  /** Whether autoplay is currently running. */
  isPlaying: boolean;
  /** Start autoplay (restarts from the top if already at the end). */
  play: () => void;
  /** Pause autoplay. */
  pause: () => void;
  /** Toggle autoplay. */
  togglePlay: () => void;

  /** The available speed options. */
  speeds: readonly PlaybackSpeed[];
  /** Index into {@link TracePlayer.speeds} of the active speed. */
  speedIndex: number;
  /** The active speed. */
  speed: PlaybackSpeed;
  /** Select a speed by index (clamped). */
  setSpeedIndex: (index: number) => void;

  // ── Phase 16: execute-to-reveal beats ──────────────────────────────────────────────────────
  /** The current beat (`arrive` = pre-state / about to run; `apply` = revealed). */
  beat: Beat;
  /** The user's stepping preference (persisted). */
  mode: SteppingMode;
  /** The mode actually in effect — forced `single` for views that don't support beats. */
  effectiveMode: SteppingMode;
  /** Whether this trace's view supports two-beat stepping (memory / dual-trace). */
  supportsBeats: boolean;
  /** Toggle between two-beat and single-beat stepping (persisted). */
  toggleMode: () => void;
  /** Short label for the current beat (`about to run` / `ran`), empty in single mode. */
  beatLabel: string;
  /** The snapshot to render in the memory/console/inline views for the current beat. */
  displayStep: Step;
  /** The snapshot to diff `displayStep` against for pulses (`null`/empty ⇒ no pulse). */
  displayPrevStep: Step | null;
}

/**
 * Create a player bound to `trace`.
 *
 * @param trace - The trace to play. Assumed non-empty (`steps.length >= 1`).
 * @returns A {@link TracePlayer}.
 */
export function useTrace(trace: Trace): TracePlayer {
  const total = trace.steps.length;
  const supportsBeats = viewSupportsBeats(trace.view);

  const [mode, setMode] = usePersistentState<SteppingMode>('se-viz-stepping-mode', 'two-beat');
  const effectiveMode: SteppingMode = supportsBeats ? mode : 'single';

  const [pos, setPos] = useState<BeatPosition>(() => initialPosition(effectiveMode));
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndexState] = useState(DEFAULT_SPEED_INDEX);

  const speed = PLAYBACK_SPEEDS[Math.min(Math.max(speedIndex, 0), PLAYBACK_SPEEDS.length - 1)];

  const next = useCallback(() => {
    setPos((p) => advanceBeat(p, total, effectiveMode));
  }, [total, effectiveMode]);

  const prev = useCallback(() => {
    setIsPlaying(false);
    setPos((p) => reverseBeat(p, effectiveMode));
  }, [effectiveMode]);

  const goTo = useCallback(
    (target: number) => {
      setIsPlaying(false);
      setPos(goToStep(target, total));
    },
    [total],
  );

  const reset = useCallback(() => {
    setIsPlaying(false);
    setPos(initialPosition(effectiveMode));
  }, [effectiveMode]);

  const play = useCallback(() => {
    setPos((p) => (canAdvance(p, total, effectiveMode) ? p : initialPosition(effectiveMode)));
    setIsPlaying(true);
  }, [total, effectiveMode]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const togglePlay = useCallback(() => {
    setIsPlaying((playing) => {
      if (!playing) {
        setPos((p) => (canAdvance(p, total, effectiveMode) ? p : initialPosition(effectiveMode)));
      }
      return !playing;
    });
  }, [total, effectiveMode]);

  const setSpeedIndex = useCallback((i: number) => {
    setSpeedIndexState(Math.min(Math.max(i, 0), PLAYBACK_SPEEDS.length - 1));
  }, []);

  const toggleMode = useCallback(() => {
    setIsPlaying(false);
    const nextMode: SteppingMode = mode === 'two-beat' ? 'single' : 'two-beat';
    const nextEffective: SteppingMode = supportsBeats ? nextMode : 'single';
    setMode(nextMode);
    setPos((p) => clampToMode(p, nextEffective));
  }, [mode, supportsBeats, setMode]);

  // Autoplay timer: advance one beat per tick, stopping at the final beat. All state updates happen
  // inside the async timeout callback (never synchronously in the effect body).
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setTimeout(() => {
      if (!canAdvance(pos, total, effectiveMode)) {
        setIsPlaying(false);
        return;
      }
      const nextPos = advanceBeat(pos, total, effectiveMode);
      setPos(nextPos);
      if (!canAdvance(nextPos, total, effectiveMode)) setIsPlaying(false);
    }, speed.ms);
    return () => window.clearTimeout(id);
  }, [isPlaying, pos, total, effectiveMode, speed.ms]);

  return useMemo<TracePlayer>(() => {
    const clampedStep = Math.min(Math.max(pos.step, 0), total - 1);
    const step = trace.steps[clampedStep];
    const prevStep = clampedStep > 0 ? trace.steps[clampedStep - 1] : null;

    const render = resolveBeatRender(pos, effectiveMode);
    const displayStep =
      render.displayIndex < 0 ? EMPTY_STEP : trace.steps[Math.min(render.displayIndex, total - 1)];
    const displayPrevStep: Step | null =
      render.diffPrevIndex < 0
        ? render.displayIndex < 0
          ? EMPTY_STEP
          : null
        : trace.steps[render.diffPrevIndex];

    return {
      trace,
      index: clampedStep,
      total,
      step,
      prevStep,
      canNext: canAdvance(pos, total, effectiveMode),
      canPrev: canReverse(pos, effectiveMode),
      next,
      prev,
      goTo,
      reset,
      isPlaying,
      play,
      pause,
      togglePlay,
      speeds: PLAYBACK_SPEEDS,
      speedIndex,
      speed,
      setSpeedIndex,
      beat: pos.beat,
      mode,
      effectiveMode,
      supportsBeats,
      toggleMode,
      beatLabel: beatLabel(pos, effectiveMode),
      displayStep,
      displayPrevStep,
    };
  }, [
    trace,
    total,
    pos,
    effectiveMode,
    next,
    prev,
    goTo,
    reset,
    isPlaying,
    play,
    pause,
    togglePlay,
    speedIndex,
    speed,
    setSpeedIndex,
    mode,
    supportsBeats,
    toggleMode,
  ]);
}
