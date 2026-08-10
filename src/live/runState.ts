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
import type { CompileFlag } from './compileOptions.ts';
import type { LiveError, LiveErrorCode, PostTraceResult, Truncation } from './tracerClient.ts';

/** What the Live Coding view is showing. */
export type RunStatus =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | {
      phase: 'success';
      trace: Trace;
      truncated: Truncation | null;
      /** gcc warnings from a build that compiled anyway. Absent when the compile was clean. */
      warnings?: string;
      /**
       * The flags the backend says it actually applied. Authoritative over our own selection —
       * absent from a tracer older than its Phase 08, in which case the UI falls back to what it
       * sent.
       */
      appliedFlags?: string[];
    }
  | { phase: 'error'; error: LiveError };

/** Reducer state: the status, a counter of successful runs (keys/remounts the player), and the
 * flags the shown run used. */
export interface RunState {
  status: RunStatus;
  /** Incremented on every successful run, so a re-run remounts the player at step 0. */
  seq: number;
  /**
   * The flags the in-flight (or last settled) run was launched with — NOT the current picker
   * selection, which the student may change while a run is going. The `-Werror` explanation and
   * the "compiled with" line must describe the run being shown, not the next one.
   */
  flags: readonly CompileFlag[];
}

export type RunAction =
  | { type: 'run'; flags: readonly CompileFlag[] }
  | { type: 'settled'; result: PostTraceResult };

export const INITIAL_RUN_STATE: RunState = { status: { phase: 'idle' }, seq: 0, flags: [] };

/** Advance the state machine. Pure; stale `settled` actions (nothing in flight) are ignored. */
export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'run':
      return state.status.phase === 'loading'
        ? state
        : { ...state, status: { phase: 'loading' }, flags: action.flags };
    case 'settled': {
      if (state.status.phase !== 'loading') return state;
      if (!action.result.ok) {
        return { ...state, status: { phase: 'error', error: action.result.error } };
      }
      return {
        ...state,
        seq: state.seq + 1,
        status: {
          phase: 'success',
          trace: action.result.trace,
          truncated: action.result.truncated ?? null,
          ...(action.result.warnings !== undefined ? { warnings: action.result.warnings } : {}),
          ...(action.result.flags !== undefined ? { appliedFlags: action.result.flags } : {}),
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

/**
 * Why the build failed when `-Werror` was on, or null. Without this a student reads "your program
 * did not compile" over a *warning* and concludes the tool is broken — they asked for strictness
 * and forgot. Only shown for `compile_error`; a genuine syntax error would have failed either way,
 * but we cannot tell the two apart from the outside, so the wording says "a warning stopped the
 * build" only in the context of the gcc output right below it, which names the actual diagnostic.
 */
export function werrorExplanation(
  code: LiveErrorCode,
  flags: readonly CompileFlag[],
): string | null {
  if (code !== 'compile_error' || !flags.includes('-Werror')) return null;
  return '-Werror is on, so a warning stopped the build. Untick it to run anyway.';
}

/** Header for the non-fatal warnings panel: the program ran, but something is worth fixing. */
export function warningsHeadline(warnings: string): string {
  const n = countWarnings(warnings);
  return n === 1 ? 'Compiled with 1 warning' : `Compiled with ${n} warnings`;
}

/**
 * How many diagnostics gcc emitted. Counts `warning:` markers, which is what gcc prints once per
 * diagnostic — the surrounding source-echo and caret lines are not counted.
 */
export function countWarnings(warnings: string): number {
  const matches = warnings.match(/^[^\n]*?\bwarning:/gm);
  return matches ? matches.length : 0;
}

/** The truncation banner text, naming why the trace was cut. */
export function truncationBanner(truncated: Truncation): string {
  const why: string[] = [];
  if (truncated.reasons.includes('step_limit')) why.push('too many steps');
  if (truncated.reasons.includes('output_limit')) why.push('too much output');
  const reason = why.length > 0 ? why.join(' and ') : 'limits reached';
  return `Trace truncated — ${reason} to show all of it (the full run had ${truncated.originalSteps} steps).`;
}
