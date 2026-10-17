/**
 * Main-thread side of the Python worker (Phase 29 spike): creates the worker on demand, sends one
 * run at a time, and enforces the wall-clock limit by **terminating and recreating** the worker.
 *
 * The clock starts when the worker reports `running` (Pyodide and the requested packages loaded),
 * so a slow first load never counts against the student's program. A separate, generous
 * `loadTimeoutMs` covers a load that never finishes.
 *
 * @packageDocumentation
 */
import {
  KILL_GRACE_MS,
  resolveLimits,
  type RunRequest,
  type RunResult,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol.ts';

/** The slice of `Worker` the client uses (a fake in tests). */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface RunTimings {
  /** Pyodide load time, when this run started a fresh worker; otherwise `null`. */
  bootMs: number | null;
  /** Package loading inside the worker (`null` if the run never got that far). */
  packagesMs: number | null;
  /** Recording time inside the worker (`null` if it never answered). */
  runMs: number | null;
  /** Main-thread time from `run()` to the outcome. */
  totalMs: number;
}

export interface RunOutcome {
  result: RunResult;
  timings: RunTimings;
  /** This run created the worker (so it paid for loading Pyodide). */
  coldStart: boolean;
  /** The worker was terminated (time limit, load timeout or crash); the next run starts a new one. */
  killed: boolean;
}

export interface PythonRunnerOptions {
  createWorker?: () => WorkerLike;
  /** Kill the worker this long after `timeoutMs` if it hasn't answered. */
  killGraceMs?: number;
  /** Give up on loading Pyodide and packages after this long. */
  loadTimeoutMs?: number;
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

function failed(type: string, message: string, truncated?: 'time'): RunResult {
  return { steps: [], stdout: '', error: { type, message }, ...(truncated ? { truncated } : {}) };
}

export class PythonRunner {
  private worker: WorkerLike | null = null;
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly createWorker: () => WorkerLike;
  private readonly killGraceMs: number;
  private readonly loadTimeoutMs: number;
  /** Load time reported by the current worker, consumed by the run that created it. */
  private pendingBootMs: number | null = null;

  constructor(options: PythonRunnerOptions = {}) {
    this.createWorker = options.createWorker ?? defaultWorker;
    this.killGraceMs = options.killGraceMs ?? KILL_GRACE_MS;
    this.loadTimeoutMs = options.loadTimeoutMs ?? 120_000;
  }

  /** Queue a run. Runs never overlap. */
  run(request: RunRequest): Promise<RunOutcome> {
    const next = this.queue.then(() => this.runNow(request));
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Terminate the worker (if any). The next run loads Pyodide again. */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private runNow(request: RunRequest): Promise<RunOutcome> {
    const started = performance.now();
    const coldStart = this.worker === null;
    const worker = this.worker ?? this.createWorker();
    this.worker = worker;
    const id = this.nextId++;
    const limits = resolveLimits(request.limits);

    return new Promise<RunOutcome>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let packagesMs: number | null = null;
      const arm = (ms: number, onFire: () => void) => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(onFire, ms);
      };
      const finish = (result: RunResult, runMs: number | null, killed: boolean) => {
        if (timer !== null) clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        if (killed) {
          worker.terminate();
          if (this.worker === worker) this.worker = null;
        }
        const bootMs = coldStart ? this.pendingBootMs : null;
        if (coldStart) this.pendingBootMs = null;
        resolve({
          result,
          timings: { bootMs, packagesMs, runMs, totalMs: performance.now() - started },
          coldStart,
          killed,
        });
      };

      worker.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === 'loaded') {
          this.pendingBootMs = msg.ms;
          return;
        }
        if (msg.id !== id) return;
        if (msg.type === 'running') {
          packagesMs = msg.packagesMs;
          arm(limits.timeoutMs + this.killGraceMs, () =>
            finish(
              failed(
                'TimeoutError',
                `Stopped after ${limits.timeoutMs / 1000} s: the time limit was reached.`,
                'time',
              ),
              null,
              true,
            ),
          );
        } else if (msg.type === 'result') {
          packagesMs = msg.packagesMs;
          finish(msg.result, msg.runMs, false);
        } else {
          finish(failed('InternalError', msg.message), null, true);
        }
      };
      worker.onerror = (event) => {
        finish(failed('InternalError', event.message || 'The Python worker crashed.'), null, true);
      };

      arm(this.loadTimeoutMs, () =>
        finish(failed('LoadError', 'Python did not finish loading in time.'), null, true),
      );
      worker.postMessage({ type: 'run', id, request });
    });
  }
}
