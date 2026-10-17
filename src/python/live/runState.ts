/**
 * Python live coding run state (Phase 31) — the pure state machine behind the mode's UI, like
 * `src/live/runState.ts` for C, kept React-free so every transition is unit-tested.
 *
 * Phases: `idle` → `loading-runtime` (Pyodide) → `loading-packages` (numpy, pandas, …) →
 * `running` → `done` (a trace, maybe ending in an exception or a "Stopped after N steps" step),
 * `error` (no trace: a syntax error, a load failure) or `stopped` (the presenter pressed Stop).
 *
 * The runtime is tracked beside the phase: the mode preloads Pyodide as soon as it opens, so a run
 * can start while the runtime is still loading, and a finished run never forgets that the runtime
 * is ready. One run at a time; a `settled` that arrives with nothing in flight is stale and ignored.
 *
 * @packageDocumentation
 */
import type { Trace } from '../../engine/trace/types.ts';
import type { AllowedPackage } from '../protocol.ts';
import type { LiveEnding, LiveRunError, MappedRun } from './outcome.ts';

export type PyRunStatus =
  | { phase: 'idle' }
  | { phase: 'loading-runtime' }
  | { phase: 'loading-packages'; packages: AllowedPackage[] }
  | { phase: 'running'; snapshots: number }
  | { phase: 'done'; trace: Trace; ending: LiveEnding | null }
  | { phase: 'error'; error: LiveRunError }
  /** Stopped before anything was recorded (a trace that was stopped mid-run is `done`). */
  | { phase: 'stopped' };

/** Where Pyodide is: not loaded (or its worker was terminated), loading, or ready. */
export type RuntimeState = 'cold' | 'loading' | 'ready';

export interface PyRunState {
  status: PyRunStatus;
  runtime: RuntimeState;
  /** A run is in flight: Run is disabled and Stop is offered. */
  inFlight: boolean;
  /** Incremented on every run that produced a trace, so a re-run remounts the player at step 0. */
  seq: number;
}

export type PyRunAction =
  /** The mode opened and asked the runner to load Pyodide. */
  | { type: 'preload' }
  | { type: 'runtime-ready' }
  | { type: 'runtime-failed'; message: string }
  /**
   * Run pressed. `pending` is the packages the program imports that the worker hasn't loaded yet
   * (predicted from the source), so the status can say "Loading pandas…" straight away.
   */
  | { type: 'run'; pending: AllowedPackage[] }
  /** The worker is loading these packages. */
  | { type: 'packages'; packages: AllowedPackage[] }
  /** The program started. */
  | { type: 'running' }
  | { type: 'progress'; snapshots: number }
  /** The run ended. `workerGone`: the worker was terminated (time limit, Stop, crash). */
  | { type: 'settled'; run: MappedRun; workerGone: boolean }
  /** Stop pressed with no run in flight (during the preload): the worker is gone. */
  | { type: 'stop' };

export const INITIAL_PY_RUN_STATE: PyRunState = {
  status: { phase: 'idle' },
  runtime: 'cold',
  inFlight: false,
  seq: 0,
};

/** The initial state for a runner whose worker may already be warm (the mode was opened before). */
export function initialPyRunState(runtimeReady: boolean): PyRunState {
  return { ...INITIAL_PY_RUN_STATE, runtime: runtimeReady ? 'ready' : 'cold' };
}

const busy = (s: PyRunStatus) =>
  s.phase === 'loading-runtime' || s.phase === 'loading-packages' || s.phase === 'running';

/** What a settled run shows. */
function settledStatus(run: MappedRun): PyRunStatus {
  if (run.kind === 'trace') return { phase: 'done', trace: run.trace, ending: run.ending };
  if (run.kind === 'error') return { phase: 'error', error: run.error };
  return { phase: 'stopped' };
}

/** Advance the state machine. Pure. */
export function pyRunReducer(state: PyRunState, action: PyRunAction): PyRunState {
  switch (action.type) {
    case 'preload': {
      if (state.runtime !== 'cold') return state;
      return {
        ...state,
        runtime: 'loading',
        status: state.status.phase === 'idle' ? { phase: 'loading-runtime' } : state.status,
      };
    }
    case 'runtime-ready': {
      const status =
        !state.inFlight && state.status.phase === 'loading-runtime'
          ? ({ phase: 'idle' } as const)
          : state.status;
      return { ...state, runtime: 'ready', status };
    }
    case 'runtime-failed': {
      // A run in flight reports its own failure when it settles.
      if (state.inFlight) return { ...state, runtime: 'cold' };
      return {
        ...state,
        runtime: 'cold',
        status: { phase: 'error', error: { type: 'LoadError', message: action.message } },
      };
    }
    case 'run': {
      if (state.inFlight) return state;
      const status: PyRunStatus =
        state.runtime !== 'ready'
          ? { phase: 'loading-runtime' }
          : action.pending.length > 0
            ? { phase: 'loading-packages', packages: action.pending }
            : { phase: 'running', snapshots: 0 };
      return {
        ...state,
        inFlight: true,
        runtime: state.runtime === 'cold' ? 'loading' : state.runtime,
        status,
      };
    }
    case 'packages': {
      if (!state.inFlight || action.packages.length === 0) return state;
      return {
        ...state,
        runtime: 'ready',
        status: { phase: 'loading-packages', packages: action.packages },
      };
    }
    case 'running': {
      if (!state.inFlight) return state;
      return { ...state, runtime: 'ready', status: { phase: 'running', snapshots: 0 } };
    }
    case 'progress': {
      if (!state.inFlight || state.status.phase !== 'running') return state;
      return { ...state, status: { phase: 'running', snapshots: action.snapshots } };
    }
    case 'settled': {
      if (!state.inFlight) return state;
      const { run } = action;
      return {
        ...state,
        inFlight: false,
        runtime: action.workerGone ? 'cold' : 'ready',
        seq: run.kind === 'trace' ? state.seq + 1 : state.seq,
        status: settledStatus(run),
      };
    }
    case 'stop': {
      if (state.inFlight || state.runtime !== 'loading') return state;
      return {
        ...state,
        runtime: 'cold',
        status: busy(state.status) ? { phase: 'stopped' } : state.status,
      };
    }
  }
}

/** Run is offered (not disabled). */
export function canRun(state: PyRunState): boolean {
  return !state.inFlight;
}

/** Stop is offered: a run is in flight, or Pyodide is still loading. */
export function canStop(state: PyRunState): boolean {
  return state.inFlight || state.runtime === 'loading';
}
