/**
 * Python live coding (Phase 31), the pure parts: package detection, limits, the mapping of worker
 * outcomes to what the view shows (on the Phase 29 recordings), and the run-state machine.
 */
import { describe, expect, it } from 'vitest';
import { validateTrace } from '../../engine/trace/validate.ts';
import type { RunOutcome } from '../client.ts';
import harvest from '../fixtures/harvest.json';
import infiniteLoop from '../fixtures/infinite-loop.json';
import runtimeError from '../fixtures/runtime-error.json';
import syntaxError from '../fixtures/syntax-error.json';
import type { RunResult } from '../protocol.ts';
import { SAMPLES } from '../samples/index.ts';
import { DEFAULT_PYTHON_PROGRAM } from './defaultProgram.ts';
import {
  clampLimit,
  DEFAULT_LIVE_LIMITS,
  LIVE_MAX_DEPTH,
  parseStoredLimits,
  toRunLimits,
} from './limits.ts';
import { exceptionHeadline, mapOutcome, type MappedRun } from './outcome.ts';
import { detectPackages, packageList } from './packages.ts';
import {
  canRun,
  canStop,
  INITIAL_PY_RUN_STATE,
  initialPyRunState,
  pyRunReducer,
  type PyRunAction,
  type PyRunState,
} from './runState.ts';

const source = (name: string) => {
  const s = SAMPLES.find((x) => x.name === name);
  if (!s) throw new Error(name);
  return s.request.source;
};

function outcome(result: RunResult, extra: Partial<RunOutcome> = {}): RunOutcome {
  return {
    result,
    timings: { bootMs: null, packagesMs: 0, runMs: 1, totalMs: 1 },
    coldStart: false,
    killed: false,
    stopped: false,
    ...extra,
  };
}

const map = (result: RunResult, name: string, extra: Partial<RunOutcome> = {}) =>
  mapOutcome(outcome(result, extra), source(name), DEFAULT_LIVE_LIMITS, `live-${name}`);

function traceOf(run: MappedRun) {
  if (run.kind !== 'trace') throw new Error(`expected a trace, got ${run.kind}`);
  return run;
}

describe('detectPackages', () => {
  it.each([
    ['import numpy as np', ['numpy']],
    ['import pandas', ['pandas']],
    ['from pandas import DataFrame', ['pandas']],
    ['import matplotlib.pyplot as plt', ['matplotlib']],
    ['from scipy import stats', ['scipy']],
    ['from scipy.stats import norm', ['scipy']],
    ['import os, numpy as np, sys', ['numpy']],
    ['import math; import pandas as pd', ['pandas']],
    ['def f():\n    import numpy\n', ['numpy']],
    ['import pandas as pd\nimport numpy as np\n', ['numpy', 'pandas']],
    [
      'import scipy\nimport matplotlib\nimport pandas\nimport numpy',
      ['numpy', 'pandas', 'matplotlib', 'scipy'],
    ],
  ])('%j loads %j', (src, expected) => {
    expect(detectPackages(src)).toEqual(expected);
  });

  it.each([
    ['# import pandas'],
    ['x = 1  # import numpy'],
    ['import numpyish'],
    ['import js'],
    ['import micropip'],
    ['from . import pandas'],
    ['print("import pandas")'],
    ['import math\nimport random'],
  ])('%j loads nothing', (src) => {
    expect(detectPackages(src)).toEqual([]);
  });

  it('the default program and the samples load nothing', () => {
    expect(detectPackages(DEFAULT_PYTHON_PROGRAM)).toEqual([]);
    for (const s of SAMPLES) expect(detectPackages(s.request.source)).toEqual([]);
  });

  it('lists packages for the status line', () => {
    expect(packageList(['pandas'])).toBe('pandas');
    expect(packageList(['numpy', 'pandas'])).toBe('numpy and pandas');
    expect(packageList(['numpy', 'pandas', 'scipy'])).toBe('numpy, pandas and scipy');
  });
});

