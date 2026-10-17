/**
 * The runner features Phase 31's live editor relies on, with a fake worker: preloading Pyodide,
 * Stop, package and progress hooks, and streamed steps surviving a kill.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PythonRunner, type WorkerLike } from './client.ts';
import type { PySnapshot, RunResult, WorkerMessage, WorkerResponse } from './protocol.ts';

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: WorkerMessage[] = [];
  terminated = false;
  private readonly behave: (w: FakeWorker, msg: WorkerMessage) => void;
  constructor(behave: (w: FakeWorker, msg: WorkerMessage) => void) {
    this.behave = behave;
  }
  postMessage(message: WorkerMessage) {
    this.posted.push(message);
    this.behave(this, message);
  }
  terminate() {
    this.terminated = true;
  }
  send(msg: WorkerResponse) {
    this.onmessage?.({ data: msg } as MessageEvent<WorkerResponse>);
  }
}

const snap = (line: number, stdout = ''): PySnapshot => ({
  event: 'line',
  line,
  frames: [{ id: 'f1', name: '<module>', line, vars: [] }],
  objects: {},
  stdout,
});
const OK: RunResult = { steps: [snap(1)], stdout: '' };

function pool(behave: (w: FakeWorker, msg: WorkerMessage) => void) {
  const workers: FakeWorker[] = [];
  const createWorker = () => {
    const w = new FakeWorker(behave);
    workers.push(w);
    return w;
  };
  return { workers, createWorker };
}

describe('PythonRunner (Phase 31)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('preload boots the worker once; the next run is warm and reuses it', async () => {
    const { workers, createWorker } = pool((self, msg) => {
      queueMicrotask(() => {
        if (msg.type === 'load') self.send({ type: 'loaded', ms: 700, version: 'x' });
        else {
          self.send({ type: 'running', id: msg.id, packagesMs: 0 });
          self.send({ type: 'result', id: msg.id, result: OK, runMs: 1, packagesMs: 0 });
        }
      });
    });
    const runner = new PythonRunner({ createWorker });
    expect(runner.ready).toBe(false);
    await expect(runner.preload()).resolves.toEqual({ ok: true, ms: 700 });
    expect(runner.ready).toBe(true);
    await expect(runner.preload()).resolves.toEqual({ ok: true, ms: null });
    const outcome = await runner.run({ source: 'x = 1' });
    expect(outcome).toMatchObject({ coldStart: false, killed: false, stopped: false, result: OK });
    expect(workers).toHaveLength(1);
    expect(workers[0].posted.map((m) => m.type)).toEqual(['load', 'run']);
  });

  it('a failed preload reports the message and drops the worker', async () => {
    const { workers, createWorker } = pool((self, msg) => {
      if (msg.type === 'load')
        queueMicrotask(() => self.send({ type: 'fatal', id: null, message: 'no network' }));
    });
    const runner = new PythonRunner({ createWorker });
    await expect(runner.preload()).resolves.toEqual({ ok: false, message: 'no network' });
    expect(workers[0].terminated).toBe(true);
    expect(runner.ready).toBe(false);
  });

  it('a preload that never finishes times out', async () => {
    const { workers, createWorker } = pool(() => {});
    const runner = new PythonRunner({ createWorker, loadTimeoutMs: 5000 });
    const pending = runner.preload();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toMatchObject({ ok: false });
    expect(workers[0].terminated).toBe(true);
  });

  it('Stop during a preload terminates the worker; the next run starts a fresh one', async () => {
    const { workers, createWorker } = pool((self, msg) => {
      if (msg.type === 'run' && workers.length > 1) {
        queueMicrotask(() => {
          self.send({ type: 'loaded', ms: 1, version: 'x' });
          self.send({ type: 'running', id: msg.id, packagesMs: 0 });
          self.send({ type: 'result', id: msg.id, result: OK, runMs: 1, packagesMs: 0 });
        });
      }
    });
    const runner = new PythonRunner({ createWorker });
    const pending = runner.preload();
    runner.stop();
    expect(await pending).toEqual({ ok: false, message: 'Stopped.', stopped: true });
    expect(workers[0].terminated).toBe(true);
    const outcome = await runner.run({ source: 'x = 1' });
    expect(outcome).toMatchObject({ coldStart: true, result: OK });
    expect(workers).toHaveLength(2);
  });

  it('reports packages, running and progress, and remembers loaded packages', async () => {
    const { createWorker } = pool((self, msg) => {
      if (msg.type !== 'run') return;
      queueMicrotask(() => {
        self.send({ type: 'loaded', ms: 1, version: 'x' });
        self.send({ type: 'packages', id: msg.id, packages: ['pandas'] });
        self.send({ type: 'running', id: msg.id, packagesMs: 900, loaded: ['numpy', 'pandas'] });
        self.send({ type: 'steps', id: msg.id, chunk: JSON.stringify([snap(1)]), total: 1 });
        self.send({ type: 'result', id: msg.id, result: OK, runMs: 1, packagesMs: 900 });
      });
    });
    const runner = new PythonRunner({ createWorker });
    const events: string[] = [];
    await runner.run(
      { source: 'import pandas' },
      {
        onPackages: (p) => events.push(`packages:${p.join(',')}`),
        onRunning: () => events.push('running'),
        onProgress: (n) => events.push(`progress:${n}`),
      },
    );
    expect(events).toEqual(['packages:pandas', 'running', 'progress:1']);
    expect([...runner.loadedPackages]).toEqual(['numpy', 'pandas']);
  });

  it('Stop during a run ends it with the steps streamed so far', async () => {
    const { workers, createWorker } = pool((self, msg) => {
      if (msg.type !== 'run') return;
      queueMicrotask(() => {
        self.send({ type: 'loaded', ms: 1, version: 'x' });
        self.send({ type: 'running', id: msg.id, packagesMs: 0 });
        self.send({
          type: 'steps',
          id: msg.id,
          chunk: JSON.stringify([snap(1), snap(2, 'hi\n')]),
          total: 2,
        });
        self.send({
          type: 'steps',
          id: msg.id,
          chunk: JSON.stringify([snap(3, 'hi\n')]),
          total: 3,
        });
      });
    });
    const runner = new PythonRunner({ createWorker });
    const pending = runner.run({ source: 'while True: pass' });
    await vi.advanceTimersByTimeAsync(10);
    runner.stop();
    const outcome = await pending;
    expect(outcome).toMatchObject({ killed: true, stopped: true });
    expect(outcome.result.steps.map((s) => s.line)).toEqual([1, 2, 3]);
    expect(outcome.result.stdout).toBe('hi\n');
    expect(outcome.result.error).toBeUndefined();
    expect(workers[0].terminated).toBe(true);
    expect(runner.ready).toBe(false);
  });

  it('a run killed at the time limit keeps its streamed steps and the swallowed stop reason', async () => {
    const { createWorker } = pool((self, msg) => {
      if (msg.type !== 'run') return;
      queueMicrotask(() => {
        self.send({ type: 'running', id: msg.id, packagesMs: 0 });
        // The recorder stopped the program at the step limit, but the program caught the stop
        // (a bare `except:`) and loops on, untraced: no result ever comes.
        self.send({
          type: 'steps',
          id: msg.id,
          chunk: JSON.stringify([snap(1), snap(2)]),
          total: 2,
          stop: 'steps',
        });
      });
    });
    const runner = new PythonRunner({ createWorker, killGraceMs: 500 });
    const pending = runner.run({ source: '…', limits: { timeoutMs: 1000 } });
    await vi.advanceTimersByTimeAsync(1500);
    const outcome = await pending;
    expect(outcome).toMatchObject({ killed: true, stopped: false, recorderStop: 'steps' });
    expect(outcome.result).toMatchObject({ truncated: 'time', error: { type: 'TimeoutError' } });
    expect(outcome.result.steps).toHaveLength(2);
  });

  it('Stop with nothing in flight on a warm worker keeps it', async () => {
    const { workers, createWorker } = pool((self, msg) => {
      if (msg.type === 'load')
        queueMicrotask(() => self.send({ type: 'loaded', ms: 1, version: 'x' }));
    });
    const runner = new PythonRunner({ createWorker });
    await runner.preload();
    runner.stop();
    expect(workers[0].terminated).toBe(false);
    expect(runner.ready).toBe(true);
  });
});

describe('progress throttling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports at most every 100 ms, and always the latest count in the end', async () => {
    const { createWorker } = pool((self, msg) => {
      if (msg.type !== 'run') return;
      queueMicrotask(() => {
        self.send({ type: 'loaded', ms: 1, version: 'x' });
        self.send({ type: 'running', id: msg.id, packagesMs: 0 });
        for (let i = 1; i <= 3; i++) {
          self.send({ type: 'steps', id: msg.id, chunk: JSON.stringify([snap(i)]), total: i });
        }
      });
    });
    const runner = new PythonRunner({ createWorker });
    const seen: number[] = [];
    const pending = runner.run({ source: '…' }, { onProgress: (n) => seen.push(n) });
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toEqual([1]);
    await vi.advanceTimersByTimeAsync(150);
    expect(seen).toEqual([1, 3]);
    runner.stop();
    expect((await pending).result.steps).toHaveLength(3);
  });
});
