/**
 * Python run protocol (Phase 29 spike) — the plain-JSON shapes that cross the worker boundary, and
 * the raw snapshot shape `recorder.py` produces. `docs/PYTHON_TRACE_FORMAT.md` is the prose
 * contract; keep the two in sync.
 *
 * These are *recorder* types, not SE-Viz trace types: the mapping chosen in Phase 29 turns them
 * into {@link import('../engine/trace/types.ts').Step}s.
 *
 * @packageDocumentation
 */

/** Limits enforced for one run. Every field has a default ({@link DEFAULT_LIMITS}). */
export interface RunLimits {
  /** Maximum recorded snapshots. Reaching it stops the program with `truncated: 'steps'`. */
  maxSteps: number;
  /** Maximum complete stdout lines. Exceeding it stops the program with `truncated: 'stdout'`. */
  maxStdoutLines: number;
  /** Maximum simultaneous user frames. Exceeding it ends the run with a `RecursionError`. */
  maxDepth: number;
  /**
   * Wall-clock budget for the program, in ms (package loading excluded). The recorder stops itself
   * with `truncated: 'time'` when it notices; the main thread terminates the worker
   * {@link KILL_GRACE_MS} later if the program is stuck where the recorder can't see it.
   */
  timeoutMs: number;
  /** Items recorded per container (list, tuple, set, dict, instance attributes); the rest are counted. */
  maxContainerItems: number;
  /** Objects recorded per snapshot; references beyond it stay as refs with no object entry. */
  maxObjects: number;
}

export const DEFAULT_LIMITS: RunLimits = {
  maxSteps: 1000,
  maxStdoutLines: 500,
  maxDepth: 200,
  timeoutMs: 5000,
  maxContainerItems: 100,
  maxObjects: 300,
};

/** Grace after `timeoutMs` before the main thread kills a worker that hasn't answered. */
export const KILL_GRACE_MS = 1000;

/** Packages a run may ask for. Names only, never URLs, so loading can't leave the pinned CDN. */
export const ALLOWED_PACKAGES = ['numpy', 'pandas', 'matplotlib', 'scipy'] as const;
export type AllowedPackage = (typeof ALLOWED_PACKAGES)[number];

/** One run, as posted to the worker. */
export interface RunRequest {
  source: string;
  /** Lines `input()` returns, in order. When they run out, `input()` raises `EOFError`. */
  stdin?: string[];
  limits?: Partial<RunLimits>;
  packages?: AllowedPackage[];
}

/** Why a run stopped early. */
export type Truncation = 'steps' | 'stdout' | 'time';

/** An error that ended the run: a syntax error, an uncaught exception, or a runner failure. */
export interface RunError {
  /** Python exception type (`KeyError`, `SyntaxError`, ...) or `TimeoutError` / `InternalError`. */
  type: string;
  message: string;
  /** 1-based line in the student source, when known. */
  line?: number;
  /** Column for syntax errors (1-based). */
  offset?: number;
  /** Traceback text restricted to user frames. */
  traceback?: string;
}

/** What a run returns. Plain JSON. */
export interface RunResult {
  steps: PySnapshot[];
  /** Final cumulative stdout. */
  stdout: string;
  error?: RunError;
  truncated?: Truncation;
}

/* ───────────────────────── Raw recorder snapshot ───────────────────────── */

/** The `sys.settrace` event a snapshot was taken on. */
export type PyEvent = 'call' | 'line' | 'return' | 'exception';

/** A primitive, inline: `int`, `float`, `str`, `bool` or `None`, as its `repr` (≤ 80 chars). */
export interface PyPrim {
  kind: 'prim';
  type: 'int' | 'float' | 'str' | 'bool' | 'NoneType';
  repr: string;
  /** Present when `repr` was cut to 80 characters (ends in `…`). */
  truncated?: true;
}

/** A reference to an entry of {@link PySnapshot.objects}, by stable id (`o1`, `o2`, ...). */
export interface PyRef {
  kind: 'ref';
  id: string;
}

export type PyValue = PyPrim | PyRef;

