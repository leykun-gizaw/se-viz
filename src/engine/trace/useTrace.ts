/**
 * `useTrace` — the minimal player store for stepping through a {@link Trace}.
 *
 * Phase 0 only needs forward/back/reset/jump navigation over the step array plus the current and
 * previous steps (the previous step feeds the diff-driven animations). Autoplay, scrubbing, and
 * speed control are Phase 1 and are intentionally absent here.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useState } from 'react';
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
  /** Advance one step (clamped at the last step). */
  next: () => void;
  /** Go back one step (clamped at the first step). */
  prev: () => void;
  /** Jump to an arbitrary index (clamped into range). */
  goTo: (index: number) => void;
  /** Return to the first step. */
  reset: () => void;
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

  const clampedIndex = Math.min(Math.max(index, 0), total - 1);

  const goTo = useCallback(
    (target: number) => {
      setIndex(Math.min(Math.max(target, 0), total - 1));
    },
    [total],
  );

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setIndex(0);
  }, []);

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
    };
  }, [trace, clampedIndex, total, next, prev, goTo, reset]);
}
