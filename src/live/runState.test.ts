/**
 * Run-state machine tests — the Live Coding mode's loading / success / error mapping, driven by
 * the same {@link PostTraceResult} shapes the (mocked) client produces.
 */
import { describe, expect, it } from 'vitest';
import type { Trace } from '../engine/trace/types.ts';
import {
  countWarnings,
  errorHeadline,
  INITIAL_RUN_STATE,
  runReducer,
  truncationBanner,
  warningsHeadline,
  werrorExplanation,
} from './runState.ts';
import type { PostTraceResult } from './tracerClient.ts';

const trace = { id: 't', title: 't', language: 'c', source: 'x\n', steps: [] } as unknown as Trace;

const success: PostTraceResult = { ok: true, trace };
const failure = (code: Parameters<typeof errorHeadline>[0], details?: string): PostTraceResult => ({
  ok: false,
  error: { code, message: 'm', ...(details !== undefined ? { details } : {}) },
});

describe('runReducer', () => {
  it('starts idle and enters loading on run', () => {
    expect(INITIAL_RUN_STATE.status.phase).toBe('idle');
    const s = runReducer(INITIAL_RUN_STATE, { type: 'run', flags: [] });
    expect(s.status.phase).toBe('loading');
  });

  it('maps a successful settle to success and bumps the player seq', () => {
    const loading = runReducer(INITIAL_RUN_STATE, { type: 'run', flags: [] });
    const s = runReducer(loading, { type: 'settled', result: success });
    expect(s.status).toEqual({ phase: 'success', trace, truncated: null });
    expect(s.seq).toBe(1);
  });

  it('carries the truncation marker into the success state', () => {
    const loading = runReducer(INITIAL_RUN_STATE, { type: 'run', flags: [] });
    const truncated = { reasons: ['step_limit' as const], originalSteps: 9000 };
    const s = runReducer(loading, { type: 'settled', result: { ok: true, trace, truncated } });
    expect(s.status).toMatchObject({ phase: 'success', truncated });
  });

  it('maps a failed settle to error, keeping the typed error (gcc details included)', () => {
    const loading = runReducer(INITIAL_RUN_STATE, { type: 'run', flags: [] });
    const s = runReducer(loading, { type: 'settled', result: failure('compile_error', 'gcc says no') });
    expect(s.status).toEqual({
      phase: 'error',
      error: { code: 'compile_error', message: 'm', details: 'gcc says no' },
    });
  });

  it('a new run replaces an error with loading; the next seq remounts the player', () => {
    let s = runReducer(INITIAL_RUN_STATE, { type: 'run', flags: [] });
    s = runReducer(s, { type: 'settled', result: failure('timeout') });
    s = runReducer(s, { type: 'run', flags: [] });
    expect(s.status.phase).toBe('loading');
    const before = s.seq;
    s = runReducer(s, { type: 'settled', result: success });
    expect(s.seq).toBe(before + 1);
  });

  it('ignores a stale settle when nothing is in flight', () => {
    const s = runReducer(INITIAL_RUN_STATE, { type: 'settled', result: success });
    expect(s).toBe(INITIAL_RUN_STATE);
  });
});

describe('compile flags travel with the run', () => {
  it('records the flags the run was launched with', () => {
    const s = runReducer(INITIAL_RUN_STATE, { type: 'run', flags: ['-Wall', '-std=gnu89'] });
    expect(s.flags).toEqual(['-Wall', '-std=gnu89']);
  });

  it('keeps them through a settle, so the result is labelled with what produced it', () => {
    let s = runReducer(INITIAL_RUN_STATE, { type: 'run', flags: ['-Werror', '-std=c11'] });
    s = runReducer(s, { type: 'settled', result: failure('compile_error', 'gcc says no') });
    expect(s.flags).toEqual(['-Werror', '-std=c11']);
  });

  it('carries warnings and the backend echo into the success state', () => {
    const loading = runReducer(INITIAL_RUN_STATE, { type: 'run', flags: ['-Wall', '-std=c11'] });
    const s = runReducer(loading, {
      type: 'settled',
      result: { ok: true, trace, warnings: 'w: unused', flags: ['-Wall', '-std=c11'] },
    });
    expect(s.status).toMatchObject({
      phase: 'success',
      warnings: 'w: unused',
      appliedFlags: ['-Wall', '-std=c11'],
    });
  });

  it('omits warnings entirely on a clean compile', () => {
    const loading = runReducer(INITIAL_RUN_STATE, { type: 'run', flags: [] });
    const s = runReducer(loading, { type: 'settled', result: success });
    expect(s.status).toEqual({ phase: 'success', trace, truncated: null });
    if (s.status.phase === 'success') expect('warnings' in s.status).toBe(false);
  });
});

describe('the -Werror explanation', () => {
  it('appears on a compile_error when -Werror was on', () => {
    expect(werrorExplanation('compile_error', ['-Wall', '-Werror', '-std=c11'])).toBe(
      '-Werror is on, so a warning stopped the build. Untick it to run anyway.',
    );
  });

  it('stays away when -Werror was off — the code really is broken', () => {
    expect(werrorExplanation('compile_error', ['-Wall', '-std=c11'])).toBeNull();
  });

  it('stays away for failures that have nothing to do with warnings', () => {
    expect(werrorExplanation('timeout', ['-Werror'])).toBeNull();
    expect(werrorExplanation('unavailable', ['-Werror'])).toBeNull();
    expect(werrorExplanation('too_large', ['-Werror'])).toBeNull();
  });
});

describe('the warnings headline', () => {
  const one = "u.c:4:9: warning: unused variable 'x' [-Wunused-variable]\n int x;\n     ^";
  const two = `${one}\nu.c:5:9: warning: unused variable 'y' [-Wunused-variable]`;

  it('counts gcc diagnostics, not output lines', () => {
    expect(countWarnings(one)).toBe(1);
    expect(countWarnings(two)).toBe(2);
    expect(countWarnings('')).toBe(0);
  });

  it('reads naturally in the singular and the plural', () => {
    expect(warningsHeadline(one)).toBe('Compiled with 1 warning');
    expect(warningsHeadline(two)).toBe('Compiled with 2 warnings');
  });
});

describe('learner-facing messages', () => {
  it('words each error the way the prompt specifies', () => {
    expect(errorHeadline('timeout')).toBe('Your program ran too long (likely an infinite loop).');
    expect(errorHeadline('too_large')).toBe('Program is too large.');
    expect(errorHeadline('compile_error')).toBe('Your program did not compile.');
    expect(errorHeadline('recorder_error')).toBe('The visualizer service is unavailable.');
    expect(errorHeadline('unavailable')).toBe('The visualizer service is unavailable.');
    expect(errorHeadline('invalid_trace')).toBe('The visualizer service is unavailable.');
  });

  it('names the truncation reasons in the banner', () => {
    expect(
      truncationBanner({ reasons: ['step_limit', 'output_limit'], originalSteps: 5000 }),
    ).toContain('too many steps and too much output');
  });
});