describe('limits', () => {
  it('defaults: 1000 steps, 10 s, 500 lines; recursion capped at 100 frames', () => {
    expect(DEFAULT_LIVE_LIMITS).toEqual({ maxSteps: 1000, timeoutS: 10, maxStdoutLines: 500 });
    expect(toRunLimits(DEFAULT_LIVE_LIMITS)).toEqual({
      maxSteps: 1000,
      timeoutMs: 10_000,
      maxStdoutLines: 500,
      maxDepth: LIVE_MAX_DEPTH,
    });
    expect(LIVE_MAX_DEPTH).toBe(100);
  });

  it('clamps steps to at most 5000 and rejects junk', () => {
    expect(clampLimit('maxSteps', 99_999)).toBe(5000);
    expect(clampLimit('maxSteps', 0)).toBe(10);
    expect(clampLimit('maxSteps', '2500')).toBe(2500);
    expect(clampLimit('maxSteps', 'lots')).toBe(1000);
    expect(clampLimit('timeoutS', 2.6)).toBe(3);
    expect(clampLimit('timeoutS', 600)).toBe(30);
  });

  it('re-validates whatever was stored', () => {
    expect(parseStoredLimits(null)).toEqual(DEFAULT_LIVE_LIMITS);
    expect(parseStoredLimits('x')).toEqual(DEFAULT_LIVE_LIMITS);
    expect(parseStoredLimits({ maxSteps: 7000, timeoutS: 'x' })).toEqual({
      ...DEFAULT_LIVE_LIMITS,
      maxSteps: 5000,
    });
  });
});

describe('mapOutcome', () => {
  it('a normal run is a valid trace with no ending', () => {
    const run = traceOf(map(harvest as RunResult, 'harvest'));
    expect(run.ending).toBeNull();
    expect(run.trace).toMatchObject({ language: 'python', file: 'main.py', id: 'live-harvest' });
    expect(run.trace.steps).toHaveLength(19);
    expect(validateTrace(run.trace)).toEqual([]);
  });

  it('a syntax error is an error with the line and column, and no trace', () => {
    const run = map(syntaxError as RunResult, 'syntax-error');
    expect(run).toEqual({
      kind: 'error',
      error: {
        type: 'SyntaxError',
        message: "'(' was never closed",
        line: 1,
        column: 10,
        detail: expect.stringContaining('File "main.py", line 1') as unknown as string,
      },
    });
  });

  it('a runtime exception ends the trace on a step with the type, message, line and traceback', () => {
    const run = traceOf(map(runtimeError as RunResult, 'runtime-error'));
    expect(run.ending).toEqual({
      kind: 'exception',
      type: 'KeyError',
      message: "'beans'",
      line: 5,
    });
    const steps = run.trace.steps;
    expect(steps).toHaveLength(11); // 10 recorded + the exception step
    const last = steps[steps.length - 1];
    const before = steps[steps.length - 2];
    expect(last.narration).toBe(
      "KeyError: 'beans' (line 5). The program stopped here with an uncaught exception.",
    );
    expect(last.highlightedLines).toEqual([5]);
    expect(last.stack).toEqual(before.stack);
    expect(last.heap).toEqual(before.heap);
    expect(last.stdout).toEqual([
      'Traceback (most recent call last):',
      '  File "main.py", line 5, in <module>',
      '    total = total + prices[item]',
      '                    ~~~~~~^^^^^^',
      "KeyError: 'beans'",
    ]);
    expect(validateTrace(run.trace)).toEqual([]);
  });

  it('a step-limit truncation ends on "Stopped after N steps"', () => {
    const truncated = { ...(infiniteLoop as RunResult), truncated: 'steps' as const };
    const run = traceOf(map(truncated, 'infinite-loop'));
    const steps = run.trace.steps;
    expect(run.ending).toEqual({ kind: 'stopped', reason: 'steps', steps: 39 });
    expect(steps).toHaveLength(40);
    expect(steps[39].narration).toBe('Stopped after 39 steps: the step limit (1000) was reached.');
    expect(steps[39].highlightedLines).toEqual(steps[38].highlightedLines);
    expect(validateTrace(run.trace)).toEqual([]);
  });

  it.each([
    ['time', 'the time limit (10 s) was reached'],
    ['stdout', 'the output limit (500 lines) was reached'],
    ['size', 'the recording grew too large to show'],
  ] as const)('a %s truncation names its limit', (reason, words) => {
    const run = traceOf(map({ ...(harvest as RunResult), truncated: reason }, 'harvest'));
    expect(run.trace.steps[run.trace.steps.length - 1].narration).toBe(
      `Stopped after 19 steps: ${words}.`,
    );
  });

  it('Stop keeps the steps recorded so far', () => {
    const run = traceOf(map(harvest as RunResult, 'harvest', { killed: true, stopped: true }));
    expect(run.ending).toEqual({ kind: 'stopped', reason: 'stopped', steps: 19 });
    expect(run.trace.steps[19].narration).toBe('Stopped after 19 steps: you pressed Stop.');
  });

  it('Stop before the first step shows no trace', () => {
    expect(map({ steps: [], stdout: '' }, 'harvest', { killed: true, stopped: true })).toEqual({
      kind: 'stopped',
    });
  });

  it('a kill at the time limit keeps the streamed steps', () => {
    const killed: RunResult = {
      ...(harvest as RunResult),
      truncated: 'time',
      error: { type: 'TimeoutError', message: 'Stopped after 10 s: the time limit was reached.' },
    };
    const run = traceOf(map(killed, 'harvest', { killed: true }));
    expect(run.ending).toEqual({ kind: 'stopped', reason: 'time', steps: 19 });
  });

  it('a swallowed recorder stop (bare except) is named', () => {
    const killed: RunResult = {
      ...(harvest as RunResult),
      truncated: 'time',
      error: { type: 'TimeoutError', message: '…' },
    };
    const run = traceOf(map(killed, 'harvest', { killed: true, recorderStop: 'steps' }));
    expect(run.ending).toEqual({ kind: 'stopped', reason: 'steps', steps: 19, swallowed: true });
    expect(run.trace.steps[19].narration).toContain('caught the stop (a bare `except:`)');
  });

  it('a kill with no steps is an error that says nothing traceable ran', () => {
    const run = map(
      {
        steps: [],
        stdout: '',
        truncated: 'time',
        error: { type: 'TimeoutError', message: 'Stopped after 10 s: the time limit was reached.' },
      },
      'harvest',
      { killed: true },
    );
    expect(run).toMatchObject({ kind: 'error', error: { type: 'TimeoutError' } });
    expect(run.kind === 'error' && run.error.message).toContain('Nothing ran that the recorder');
  });

  it('a deep recursion stop is a RecursionError, not a truncation', () => {
    const result: RunResult = {
      ...(harvest as RunResult),
      error: { type: 'RecursionError', message: 'maximum recursion depth exceeded', line: 2 },
    };
    expect(traceOf(map(result, 'harvest')).ending).toMatchObject({
      kind: 'exception',
      type: 'RecursionError',
    });
  });

  it('an empty program has nothing to show', () => {
    expect(map({ steps: [], stdout: '' }, 'harvest')).toMatchObject({ kind: 'error' });
  });

  it('headlines', () => {
    expect(exceptionHeadline({ type: 'ValueError', message: '' })).toBe('ValueError');
    expect(exceptionHeadline({ type: 'E', message: 'm', line: 3 })).toBe('E: m (line 3)');
  });
});

