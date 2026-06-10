/**
 * Live Coding run state — the pure state machine behind the mode's UI, kept React-free so the
 * loading → success/error mapping is unit-testable without a DOM (the component is a thin
 * `useReducer` shell over this).
 *
 * One run at a time: `run` enters `loading` (the Run button disables), `settled` maps the
 * {@link PostTraceResult} to `success` (trace + optional truncation banner) or `error` (a
 * learner-facing headline, plus the gcc output for compile errors). A `settled` that arrives
 * while not loading is ignored — it can only be stale.
 *
 * @packageDocumentation
 */

import type { Trace } from '../engine/trace/types.ts';
import type { LiveError, LiveErrorCode, PostTraceResult, Truncation } from './tracerClient.ts';

/** What the Live Coding view is showing. */
export type RunStatus =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; trace: Trace; truncated: Truncation | null }
  | { phase: 'error'; error: LiveError };

/** Reducer state: the status plus a counter of successful runs (keys/remounts the player). */
export interface RunState {
  status: RunStatus;
  /** Incremented on every successful run, so a re-run remounts the player at step 0. */
  seq: number;
}

export type RunAction = { type: 'run' } | { type: 'settled'; result: PostTraceResult };

export const INITIAL_RUN_STATE: RunState = { status: { phase: 'idle' }, seq: 0 };

/** Advance the state machine. Pure; stale `settled` actions (nothing in flight) are ignored. */
export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'run':
      return state.status.phase === 'loading' ? state : { ...state, status: { phase: 'loading' } };
    case 'settled': {
      if (state.status.phase !== 'loading') return state;
      if (!action.result.ok) {
        return { ...state, status: { phase: 'error', error: action.result.error } };
      }
      return {
        seq: state.seq + 1,
        status: {
          phase: 'success',
          trace: action.result.trace,
          truncated: action.result.truncated ?? null,
        },
      };
    }
  }
}

/**
 * The learner-facing headline for a failed run. `compile_error` is the special case: the headline
 * is short because the real teaching content is the gcc `details` shown in the console panel.
 */
export function errorHeadline(code: LiveErrorCode): string {
  switch (code) {
    case 'compile_error':
      return 'Your program did not compile.';
    case 'timeout':
      return 'Your program ran too long (likely an infinite loop).';
    case 'too_large':
      return 'Program is too large.';
    case 'invalid_request':
      return 'The visualizer service rejected the request.';
    case 'recorder_error':
    case 'unavailable':
    case 'invalid_trace':
      return 'The visualizer service is unavailable.';
  }
}

/** The truncation banner text, naming why the trace was cut. */
export function truncationBanner(truncated: Truncation): string {
  const why: string[] = [];
  if (truncated.reasons.includes('step_limit')) why.push('too many steps');
  if (truncated.reasons.includes('output_limit')) why.push('too much output');
  const reason = why.length > 0 ? why.join(' and ') : 'limits reached';
  return `Trace truncated — ${reason} to show all of it (the full run had ${truncated.originalSteps} steps).`;
}
