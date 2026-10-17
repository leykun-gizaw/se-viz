/**
 * The main-thread runner with a fake worker: the wall-clock limit terminates and recreates the
 * worker, so a stuck program can never hang the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PythonRunner, type WorkerLike } from './client.ts';
import type { RunResult, WorkerRequest, WorkerResponse } from './protocol.ts';

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: WorkerRequest[] = [];
  terminated = false;
  private readonly behave: (w: FakeWorker, msg: WorkerRequest) => void;
  constructor(behave: (w: FakeWorker, msg: WorkerRequest) => void) {
    this.behave = behave;
  }
  postMessage(message: WorkerRequest) {
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

const OK: RunResult = { steps: [], stdout: 'hi\n' };

describe('PythonRunner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the worker result and reuses a warm worker', async () => {
    const workers: FakeWorker[] = [];
    const runner = new PythonRunner({
      createWorker: () => {
        const w = new FakeWorker((self, msg) => {
          queueMicrotask(() => {
            if (workers.length === 1 && msg.id === 1)
              self.send({ type: 'loaded', ms: 900, version: 'x' });
            self.send({ type: 'running', id: msg.id, packagesMs: 0 });
            self.send({ type: 'result', id: msg.id, result: OK, runMs: 3, packagesMs: 0 });
          });
        });
        workers.push(w);
        return w;
      },
    });
    const first = await runner.run({ source: 'print("hi")' });
    expect(first).toMatchObject({ result: OK, coldStart: true, killed: false });
    expect(first.timings).toMatchObject({ bootMs: 900, runMs: 3, packagesMs: 0 });
    const second = await runner.run({ source: 'print("hi")' });
    expect(second).toMatchObject({ coldStart: false, timings: { bootMs: null } });
    expect(workers).toHaveLength(1);
  });

  it('terminates a worker stuck past the time limit and starts a fresh one next time', async () => {
    const workers: FakeWorker[] = [];
    const runner = new PythonRunner({
      killGraceMs: 500,
      createWorker: () => {
        const w = new FakeWorker((self, msg) => {
          // The first worker starts running and never answers (a C-level infinite loop).
          queueMicrotask(() => self.send({ type: 'running', id: msg.id, packagesMs: 0 }));
          if (workers.length > 1) {
            queueMicrotask(() =>
              self.send({ type: 'result', id: msg.id, result: OK, runMs: 1, packagesMs: 0 }),
            );
          }
        });
        workers.push(w);
        return w;
      },
    });
    const stuck = runner.run({ source: 'while True: pass', limits: { timeoutMs: 1000 } });
    await vi.advanceTimersByTimeAsync(1499);
    expect(workers[0].terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const outcome = await stuck;
    expect(outcome.killed).toBe(true);
    expect(outcome.result).toMatchObject({ truncated: 'time', error: { type: 'TimeoutError' } });
    expect(workers[0].terminated).toBe(true);

    const next = await runner.run({ source: 'x = 1' });
    expect(next).toMatchObject({ coldStart: true, killed: false, result: OK });
    expect(workers).toHaveLength(2);
  });

  it('a load that never finishes ends with a LoadError, not a hang', async () => {
    const runner = new PythonRunner({
      loadTimeoutMs: 10_000,
      createWorker: () => new FakeWorker(() => {}),
    });
    const pending = runner.run({ source: 'x = 1' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).result.error?.type).toBe('LoadError');
  });

  it('a fatal worker message ends the run with an InternalError and drops the worker', async () => {
    const workers: FakeWorker[] = [];
    const runner = new PythonRunner({
      createWorker: () => {
        const w = new FakeWorker((self, msg) =>
          queueMicrotask(() => self.send({ type: 'fatal', id: msg.id, message: 'boom' })),
        );
        workers.push(w);
        return w;
      },
    });
    const outcome = await runner.run({ source: 'x = 1' });
    expect(outcome.result.error).toEqual({ type: 'InternalError', message: 'boom' });
    expect(workers[0].terminated).toBe(true);
  });

  it('serializes runs', async () => {
    const order: number[] = [];
    const runner = new PythonRunner({
      createWorker: () =>
        new FakeWorker((self, msg) => {
          order.push(msg.id);
          setTimeout(() => {
            self.send({ type: 'running', id: msg.id, packagesMs: 0 });
            self.send({ type: 'result', id: msg.id, result: OK, runMs: 1, packagesMs: 0 });
          }, 100);
        }),
    });
    const a = runner.run({ source: 'a' });
    const b = runner.run({ source: 'b' });
    await vi.advanceTimersByTimeAsync(50);
    expect(order).toEqual([1]);
    await vi.advanceTimersByTimeAsync(200);
    await Promise.all([a, b]);
    expect(order).toEqual([1, 2]);
  });
});