describe('pyRunReducer', () => {
  const run = (s: PyRunState, ...actions: PyRunAction[]) => actions.reduce(pyRunReducer, s);
  const traceRun = traceOf(map(harvest as RunResult, 'harvest'));
  const errorRun = map(syntaxError as RunResult, 'syntax-error');

  it('opening the mode loads the runtime; ready returns to idle', () => {
    const loading = run(INITIAL_PY_RUN_STATE, { type: 'preload' });
    expect(loading).toMatchObject({ runtime: 'loading', status: { phase: 'loading-runtime' } });
    expect(canStop(loading)).toBe(true);
    expect(canRun(loading)).toBe(true);
    const ready = run(loading, { type: 'runtime-ready' });
    expect(ready).toMatchObject({ runtime: 'ready', status: { phase: 'idle' }, inFlight: false });
    expect(canStop(ready)).toBe(false);
  });

  it('a warm runner starts ready, and preloading again changes nothing', () => {
    const warm = initialPyRunState(true);
    expect(run(warm, { type: 'preload' })).toBe(warm);
  });

  it('idle → running → done, with progress', () => {
    let s = run(initialPyRunState(true), { type: 'run', pending: [] });
    expect(s).toMatchObject({ inFlight: true, status: { phase: 'running', snapshots: 0 } });
    expect(canRun(s)).toBe(false);
    expect(canStop(s)).toBe(true);
    s = run(s, { type: 'running' }, { type: 'progress', snapshots: 200 });
    expect(s.status).toEqual({ phase: 'running', snapshots: 200 });
    s = run(s, { type: 'settled', run: traceRun, workerGone: false });
    expect(s).toMatchObject({ inFlight: false, runtime: 'ready', seq: 1 });
    expect(s.status).toEqual({ phase: 'done', trace: traceRun.trace, ending: null });
  });

  it('a run pressed while the runtime loads waits in loading-runtime, then loads packages', () => {
    let s = run(INITIAL_PY_RUN_STATE, { type: 'preload' }, { type: 'run', pending: ['pandas'] });
    expect(s.status).toEqual({ phase: 'loading-runtime' });
    s = run(s, { type: 'runtime-ready' });
    expect(s.status).toEqual({ phase: 'loading-runtime' }); // still in flight
    s = run(s, { type: 'packages', packages: ['pandas'] });
    expect(s.status).toEqual({ phase: 'loading-packages', packages: ['pandas'] });
    s = run(s, { type: 'running' });
    expect(s.status.phase).toBe('running');
  });

  it('a cold run (no preload) goes straight to loading-runtime', () => {
    const s = run(INITIAL_PY_RUN_STATE, { type: 'run', pending: [] });
    expect(s).toMatchObject({ runtime: 'loading', status: { phase: 'loading-runtime' } });
  });

  it('known missing packages show as loading-packages at once on a warm runtime', () => {
    const s = run(initialPyRunState(true), { type: 'run', pending: ['numpy', 'pandas'] });
    expect(s.status).toEqual({ phase: 'loading-packages', packages: ['numpy', 'pandas'] });
  });

  it('a second Run while one is in flight is ignored', () => {
    const s = run(initialPyRunState(true), { type: 'run', pending: [] });
    expect(run(s, { type: 'run', pending: ['pandas'] })).toBe(s);
  });

  it('a syntax error settles to error, keeping the runtime', () => {
    const s = run(
      initialPyRunState(true),
      { type: 'run', pending: [] },
      { type: 'running' },
      { type: 'settled', run: errorRun, workerGone: false },
    );
    expect(s).toMatchObject({ runtime: 'ready', seq: 0, status: { phase: 'error' } });
  });

  it('a stopped run with steps is done; the worker is gone, so the runtime is cold', () => {
    const stopped = traceOf(map(harvest as RunResult, 'harvest', { killed: true, stopped: true }));
    const s = run(
      initialPyRunState(true),
      { type: 'run', pending: [] },
      { type: 'running' },
      { type: 'settled', run: stopped, workerGone: true },
    );
    expect(s).toMatchObject({
      runtime: 'cold',
      inFlight: false,
      seq: 1,
      status: { phase: 'done' },
    });
    // The next Run reloads the runtime.
    expect(run(s, { type: 'run', pending: [] }).status).toEqual({ phase: 'loading-runtime' });
  });

  it('a run stopped before any step is stopped', () => {
    const s = run(
      initialPyRunState(true),
      { type: 'run', pending: [] },
      { type: 'settled', run: { kind: 'stopped' }, workerGone: true },
    );
    expect(s).toMatchObject({ runtime: 'cold', status: { phase: 'stopped' } });
  });

  it('Stop during the preload ends it', () => {
    const s = run(INITIAL_PY_RUN_STATE, { type: 'preload' }, { type: 'stop' });
    expect(s).toMatchObject({ runtime: 'cold', status: { phase: 'stopped' } });
  });

  it('Stop during the preload keeps a trace already on screen', () => {
    let s = run(
      initialPyRunState(true),
      { type: 'run', pending: [] },
      { type: 'settled', run: traceRun, workerGone: true },
    );
    s = run(s, { type: 'preload' });
    expect(s.status.phase).toBe('done'); // a preload never hides the trace
    s = run(s, { type: 'stop' });
    expect(s).toMatchObject({ runtime: 'cold', status: { phase: 'done' } });
  });

  it('a failed preload is a LoadError; a run in flight reports its own', () => {
    const failed = run(
      INITIAL_PY_RUN_STATE,
      { type: 'preload' },
      { type: 'runtime-failed', message: 'offline' },
    );
    expect(failed).toMatchObject({
      runtime: 'cold',
      status: { phase: 'error', error: { type: 'LoadError', message: 'offline' } },
    });
    const inFlight = run(
      INITIAL_PY_RUN_STATE,
      { type: 'preload' },
      { type: 'run', pending: [] },
      { type: 'runtime-failed', message: 'offline' },
    );
    expect(inFlight.status.phase).toBe('loading-runtime');
  });

  it('stale messages with nothing in flight are ignored', () => {
    const idle = initialPyRunState(true);
    for (const action of [
      { type: 'running' },
      { type: 'progress', snapshots: 3 },
      { type: 'packages', packages: ['numpy'] },
      { type: 'settled', run: traceRun, workerGone: false },
      { type: 'stop' },
    ] as PyRunAction[]) {
      expect(run(idle, action)).toBe(idle);
    }
  });
});