interface PyObjectBase {
  /** `type(obj).__name__`, e.g. `list`, `defaultdict`, `Tractor`. */
  type: string;
}

/** `list` / `tuple` / `set` / `frozenset` (and subclasses). Sets are sorted for a stable display. */
export interface PySequence extends PyObjectBase {
  kind: 'list' | 'tuple' | 'set' | 'frozenset';
  items: PyValue[];
  /** Items beyond `maxContainerItems`, not recorded. */
  omitted?: number;
}

/** `dict` (and subclasses), entries in insertion order. Keys may be any value, including refs. */
export interface PyDict extends PyObjectBase {
  kind: 'dict';
  entries: { key: PyValue; value: PyValue }[];
  omitted?: number;
}

/** An instance with a `__dict__`: its attributes in insertion order (dunders skipped). */
export interface PyInstance extends PyObjectBase {
  kind: 'instance';
  attrs: { name: string; value: PyValue }[];
}

/** A Python function or bound method: its qualified name and parameter names (`*args`, `**kw`). */
export interface PyFunction extends PyObjectBase {
  kind: 'function';
  name: string;
  params: string[];
}

/** A class object. */
export interface PyClass extends PyObjectBase {
  kind: 'class';
  name: string;
}

/**
 * NumPy / pandas objects, summarized (Phases 34 and 35 replace these with real views). `dtype` is
 * the array/Series dtype, or a DataFrame's distinct column dtypes joined with `, `.
 */
export interface PySummary extends PyObjectBase {
  kind: 'summary';
  library: 'numpy' | 'pandas';
  shape: number[];
  dtype: string;
}

/** Anything else: its `repr`, capped at 80 characters. */
export interface PyOther extends PyObjectBase {
  kind: 'other';
  repr: string;
}

export type PyObject =
  | PySequence
  | PyDict
  | PyInstance
  | PyFunction
  | PyClass
  | PySummary
  | PyOther;

/** One user frame. */
export interface PyFrame {
  /** Stable per activation: `f1`, `f2`, ... in first-seen order. */
  id: string;
  /** `co_name`: `<module>` for the global frame, else the function (or class body) name. */
  name: string;
  /** The frame's current line (1-based). */
  line: number;
  /** Local names in first-seen order; dunders, `.0`-style names and modules are skipped. */
  vars: { name: string; value: PyValue }[];
}

/** One recorded event: the complete visible state at that moment. */
export interface PySnapshot {
  event: PyEvent;
  /** Line of the frame the event happened in. For `line` events, the line about to run. */
  line: number;
  /** User frames, bottom-first: `frames[0]` is `<module>`, the last is the frame the event is in. */
  frames: PyFrame[];
  /** Every object reachable from `frames` (and `returnValue`), keyed by stable id, first-reached order. */
  objects: Record<string, PyObject>;
  /** Objects not recorded because of `maxObjects`. */
  objectsOmitted?: number;
  /** Cumulative stdout at this moment. */
  stdout: string;
  /** `return` events only, when the frame returned normally. */
  returnValue?: PyValue;
  /** `return` events only: the frame is exiting because an exception propagates through it. */
  unwinding?: true;
  /** `exception` events only. */
  exception?: { type: string; message: string };
}

/* ───────────────────────── Worker messages ───────────────────────── */

export type WorkerRequest = { type: 'run'; id: number; request: RunRequest };

export type WorkerResponse =
  /** Pyodide finished loading (once per worker). */
  | { type: 'loaded'; ms: number; version: string }
  /** Packages are loaded and the program starts now: the main thread's wall clock starts here. */
  | { type: 'running'; id: number; packagesMs: number }
  | { type: 'result'; id: number; result: RunResult; runMs: number; packagesMs: number }
  /** Pyodide failed to load, or the recorder itself crashed. */
  | { type: 'fatal'; id: number | null; message: string };

/** Merge partial limits over the defaults. */
export function resolveLimits(limits: Partial<RunLimits> | undefined): RunLimits {
  return { ...DEFAULT_LIMITS, ...limits };
}
