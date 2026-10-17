/**
 * Main-thread side of the Python worker (Phase 29 spike; preload, Stop and streamed steps from
 * Phase 31): creates the worker on demand, sends one run at a time, and enforces the wall-clock limit
 * by **terminating and recreating** the worker.
 *
 * The clock starts when the worker reports `running` (Pyodide and the requested packages loaded),
 * so a slow first load never counts against the student's program. A separate, generous
 * `loadTimeoutMs` covers a load that never finishes.
 *
 * While a program runs, the worker streams its snapshots (`steps` messages). They are only used when
 * the run doesn't end with a `result`: a run killed at the time limit, or stopped with
 * {@link PythonRunner.stop}, keeps the steps recorded so far instead of losing them.
 *
 * @packageDocumentation
 */
import {
  KILL_GRACE_MS,
  resolveLimits,
  type AllowedPackage,
  type PySnapshot,
  type RecorderStop,
  type RunRequest,
  type RunResult,
  type WorkerMessage,
  type WorkerResponse,
} from './protocol.ts';

/** The slice of `Worker` the client uses (a fake in tests). */
export interface WorkerLike {
  postMessage(message: WorkerMessage): void;
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
  /** The run was ended by {@link PythonRunner.stop} (the worker is gone too, so `killed` is set). */
  stopped: boolean;
  /**
   * Set when the recorder had already stopped the program (step limit, …) but the worker still had
   * to be killed: the program caught the stop (a bare `except:`) and kept running untraced.
   */
  recorderStop?: RecorderStop;
}

/** Progress callbacks for one run (Phase 31: the live editor's status line). */
export interface RunHooks {
  /** The worker is loading these packages (ones it hasn't loaded before). */
  onPackages?: (packages: AllowedPackage[]) => void;
  /** Pyodide and the packages are ready; the program starts now. */
  onRunning?: () => void;
  /** Snapshots recorded so far. */
  onProgress?: (snapshots: number) => void;
}

/** How a {@link PythonRunner.preload} ended. */
export type PreloadOutcome =
  | { ok: true; ms: number | null }
  | { ok: false; message: string; stopped?: boolean };

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

/** The snapshots streamed so far, parsed (only needed when a run has no `result`). */
function streamed(chunks: readonly string[]): PySnapshot[] {
  const steps: PySnapshot[] = [];
  for (const chunk of chunks) {
    for (const snap of JSON.parse(chunk) as PySnapshot[]) steps.push(snap);
  }
  return steps;
}

type Ending = 'result' | 'killed' | 'stopped';

interface ActiveRun {
  id: number;
  onMessage: (msg: WorkerResponse) => void;
  /** End the run now with a partial result built from the streamed steps. */
  end: (how: Exclude<Ending, 'result'>, error?: { type: string; message: string }) => void;
}

