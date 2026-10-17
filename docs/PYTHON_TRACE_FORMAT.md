# Python trace format (decided in Phase 29)

Status: decided 2026-10-17 by the Phase 29 spike. Phases 30 and later build on this file. The
evidence lives in `src/python/mappings/candidates.test.ts` and `src/python/recorder.test.ts`, which
run on the committed fixtures in `src/python/fixtures/`. The measurements are in
`reports/phase-29-pyodide-tracer-spike.md`.

## Decision

**Candidate A, "reuse the C model".** A Python run maps onto ordinary SE-Viz `Step`s:

- **Names are cells.** A primitive is a `scalar` cell whose value is its `repr`. A reference is a
  `pointer` cell whose `target` is the object's stable id.
- **Every Python object is a `HeapBlock`.** Its id is the object's stable id (`o1`, `o2`, ...). It
  carries one additive tag, `objectKind`, and holds its own cells.

So the existing pieces consume Python unchanged:

- the memory canvas (with arrows, the value pulse and frame springs);
- `diffSteps`, `validateTrace` and the explanation panel;
- the timeline.

Candidate **C also passes all six criteria** but loses the tie-break: it adds an adapter path in every
consumer. Candidate **B fails criterion 4**.

| # | Criterion | A: reuse C model | B: separate payload | C: hybrid |
|---|-----------|------------------|---------------------|-----------|
| 1 | Existing C traces and tests byte-for-byte unaffected | **Pass** | Pass | Pass |
| 2 | Aliasing visible (two names, one object, two arrows) | **Pass** | Pass only with a new renderer and arrow overlay (not built) | Pass |
| 3 | In-place mutation diffs as a change to the same object id | **Pass** | Ids are stable in the payload, but `diffSteps` sees nothing | Pass |
| 4 | `diffSteps` (or a small additive extension) gives the right "what changed" for all samples | **Pass** | **Fail** | Pass, if every consumer adapts first |
| 5 | Any primitive dict key and nested containers, with no special cases in the engine core | **Pass** | Pass (in its own renderer) | Pass |
| 6 | Clear place to extend for ndarray and DataFrame (Phases 34 and 35) | **Pass** | Pass | Pass |
| | New renderer code paths | **None** (presentation tweaks keyed on `objectKind`, below) | A whole new renderer, arrow overlay and diff | An adapter call in each `Step` consumer |

## Evidence per criterion

The test names below are in `src/python/mappings/candidates.test.ts`.

### 1. C traces unaffected

- This phase changes nothing under `src/engine/` or `src/components/`. Every pre-existing test
  passes unchanged.
- A's output validates with the **unchanged** `validateTrace` for all eight samples plus three extra
  programs. See "criterion 1 … A and C validate with the unchanged validator".
