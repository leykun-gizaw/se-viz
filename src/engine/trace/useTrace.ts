/**
 * `useTrace` — the trace player store.
 *
 * Phase 0 gave it forward/back/reset/jump navigation. Phase 1 adds the full transport: autoplay
 * (play/pause on a speed-driven timer that stops at the end) and a speed selector. The pure timing
 * logic lives in `../autoplay.ts` so it stays testable; this hook only wires it to React state and
 * an interval effect.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  autoplayTick,
  DEFAULT_SPEED_INDEX,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
} from '../autoplay.ts';
import type { Step, Trace } from './types.ts';

/** The reactive state and controls returned by {@link useTrace}. */
export interface TracePlayer {
  /** The trace being played. */
  trace: Trace;
  /** Current zero-based step index. */
  index: number;
  /** Total number of steps. */
  total: number;
  /** The current step. */
  step: Step;
  /** The previous step, or `null` at the first step. Used to compute animation diffs. */
  prevStep: Step | null;
  /** Whether {@link TracePlayer.next} would advance. */
  canNext: boolean;
  /** Whether {@link TracePlayer.prev} would go back. */
  canPrev: boolean;
  /** Advance one step (clamped at the last step). Stops autoplay if it was running past the end. */
  next: () => void;
  /** Go back one step (clamped at the first step). Pauses autoplay. */
  prev: () => void;
  /** Jump to an arbitrary index (clamped into range). Pauses autoplay. */
  goTo: (index: number) => void;
  /** Return to the first step. Pauses autoplay. */
  reset: () => void;

  /** Whether autoplay is currently running. */
  isPlaying: boolean;
  /** Start autoplay (no-op if already at the end). */
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
}

/**
 * Create a player bound to `trace`.
 *
 * @param trace - The trace to play. Assumed non-empty (`steps.length >= 1`).
 * @returns A {@link TracePlayer}.
 */
export function useTrace(trace: Trace): TracePlayer {
  const total = trace.steps.length;
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndexState] = useState(DEFAULT_SPEED_INDEX);

  const clampedIndex = Math.min(Math.max(index, 0), total - 1);
  const speed = PLAYBACK_SPEEDS[Math.min(Math.max(speedIndex, 0), PLAYBACK_SPEEDS.length - 1)];

  const goTo = useCallback(
    (target: number) => {
      setIsPlaying(false);
      setIndex(Math.min(Math.max(target, 0), total - 1));
    },
    [total],
  );

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);

  const prev = useCallback(() => {
    setIsPlaying(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setIndex(0);
  }, []);

  const play = useCallback(() => {
    // Starting at the very end restarts from the top so the play button is never a dead end.
    setIndex((i) => (i >= total - 1 ? 0 : i));
    setIsPlaying(true);
  }, [total]);

  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => {
    setIsPlaying((p) => {
      if (!p) {
        setIndex((i) => (i >= total - 1 ? 0 : i));
      }
      return !p;
    });
  }, [total]);

  const setSpeedIndex = useCallback((i: number) => {
    setSpeedIndexState(Math.min(Math.max(i, 0), PLAYBACK_SPEEDS.length - 1));
  }, []);

  // Autoplay timer. Re-armed whenever playing/index/speed change; advances one step per tick using
  // the pure autoplayTick and stops itself at the end.
  const tickRef = useRef(autoplayTick);
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setTimeout(() => {
      const t = tickRef.current(clampedIndex, total);
      setIndex(t.index);
      if (!t.playing) setIsPlaying(false);
    }, speed.ms);
    return () => window.clearTimeout(id);
  }, [isPlaying, clampedIndex, total, speed.ms]);

  return useMemo<TracePlayer>(() => {
    const step = trace.steps[clampedIndex];
    const prevStep = clampedIndex > 0 ? trace.steps[clampedIndex - 1] : null;
    return {
      trace,
      index: clampedIndex,
      total,
      step,
      prevStep,
      canNext: clampedIndex < total - 1,
      canPrev: clampedIndex > 0,
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
    };
  }, [
    trace,
    clampedIndex,
    total,
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
  ]);
}