interface PreloadWaiter {
  resolve: (outcome: PreloadOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class PythonRunner {
  private worker: WorkerLike | null = null;
  /** The current worker reported `loaded`. */
  private booted = false;
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();
  private active: ActiveRun | null = null;
  private preloads: PreloadWaiter[] = [];
  private readonly loaded = new Set<AllowedPackage>();
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

  /** Pyodide is loaded in a live worker, so the next run starts without loading it. */
  get ready(): boolean {
    return this.worker !== null && this.booted;
  }

  /** Allow-listed packages the current worker has loaded (empty after the worker is replaced). */
  get loadedPackages(): ReadonlySet<AllowedPackage> {
    return this.loaded;
  }

  /** Queue a run. Runs never overlap. */
  run(request: RunRequest, hooks: RunHooks = {}): Promise<RunOutcome> {
    const next = this.queue.then(() => this.runNow(request, hooks));
    this.queue = next.catch(() => undefined);
    return next;
  }

  /**
   * Start loading Pyodide without running anything, so the first Run doesn't wait for it. Resolves
   * when the worker reports `loaded` (at once if it already has).
   */
  preload(): Promise<PreloadOutcome> {
    const worker = this.ensureWorker();
    if (this.booted) return Promise.resolve({ ok: true, ms: null });
    return new Promise<PreloadOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this.preloads = this.preloads.filter((p) => p.timer !== timer);
        // A run in flight has its own load timeout; only an idle stuck load is ended here.
        if (this.worker === worker && !this.booted && this.active === null) {
          this.killWorker('Python did not finish loading in time.');
        }
        resolve({ ok: false, message: 'Python did not finish loading in time.' });
      }, this.loadTimeoutMs);
      this.preloads.push({ resolve, timer });
      worker.postMessage({ type: 'load' });
    });
  }

  /**
   * Stop now: terminate the worker. A run in flight ends with the steps streamed so far
   * (`stopped: true`); a preload in flight ends with `{ ok: false, stopped: true }`. The next run
   * starts a fresh worker.
   */
  stop(): void {
    if (this.active) {
      this.active.end('stopped');
    } else if (this.worker && !this.booted) {
      this.killWorker('Stopped.', true);
    }
  }

  /** Terminate the worker (if any). The next run loads Pyodide again. */
  dispose(): void {
    if (this.active) this.active.end('stopped');
    if (this.worker) this.killWorker('Stopped.', true);
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    this.worker = worker;
    this.booted = false;
    this.loaded.clear();
    worker.onmessage = (event) => this.dispatch(worker, event.data);
    worker.onerror = (event) => {
      if (this.worker !== worker) return;
      const message = event.message || 'The Python worker crashed.';
      if (this.active) this.active.end('killed', { type: 'InternalError', message });
      else this.killWorker(message);
    };
    return worker;
  }

  /** Terminate the current worker and fail any preload waiting on it. */
  private killWorker(message: string, stopped = false): void {
    const worker = this.worker;
    this.worker = null;
    this.booted = false;
    this.loaded.clear();
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    }
    const waiting = this.preloads;
    this.preloads = [];
    for (const p of waiting) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, message, ...(stopped ? { stopped: true } : {}) });
    }
  }

  private dispatch(worker: WorkerLike, msg: WorkerResponse): void {
    if (this.worker !== worker) return;
    if (msg.type === 'loaded') {
      this.booted = true;
      this.pendingBootMs = msg.ms;
      const waiting = this.preloads;
      this.preloads = [];
      for (const p of waiting) {
        clearTimeout(p.timer);
        p.resolve({ ok: true, ms: msg.ms });
      }
      return;
    }
    if (msg.type === 'fatal' && msg.id === null) {
      // Pyodide failed to load on a preload.
      if (this.active) this.active.end('killed', { type: 'InternalError', message: msg.message });
      else this.killWorker(msg.message);
      return;
    }
    if (this.active && msg.id === this.active.id) this.active.onMessage(msg);
  }

  private runNow(request: RunRequest, hooks: RunHooks): Promise<RunOutcome> {
    const started = performance.now();
    const coldStart = !this.ready;
    const worker = this.ensureWorker();
    const id = this.nextId++;
    const limits = resolveLimits(request.limits);

    return new Promise<RunOutcome>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let packagesMs: number | null = null;
      const chunks: string[] = [];
      let recorderStop: RecorderStop | undefined;
      const arm = (ms: number, onFire: () => void) => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(onFire, ms);
      };
      const finish = (result: RunResult, runMs: number | null, how: Ending) => {
        if (timer !== null) clearTimeout(timer);
        if (this.active === active) this.active = null;
        const killed = how !== 'result';
        if (killed && this.worker === worker) this.killWorker('Stopped.', how === 'stopped');
        const bootMs = coldStart ? this.pendingBootMs : null;
        if (coldStart) this.pendingBootMs = null;
        resolve({
          result,
          timings: { bootMs, packagesMs, runMs, totalMs: performance.now() - started },
          coldStart,
          killed,
          stopped: how === 'stopped',
          ...(killed && recorderStop ? { recorderStop } : {}),
        });
      };

      const active: ActiveRun = {
        id,
        end: (how, error) => {
          const steps = streamed(chunks);
          const stdout = steps.length > 0 ? steps[steps.length - 1].stdout : '';
          finish({ steps, stdout, ...(error ? { error } : {}) }, null, how);
        },
        onMessage: (msg) => {
          if (msg.type === 'packages') {
            hooks.onPackages?.(msg.packages);
          } else if (msg.type === 'running') {
            packagesMs = msg.packagesMs;
            for (const p of msg.loaded ?? []) this.loaded.add(p);
            hooks.onRunning?.();
            arm(limits.timeoutMs + this.killGraceMs, () => {
              const steps = streamed(chunks);
              finish(
                {
                  ...failed(
                    'TimeoutError',
                    `Stopped after ${limits.timeoutMs / 1000} s: the time limit was reached.`,
                    'time',
                  ),
                  steps,
                  stdout: steps.length > 0 ? steps[steps.length - 1].stdout : '',
                },
                null,
                'killed',
              );
            });
          } else if (msg.type === 'steps') {
            if (msg.chunk !== '[]') chunks.push(msg.chunk);
            if (msg.stop) recorderStop = msg.stop;
            hooks.onProgress?.(msg.total);
          } else if (msg.type === 'result') {
            packagesMs = msg.packagesMs;
            finish(msg.result, msg.runMs, 'result');
          } else if (msg.type === 'fatal') {
            finish(failed('InternalError', msg.message), null, 'killed');
          }
        },
      };
      this.active = active;

      arm(this.loadTimeoutMs, () =>
        finish(failed('LoadError', 'Python did not finish loading in time.'), null, 'killed'),
      );
      worker.postMessage({ type: 'run', id, request });
    });
  }
}
