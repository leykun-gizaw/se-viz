/**
 * Run-state machine tests — the Live Coding mode's loading / success / error mapping, driven by
 * the same {@link PostTraceResult} shapes the (mocked) client produces.
 */
import { describe, expect, it } from 'vitest';
import type { Trace } from '../engine/trace/types.ts';
import { errorHeadline, INITIAL_RUN_STATE, runReducer, truncationBanner } from './runState.ts';
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
    const s = runReducer(INITIAL_RUN_STATE, { type: 'run' });
    expect(s.status.phase).toBe('loading');
  });

  it('maps a successful settle to success and bumps the player seq', () => {
    const loading = runReducer(INITIAL_RUN_STATE, { type: 'run' });
    const s = runReducer(loading, { type: 'settled', result: success });
    expect(s.status).toEqual({ phase: 'success', trace, truncated: null });
    expect(s.seq).toBe(1);
  });

  it('carries the truncation marker into the success state', () => {
    const loading = runReducer(INITIAL_RUN_STATE, { type: 'run' });
    const truncated = { reasons: ['step_limit' as const], originalSteps: 9000 };
    const s = runReducer(loading, { type: 'settled', result: { ok: true, trace, truncated } });
    expect(s.status).toMatchObject({ phase: 'success', truncated });
  });

  it('maps a failed settle to error, keeping the typed error (gcc details included)', () => {
    const loading = runReducer(INITIAL_RUN_STATE, { type: 'run' });
    const s = runReducer(loading, { type: 'settled', result: failure('compile_error', 'gcc says no') });
    expect(s.status).toEqual({
      phase: 'error',
      error: { code: 'compile_error', message: 'm', details: 'gcc says no' },
    });
  });

  it('a new run replaces an error with loading; the next seq remounts the player', () => {
    let s = runReducer(INITIAL_RUN_STATE, { type: 'run' });
    s = runReducer(s, { type: 'settled', result: failure('timeout') });
    s = runReducer(s, { type: 'run' });
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