- A only adds keys that `HeapBlock` already has, plus `objectKind` ("A only adds the optional
  objectKind tag").
- Phase 30's type changes (below) are optional fields and a widened union. C traces never set them.

### 2. Aliasing

- On the final step of `aliasing.py`, `pointersByTarget(step).get('o1')` is `['a', 'b']`. That is
  what `ArrowOverlay` draws: two arrows into one block.
- The same holds through C's adapter.
- B's steps have empty `stack` and `heap`, so `pointersByTarget` is empty. B would need its own arrow
  drawing.
- Screenshot: `reports/assets/phase29-debug-aliasing.png`.

### 3. In-place mutation

- `b.append(3)` diffs as `cellsAdded: ['o1[2]']`. There are no removed cells and no retargets, and
  the heap ids are identical before and after.
- `red.drive(3)` diffs as `valuesChanged: [{ id: 'o3.fuel', from: '100', to: '70' }]`.
- For B, `diffSteps` reports nothing at all.

### 4. "What changed" for every sample

There is one test per sample under "criterion 4". C's adapted steps are `toEqual` A's steps for
every fixture.

| Sample | What `diffSteps` reports |
|--------|--------------------------|
| aliasing | Line 1: `f1.a` plus the list cells. Line 2: `f1.b`. Line 3: `o1[2]`. |
| mutation through an argument | The call step pushes `add_crop`. The return step adds `f2.return` and `o2[1]` (the caller's list). The next step pops `f2`. |
| nested containers | `o3[0]` is added (the inner list). `o6['kind']` changes `'goat'` → `'sheep'`. |
| recursion | Pushes `f1` to `f5`, pops `f5` to `f2`. Return values are `f5.return` = 1, `f4.return` = 2, `f3.return` = 6, `f2.return` = 24. |
| class instances | Each `__init__` call adds `self`, `name` and `fuel`. Blocks `o2` (class), `o3` and `o4` persist. |
| harvest | `o2['corn']` changes 1 → 2 → 3. `o2['wheat']` and `o2['beans']` are added. The Phase 28 explanation panel already prints `'corn' in dict: 1 → 2` (`explainBeat`). |
| runtime error | `f1.item` changes `'wheat'` → `'beans'`. Then the "Line 5 raised KeyError" step changes nothing, which is correct. |
| infinite loop | Exactly one value change, `f1.day`, per assignment. |
| syntax error | No steps. The error is in `RunResult.error`. |

**Known gap (none of the samples hit it):** a name rebound across kinds, such as `x = 1` then
`x = [x]`, keeps its cell id `f1.x`. Its kind changes from `scalar` to `pointer`, and `diffSteps`
reports neither a value change nor a retarget. The test "known gap beyond the samples" pins this.
Phase 30 closes it with the small additive diff field below.

### 5. Dict keys and nesting

- Fixture `extra-dict-keys` has keys `1`, `2.5`, `'corn'`, `False`, `None` and `(1, 2)`. They name
  the dict's cells as `1`, `2.5`, `'corn'`, `False`, `None` and `(1, 2)`; the key's `repr` is the cell
  name.
- Nested values are pointer cells.
- `validateTrace` passes and ids are unique.
- The mapping has no per-type branches. A non-primitive key is named by a compact label (`(1, 2)`)
  and identified by `#<id>`.

### 6. ndarray and DataFrame

- NumPy and pandas objects arrive as `kind: 'summary'` objects: type, shape and dtype.
- In A they become **one block tagged `objectKind: 'summary'`**, shared by every reference.
- The extension point is clear: Phases 34 and 35 add `objectKind: 'ndarray'` / `'dataframe'` (or
  replace the summary). They then give those blocks real cells, and add a per-kind body in
  `HeapBlockView`. Element-level cells (`o3[1,2]`) get value pulses and "what changed" from
  `diffSteps` for free.
- Shown on an offline stand-in (`extra-summary`) and on real NumPy 2.4.6 / pandas 3.0.2
  (`packages-numpy-pandas`, recorded by `npm run py:record-packages`):

  | Block | Shape | dtype |
  |-------|-------|-------|
  | `numpy ndarray` | `(2, 3)` | `float64` |
  | `numpy float64` | `()` | `float64` |
  | `pandas DataFrame` | `(2, 2)` | `str, int64` |
  | `pandas Series` | `(2,)` | `int64` |

## Exact additive type changes for Phase 30

All three are additive, and C traces are unaffected because they never set the new fields.

```ts
// src/engine/trace/types.ts

/** Supported source languages. */
export type TraceLanguage = 'c' | 'python'; // was: 'c'

/**
 * The Python object a heap block shows (Phase 30, additive). Present only on Python traces; a block
 * with `objectKind` renders as a Python object (no allocation-state badge), not as a malloc block.
 */
export type PyObjectKind =
  | 'list'
  | 'tuple'
  | 'set'
  | 'frozenset'
  | 'dict'
  | 'instance'
  | 'function'
  | 'class'
  | 'summary' // NumPy / pandas, until Phases 34–35 add 'ndarray' / 'dataframe' / 'series'
  | 'other';

export interface HeapBlock {
  // ...existing fields unchanged...
  /** Python object kind (Phase 30, additive). Absent on C traces. */
  objectKind?: PyObjectKind;
}
```

```ts
// src/engine/trace/diff.ts — closes the kind-change gap

export interface StepDiff {
  // ...existing fields unchanged...
  /**
   * Cells present in both steps whose kind changed (a Python name rebound from a primitive to a
   * reference or back). Always empty for C traces, whose cells never change kind.
   */
  kindsChanged: { id: CellId; from: Cell; to: Cell }[];
}
// In diffSteps' loop over cells present in both steps:
//   if (cell.kind !== before.kind) kindsChanged.push({ id, from: before, to: cell });
```

`objectKind` is already produced, in exactly this form, by `src/python/mappings/memory.ts`
(`PyHeapBlock`). Phase 30 moves `PyObjectKind` into `types.ts` and drops the spike-local intersection
type.

### Renderer adjustments Phase 30 needs (presentation only, no new renderer)

All of these key on `trace.language === 'python'` or on `block.objectKind`:

- **`HeapBlockView`:** when `objectKind` is set, show the kind (or the label) instead of the
  `✓ allocated` badge.
- **`MemoryCanvas`:** the region captions say "Heap · malloc / free". Python needs
  "Objects · references point here" (or similar). "Stack" can stay "Frames".
- **`labels.ts` `functionParams` / `frameLabel`:** these parse **C** signatures, so Python frames
  read `factorial()` (see the recursion screenshot). Python needs `factorial(n=2)` from the frame's
  own parameter cells (`PyFunction.params` gives the names).
- **`CodePanel`:** syntax highlighting is C (`lang-cpp`). Python highlighting arrives with Phase 31's
  editor.
- **`explain.ts`:** it reports new variables in an existing frame, but not cells added *inside an
  existing block*. On `b.append(3)`, "What changed" is empty even though `diffSteps` has
  `cellsAdded: ['o1[2]']`. This is a Phase 32 (derived explanations) item: add a row such as "item
  added to list".

## How a run becomes steps (shared by every candidate)

`src/python/mappings/plan.ts` builds the steps.

- **Snapshots are taken on all four events** (`call`, `line`, `return`, `exception`) in user code.
- **A `line` event fires before its line runs**, but an SE-Viz step is the state **after** its
  highlighted line ran (Phase 16 beats). So step *k* shows snapshot *i* and highlights the line that
  ran between snapshots *i − 1* and *i*:
  - after a `return` event: the caller's current line (the call site);
  - otherwise: the previous event's line.
- **A snapshot directly after a `call` event makes no step,** because nothing ran in between.
- **Edge cases:** a single snapshot is the only step, and zero snapshots (a syntax error) give zero
  steps.
- **Ids:**
  - Frame ids are `f1`, `f2`, ... (one per activation) and become `StackFrame.id`.
  - `callId` counts activations per function name.
  - `activeId` is the top frame.
- **Return values:** the returning frame gets a `return` cell (`f3.return`), as in Python Tutor. A
  frame exiting because of an exception has `unwinding: true` and no `return` cell.
- **`Step.stdout`** is the cumulative stdout, split into lines.
- **The narration** starts as a plain placeholder ("Line 4 calls factorial(n=3).", "factorial returns
  2.", "Line 5 raised KeyError: 'beans'"). Since Phase 32 `recordingToTrace` replaces it with a
  derived one-line summary wherever one can be derived (see "Statement facts" below).

### Cell ids (stable across steps for the same logical slot)

| Slot | Cell id | Cell name |
|------|---------|-----------|
| A name in frame `f2` | `f2.n` | `n` |
| A frame's return value | `f2.return` | `return` |
| List / tuple item *i* of `o1` | `o1[0]` | `0` |
| Dict entry, primitive key | `o2['corn']` (key `repr`) | `'corn'` |
| Dict entry, reference key | `o2[#o5]` | `(1, 2)` or `tuple o5` |
| Set member | `o4{'a'}` / `o4{#o7}` | (empty) |
| Instance attribute | `o3.fuel` | `fuel` |
| Summary | `o6.shape`, `o6.dtype` | `shape`, `dtype` |
| NumPy array element (Phase 34) | `o3[1,2]` | `1, 2` |
| Other object | `o8.repr` | `repr` |
| Items beyond the container cap | `o1[…]` | `…` (value `"N more"`) |

**List item ids are positional.** `insert(0, x)` therefore shows as value changes on every shifted
index plus one added cell, as Python Tutor does.

**Scalar `type`:** a scalar cell's `type` is the Python type name (`int`, `str`, `NoneType`). A
pointer cell's `type` is the target object's type name.

**A reference past `maxObjects`** becomes a pointer with `target: null` and `display: '…'`.

## Raw recorder snapshot (what the worker returns)

TypeScript: `src/python/protocol.ts`. Python: `src/python/recorder.py`.

```ts
interface RunResult {
  steps: PySnapshot[];
  stdout: string; // final cumulative stdout
  error?: {
    type: string; // e.g. 'KeyError', 'SyntaxError', 'RecursionError', 'TimeoutError', 'InternalError'
    message: string;
    line?: number;
    offset?: number;
    traceback?: string; // user frames only
  };
  truncated?: 'steps' | 'stdout' | 'time' | 'size'; // 'size' since Phase 31
}

interface PySnapshot {
  event: 'call' | 'line' | 'return' | 'exception';
  // Phase 32 (additive): stmt? (line events), call? (call events), function? / yielded? (returns)
  line: number; // line of the frame the event is in (for 'line': about to run)
  frames: PyFrame[]; // user frames only, bottom-first; frames[0] is <module>
  objects: Record<string, PyObject>; // everything reachable this step, first-reached order
  objectsOmitted?: number; // refs past maxObjects (no entry in `objects`)
  stdout: string; // cumulative
  returnValue?: PyValue; // 'return' of a function that returned normally
  unwinding?: true; // 'return' while an exception propagates
  exception?: { type: string; message: string }; // 'exception' events
}

interface PyFrame {
  id: string; // 'f1', 'f2', … one per activation
  name: string; // co_name: '<module>', 'factorial', a class name for class bodies
  line: number;
  vars: { name: string; value: PyValue }[]; // first-seen order; no dunders, '.0' names or modules
}

type PyValue =
  | { kind: 'prim'; type: 'int' | 'float' | 'str' | 'bool' | 'NoneType'; repr: string; truncated?: true } // repr ≤ 80 chars
  | { kind: 'ref'; id: string }; // 'o1', 'o2', … first-seen order, never reused within a run

type PyObject = { type: string } & ( // type(obj).__name__
  | { kind: 'list' | 'tuple' | 'set' | 'frozenset'; items: PyValue[]; omitted?: number } // sets sorted
  | { kind: 'dict'; entries: { key: PyValue; value: PyValue }[]; omitted?: number }
  | { kind: 'instance'; attrs: { name: string; value: PyValue }[] } // __dict__, no dunders
  | { kind: 'function'; name: string; params: string[] } // e.g. ['a', '*rest', 'k', '**kw']
  | { kind: 'class'; name: string }
  | { kind: 'summary'; library: 'numpy' | 'pandas'; shape: number[]; dtype: string }
  | PyNdarray // Phase 34, see "NumPy arrays"
  | { kind: 'other'; repr: string }
);
```

Recorder rules that the shape relies on:

- **Only `"<student>"` frames are traced.** The source is compiled with that filename. Stdlib,
  packages and the recorder itself are invisible.
- **Stable ids.** Every object and frame seen is kept alive (strong references) until the run ends,
  so `id()` is never reused. Raw ids map to `oN` / `fN` in first-seen order. A side effect: `__del__`
  and weak references behave as if the objects are still referenced.
- **Primitives** are exactly `int`, `float`, `str`, `bool` and `None`, shown inline. Subclasses
  such as `IntEnum` are objects.
  - A `str` longer than 80 characters is cut from its first 80 characters.
  - An `int` too long for `repr` reads `<int with N bits>`.
- **NumPy and pandas** are detected by the type's module root, without importing either package.
  - NumPy scalars, for example `np.float64`, are summaries with shape `[]`.
  - A DataFrame's `dtype` is its distinct column dtypes joined with `, `.
- **Sets and frozensets are sorted** for a stable display: naturally, or by `(type name, repr)` for
  mixed types. String hashing is randomized.
- **Return values** are recorded for functions only. A module or class body "returns" `None`, and
  that is omitted.
- **A class body is a frame,** named after the class, while the class statement runs, as in Python
  Tutor.

## Limits (`DEFAULT_LIMITS` in `protocol.ts`)

| Limit | Default | What happens |
|-------|---------|--------------|
| `maxSteps` | 1000 | The 1001st event stops the program: `truncated: 'steps'`, exactly 1000 snapshots. |
| `maxStdoutLines` | 500 | Output is kept up to that many complete lines, then the program stops: `truncated: 'stdout'`. |
| `maxDepth` | 200 | More than 200 user frames ends the run with `error.type: 'RecursionError'`. The interpreter's own limit sits 100 frames higher as a backstop. |
| `timeoutMs` | 5000 | The recorder checks the clock on every event and stops with `truncated: 'time'`. The main thread terminates the worker `timeoutMs + 1000` ms after the program started (`KILL_GRACE_MS`), for loops the tracer can't see, such as `sum(itertools.count())`. The result is then `{ steps: <the streamed snapshots>, truncated: 'time', error: TimeoutError }` (before Phase 31 the steps were always empty), and the next run starts a fresh worker. The clock starts after Pyodide and the packages have loaded. |
| `maxContainerItems` | 100 | Further items are counted in `omitted`. |
| `maxObjects` | 300 | Further objects are counted in `objectsOmitted`. Their refs stay, with no entry. |
| `maxTraceChars` | 8,000,000 | (Phase 31) Total JSON characters of all snapshots. The snapshot that would cross it is dropped and the program stops: `truncated: 'size'`. Each snapshot restates the whole visible state, so deep recursion or big containers grow a trace fast (measured: 1,626 snapshots of a 100-item list hit it). |

**Live editor limits (Phase 31, `src/python/live/limits.ts`).** The Python live editor sends
`maxSteps` (default 1000, 10–5000), `timeoutMs` (default 10 s, 1–30 s), `maxStdoutLines` (default 500,
10–2000), and a fixed `maxDepth: 100`. At 100 frames the deep-recursion run is 200 snapshots and
1.26 M characters of JSON (it was 400 snapshots and 4.97 M at the default 200).

**Streaming (Phase 31).** The recorder serializes each snapshot as it is taken (the final result is
joined from those strings, so nothing is serialized twice) and, when the host passes `on_chunk`, hands
it over at once. The worker posts each as a `steps` message. The main thread keeps them and uses them
only when there is no `result`: a run killed at the time limit or stopped with **Stop** keeps every
step recorded so far. When the recorder stops a program it sends a last, empty chunk carrying the
reason (`steps`, `time`, `size`, `stdout`, `depth`). If the worker still has to be killed afterwards,
the program caught the stop (see below), and the outcome says so (`RunOutcome.recorderStop`).
Measured cost: about 5% at 5000 snapshots.

**How the recorder stops a program.** It raises a private `BaseException` from the trace function
(or from `print` for the stdout cap), so `except Exception:` can't swallow it.

A bare `except:` or `except BaseException:` *can* swallow it. Python then switches tracing off (a
trace function that raises is unset), so the program continues untraced. If it then loops forever,
the main-thread kill ends it. Since Phase 31 that run keeps its streamed steps, and the live editor
says the program caught the stop. (The swallow itself is not prevented; see the Phase 31 report.)

**Input.** `input()` reads the request's `stdin` lines in order, and echoes the prompt and the line
to stdout, as a terminal would. It raises `EOFError("EOF when reading a line")` when the lines run
out.

**Blocked imports.** Student code can't import `js`, `pyodide`, `pyodide_js`, `_pyodide`, `micropip`
or `pyodide_http`. These are the bridges to the JS host and the network; any of them raises
`ImportError`. Packages can only be requested by name from an allow-list (`numpy`, `pandas`,
`matplotlib`, `scipy`), never by URL. The worker imports them once, untraced, before the program
runs.

## Runtime

- **Pyodide `314.0.7`** (Python 3.14.2) is pinned exactly in `package.json`.
- **The worker bundles the npm loader.** Wasm, the standard library and wheels load from
  `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`.
- **`src/python/version.ts`** holds the version, and a test checks that it equals the npm pin and the
  runtime's `pyodide.version`.
- **The worker** is `src/python/worker.ts`, an ES module worker (`vite.config.ts`
  `worker.format: 'es'`; `optimizeDeps.exclude: ['pyodide']`). It is created only by `PythonRunner`
  in `src/python/client.ts`.
- **Production ships Python live coding (Phase 31).** The lazy `PythonLiveView` chunk creates the
  worker through a module-level `PythonRunner` (`src/python/live/runner.ts`), so the loaded runtime
  and packages survive leaving and re-entering the mode. `scripts/check-bundle.mjs` fails if Pyodide
  markers reach the main chunk, if the main chunk names the worker chunk, or if no worker chunk
  exists.
- **Worker messages (Phase 31 additions, `protocol.ts`).** In: `{ type: 'load' }` preloads Pyodide
  (the mode sends it when it opens). Out: `packages` (allow-listed packages being loaded for a run;
  only ones not loaded before), `running` now carries `loaded` (every allow-listed package the
  worker has), and `steps` (streamed snapshots). The worker loads the union of the request's
  `packages` and what Pyodide's `find_imports` finds in the source (the detector
  `loadPackagesFromImports` uses), restricted to the allow-list, and imports each once per worker,
  untraced; matplotlib gets the `Agg` backend.

## Statement facts (Phase 32, additive)

The recorder parses the program once with Python's `ast` and adds, without changing any existing
field (every Phase 29 / 30 fixture is the same apart from these keys):

| Snapshot field | When | What |
|----------------|------|------|
| `stmt` | the **first** `line` event that runs a line, in a frame of its own scope | The statement starting on that line (`PyStatement` in `src/engine/trace/types.ts`). Later line events for the same line omit it. Never sent from a generator expression, comprehension or lambda frame (their line is the enclosing statement's). |
| `call` | `call` events | `{ function: co_qualname, args: [{ name, value }], scope, resumed? }`. `scope` is `function`, `generator`, `coroutine`, `class` (a class body), `lambda` or `comprehension`; `resumed` marks a generator resuming. `args` are the parameters bound at the call (the hidden `.0` iterator of a generator expression is skipped). |
| `function` | `return` events | `co_qualname` of the frame returning (`Tractor.drive`, `<module>`). |
| `yielded` | `return` events | The frame is a generator suspended at `yield` (it will resume), not finishing. |

**`PyStatement`.** `kind` is one of `Assign`, `AugAssign`, `AnnAssign`, `If`, `Elif`, `For`, `While`,
`Return`, `Expr`, `Import`, `FunctionDef`, `ClassDef`, `Try`, `Except` (an `except` clause header: Python
runs a line event there to test the exception), `Raise`, `Pass`, `Break`, `Continue`, `With`, `Delete`,
`Global`, `Nonlocal`, `Assert`, `Other` (with the `ast` class name) or `Multiple` (a line that starts
more than one statement — `a = 1; b = 2`, `if x: y = 1` — about which nothing more is said). Every
statement has `line` and `end`. By kind:

- assignments: `targets` / `target`, `value`, `op` (`AugAssign`), `annotation` (`AnnAssign`);
- `If` / `Elif` / `While`: `test` and `body` (`{ first, last }`); `For`: `target`, `iter`, `body`;
  each may have `orelse: { kind: 'elif' | 'else', line, first, last }`. **There is no `Else`
  statement:** an `else:` line never gets a line event, so it appears only as `orelse`;
- `Try`: `body`, `handlers: [{ line, type, first, last }]`, `orelse`, `finalbody: { line, first, last }`;
  `Except`: `type` (as written, or `null` for a bare `except:`), `name`, `body`;
- `Return` / `Raise`: `value?`; `Expr`: `value`; `Import`: `names`, `module?`; `FunctionDef`: `name`,
  `params` (with `*` / `**`); `ClassDef`: `name`; `With`: `body`; `Delete`: `targets`; `Global` /
  `Nonlocal`: `names`; `Assert`: `test`.

Expressions (`PyExpr`) keep only what the explanation can use: `name`, `const` (`repr`),
`subscript`, `attribute`, `binop`, `unary`, `compare`, `boolop`, `call` (positional `args`,
`keywords` names), `display` (`tuple` / `list` / `set` / `dict`, with `items` for a short tuple or
list), `comprehension`, `fstring`, `yield`, and `other`. Each carries `src`, its text as written, when
it is on one line and at most 80 characters (a name's text is its `id`; a constant written as its
`repr` has no separate `src`). Nesting deeper than six levels becomes `other`.

**In the trace.** `recordingToTrace` collects the `stmt` facts into `Trace.statements` (keyed by line)
and gives every step `py: PyStepInfo` (the event, the line the snapshot was taken at, and the call /
return / exception facts). See `docs/TRACE_FORMAT.md`, "Phase 32 additions", for how the explanation
panel uses them. A run killed mid-way keeps its facts: they travel inside the streamed snapshots.

**Size.** Facts are sent once per line, so they cost about 100–400 characters per distinct line that
runs (the size-budget test's 100-item list loop now fits 12 snapshots in 60,000 characters).

**Recorder fix (Phase 32).** While a comprehension inlined at module level runs (Python 3.12+), the
module frame's `f_locals` holds only the comprehension's own names. The recorder now shows the
globals plus those names, instead of every global name disappearing for the comprehension's steps.
No Phase 29 sample has a module-level comprehension, so no committed fixture changed because of it.


## NumPy arrays (Phase 34, additive)

Phase 34 replaces the NumPy summary with a real array view. Everything here is additive: no field
of an existing snapshot changed meaning, pandas objects are still summaries, and a program that
doesn't use NumPy records exactly as before (one exception, below).

**Raw snapshot.** A `numpy.ndarray` (exactly that type; subclasses such as masked arrays and
matrices stay summaries) whose dtype kind is bool, int, uint, float or unicode str is a new object
kind:

```ts
interface PyNdarray {
  kind: 'ndarray'; library: 'numpy'; type: 'ndarray';
  shape: number[]; dtype: string; ndim: number;
  values: PyPrim[];   // the first NDARRAY_CAP (200) elements, flat, in C order (row by row)
  omitted?: number;   // elements past the cap
  owndata: boolean;   // arr.flags.owndata
  base?: PyValue;     // arr.base, when not None (a ref: it is recorded like any reachable object)
  layout?: { offset: number; strides: number[]; itemsize: number };
}
```

- **`layout`** places the elements in the memory of the array that owns them: the end of the
  `base` chain (NumPy usually collapses it to the owner already). `offset` is bytes from the owner's
  first element (`arr.__array_interface__['data'][0]` minus the owner's), `strides` and `itemsize`
  are NumPy's. Element `(i, j, …)` is at `offset + i·strides[0] + j·strides[1] + …`. Absent when the
  base isn't an ndarray (`np.frombuffer(b)`).
- **Other dtypes** (complex, datetime, bytes, object, structured) keep `kind: 'summary'`. So does an
  ndarray-like the recorder can't read (it falls back rather than stopping the program).
- **NumPy scalars** (`np.int64(3)`, `np.float64(2.5)`, `np.bool_`, `np.str_`) are primitives:
  `{ kind: 'prim', type, repr, dtype }`, where `type` / `repr` are of `.item()` and `dtype` is the
  NumPy dtype. Before Phase 34 they were summaries with shape `()`. Scalars whose `.item()` is not
  a primitive stay summaries.
- **Pyodide is 32-bit WebAssembly:** NumPy's default integer there is `int32`, not the `int64` of
  a 64-bit desktop. The recordings show what the browser runs.

**Statement facts.** Three additions to `PyExpr`, for NumPy indexing and aggregation:

- `subscript` keeps a **slice** index (`a[1:4]` → `index: { type: 'slice', lower, upper }`, parts
  left out in the code absent) and a **tuple** index (`m[0, 1]`, `m[:, 1]` → a tuple `display`
  whose items may be slices). Both were `{ type: 'other' }` before. This is the one change to
  existing recordings: `extra-dict-keys.json`'s `inventory[(1, 2)] = …` target is now a subscript
  with a tuple index instead of `other`. (It is not a golden; the explanation can now pick the
  dict-store concept for that line instead of the generic assignment one.)
- `call` gains `kwargs: [{ name, value }]` next to `keywords` (`m.sum(axis=0)`).

**Mapping.** The array is a `HeapBlock` with `objectKind: 'ndarray'` and `ndarray` facts
(`shape`, `dtype`, `size`, `ownsData`, `base` — `null` when the base wasn't recorded —, `layout`).

| Slot | Cell id | Cell name | Cell type / value |
|------|---------|-----------|-------------------|
| Element `(1, 2)` of `o3` | `o3[1,2]` | `1, 2` | the dtype / the element's `repr` |
| The single element of a 0-d array | `o3[()]` | `()` | |
| Elements past the cap | `o3[…]` | `…` | `omitted` / `N more` |
| A NumPy scalar in a name | `f1.x` | `x` | `np.int32` / `20` |

**Recording the samples.** NumPy isn't in the npm package, so `npm run py:record-packages` (opt-in,
network: the pinned Pyodide CDN only) records `src/python/samples/numpy/*.py` into
`src/python/fixtures/numpy/*.json`, and re-records `packages-numpy-pandas.json`. `npm test` reads
those files offline; the stand-in program `extra-ndarray-standin` exercises the recorder's ndarray
path (cap, base, layout, scalars) offline on every run.


## pandas tables (Phase 35, additive)

Phase 35 replaces the pandas summary of a `DataFrame`, `Series` and `DataFrameGroupBy` /
`SeriesGroupBy` (detected by class name and module, subclasses included) with a captured table.
Other pandas objects (an `Index`, a `Categorical`) stay summaries, and so does a table the recorder
can't read (it falls back rather than stopping the program). Programs without pandas record exactly
as before.

**Caps** (`protocol.ts`, checked against `recorder.py` by a test): `TABLE_ROWS = 20` rows and
`TABLE_COLS = 12` columns per table (the true shape is always recorded), `TABLE_REPR_CAP = 40`
characters per cell, `GROUPS_CAP = 20` groups per GroupBy and `GROUP_ROWS = 3` rows per group.

```ts
interface PyCell { repr: string; type: string; truncated?: true }
// A primitive's (or NumPy scalar's, via .item()) repr; anything else's str, as pandas prints it.
// Missing values read 'nan', 'None', '<NA>' or 'NaT'. Cells are text: never references.

interface PyTableColumn { label: PyCell; dtype: string; missing: number } // missing: whole column

interface PyDataFrame {
  kind: 'dataframe'; library: 'pandas'; type: string;
  shape: number[];                  // [rows, columns]
  columns: PyTableColumn[];         // the first 12
  columnsOmitted?: number;
  index: PyCell[];                  // labels of the first 20 rows
  indexName?: string;               // repr of df.index.name, when set
  rows: PyCell[][];                 // rows × captured columns
  rowsOmitted?: number;
}
interface PySeries {
  kind: 'series'; library: 'pandas'; type: string;
  length: number; dtype: string; name: PyCell | null; missing: number;
  index: PyCell[]; indexName?: string; values: PyCell[]; omitted?: number;
}
interface PyGroupBy {
  kind: 'groupby'; library: 'pandas'; type: string; // DataFrameGroupBy / SeriesGroupBy
  keys: string[];                   // column names (a Series key by its name)
  ngroups: number; rowsTotal: number;
  source: PyValue;                  // gb.obj, recorded as a reference
  columns: PyTableColumn[]; columnsOmitted?: number;
  groups: { label: PyCell; size: number; index: PyCell[]; rows: PyCell[][] }[]; // gb.indices order
  groupsOmitted?: number;
}
```

- **No "derived from" id for DataFrames and Series.** The prompt asked for it "when pandas exposes it
  cheaply"; pandas 3.0.2 (copy-on-write) does not (`_cacher` and `_is_copy` are gone), so none is
  recorded. The trace reads the source from the statement instead (`derivedTables`, see
  `TRACE_FORMAT.md`). A GroupBy does expose its grouped object, `gb.obj`, recorded as `source`.
- **Cost.** One DataFrame description is about 0.4 ms in Pyodide (an `iloc` slice, `itertuples`,
  one `isna().sum()`); a GroupBy about 0.5 ms (`gb.indices` is cached by pandas).

**Mapping.** A DataFrame or Series is a `HeapBlock` with `objectKind` `'dataframe'` / `'series'` and
`table` facts; a GroupBy has `objectKind: 'groupby'` and `groupby` facts.

| Slot | Cell id | Cell name | Cell type / value |
|------|---------|-----------|-------------------|
| DataFrame value, row label `2`, column `yield_kg` | `o3.loc[2, 'yield_kg']` | `2, 'yield_kg'` | the value's Python type / its text |
| Series value labelled `'Coast'` | `o4.loc['Coast']` | `'Coast'` | as above |
| A repeated index label (the second `3`) | `o3.loc[3#2, …]` | `3#2, …` | |
| GroupBy: the grouped object | `o5.obj` | `obj` | a reference |
| GroupBy: one group's size | `o5.groups['Coast']` | `Coast` | `group size` / `7` |

**Sample data.** `src/python/data/farm.csv` is a synthetic farm dataset made up for this repo (30
plots: `plot_id`, `region`, `crop`, `rainfall_mm`, `yield_kg`, `fertilized`; two rainfall and three
yield values missing on purpose). The worker writes it into Pyodide's working directory
(`/home/pyodide`) before every run (`installSampleFiles`), so `pd.read_csv("farm.csv")` works offline
and a program that overwrote it can't change the next run. Only the worker imports it: it ships in
the worker chunk.

**Recording the samples.** `npm run py:record-packages` (opt-in, network: the pinned Pyodide CDN
only) now also records `src/python/samples/pandas/*.py` into `src/python/fixtures/pandas/*.json`,
with the sample data in place and NumPy and pandas imported first, untraced, as the worker does.
`SE_VIZ_PYODIDE_CACHE=<dir>` reuses a package cache between runs. It also re-records
`packages-numpy-pandas.json`, whose DataFrame and Series are now tables. Offline, `npm test`
exercises the recorder's pandas path with the stand-in program `extra-pandas-standin` (caps, a
missing value, a long string, 21 groups) and checks the sample file is in place with
`extra-sample-data`.
