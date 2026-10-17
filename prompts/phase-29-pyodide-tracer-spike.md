# Phase 29: Pyodide tracer spike (decide the Python trace shape from evidence)

## Why this phase exists
Python mode runs entirely in the browser (no backend). Before any product UI, prove that a
`sys.settrace` recorder inside Pyodide, running in a Web Worker, can produce correct, bounded,
step-by-step snapshots, and decide how those snapshots map onto the SE-Viz trace format. This is a
spike in the same spirit as the tracer repo's Phase 00: evidence first, then a decision.

See `docs/PYTHON_DS_ROADMAP.md` for the fixed decisions (in-browser only, no AI, Vercel).

## Context to read
- `src/engine/trace/types.ts` (`Trace`, `Step`, `StackFrame`, `Cell`, `PointerCell`, `HeapBlock`),
  `diff.ts`, `validate.ts`, `docs/TRACE_FORMAT.md`.
- `src/components/memory/*` (how frames, heap blocks and pointer arrows render today).
- `scripts/check-bundle.mjs` (main-chunk budget).
- Python Tutor's design (public docs on its trace format) for prior art: frames of names, an
  objects area keyed by id, references as arrows, primitives inline.

## Hard constraints
- Frontend only, TS strict. `typecheck` / `lint` / `test` / `build` and `node scripts/check-bundle.mjs`
  pass. Pyodide must **never** enter the main chunk: it loads only inside the worker, on demand.
- **Exactly one new dependency: `pyodide`**, pinned to an exact version at least two weeks old
  (check `npm view pyodide time`). Runtime assets (wasm, stdlib, wheels) load from the jsDelivr CDN
  at that same exact version. Record the version and why in the report.
- No change to how existing C traces load, validate or render.
- No product UI. A dev-only debug page is allowed (reachable only when `import.meta.env.DEV`).
- No AI, no network calls other than the pinned Pyodide CDN.

## What to build
1. **Worker** `src/python/worker.ts` (module worker via `new Worker(new URL(...), { type: 'module' })`):
   loads Pyodide once, accepts `{ source, stdin, limits, packages }`, returns
   `{ steps, stdout, error?, truncated? }` as plain JSON.
2. **Recorder** `src/python/recorder.py` (imported as `?raw`): `sys.settrace` with `call`, `line`,
   `return`, `exception` events, **user code only** (compile the source with filename
   `"<student>"` and ignore other frames). Per line event, snapshot:
   - frames bottom-first (`<module>` is the global frame), each with its local names in definition
     order (skip dunders and imported modules);
   - every object reachable from those names: `list`, `tuple`, `dict`, `set`, `frozenset`, class
     instances (class name + `__dict__`), functions (name + parameters), classes (name);
   - primitives (`int`, `float`, `str`, `bool`, `None`) inline, with `repr` capped at 80 chars;
   - NumPy arrays and pandas objects as **opaque summaries** for now (type, shape, dtype), so later
     phases can extend them;
   - cumulative stdout, the event kind, and for `return` events the return value.
   **Stable object ids:** keep a strong reference to every object seen during the run so `id()` is
   never reused, and map raw ids to `o1`, `o2`, ... in first-seen order.
3. **Limits:** max steps (default 1000), max stdout lines, recursion limit, and a wall-clock limit
   enforced from the main thread by terminating and recreating the worker. `input()` reads from the
   supplied stdin lines and raises `EOFError` when they run out.
4. **Three candidate mappings** of a recorded snapshot to SE-Viz steps, each as a small pure
   function with tests:
   - **A. Reuse the C model:** names are cells (`scalar` for primitives, `pointer` targeting a heap
     block for references); every Python object is a `HeapBlock` with an additive kind tag and its
     own cells (list items indexed, dict entries as key/value pairs, instance attributes).
   - **B. Separate payload:** a new `view: 'python'` with a `python` step payload shaped like Python
     Tutor's (frames of names, objects by id), and a new renderer.
   - **C. Hybrid:** B's payload, rendered by adapting it to A's shapes at render time.
5. **Debug page:** a textarea, Run, the raw JSON, and each candidate mapping rendered through the
   existing memory canvas where possible.
6. **Measurements** (report table): cold Pyodide load, warm run, NumPy load, pandas load, and trace
   time for the sample programs below, on Leykun's Mac in Chrome if available, otherwise in the run
   environment with the machine stated.

## Sample programs (commit under `src/python/samples/`)
1. Aliasing: `a = [1, 2]; b = a; b.append(3)`.
2. Mutation through a function argument (append inside a function, caller sees it).
3. Nested containers: a dict of lists, then a list of dicts.
4. Recursion: `factorial(4)` with frames pushing and returning.
5. A class with two instances and a method that changes an attribute.
6. The DS 200 "harvest" loop (dict update inside a `for` over a list).
7. A runtime error mid-loop (`KeyError`) and a syntax error.
8. An infinite loop (must hit the step or time limit cleanly).

## Decision rule (write the outcome in `docs/PYTHON_TRACE_FORMAT.md`)
Pick the mapping that passes **all** of these, and if more than one passes, the one that adds the
fewest new renderer code paths:
1. Existing C traces and tests are byte-for-byte unaffected.
2. Aliasing is visible (two names, one object, two arrows to the same box).
3. In-place mutation diffs as a change to the same object id, not a new object.
4. `diffSteps` (or a small additive extension) yields correct "what changed" for all samples.
5. Dict keys of any hashable primitive type and nested containers render without special cases in
   the engine core.
6. There is a clear place to extend for ndarray and DataFrame views in Phases 34 and 35.
If no candidate passes all six, stop and say so in the report with the failing criteria. Do not
invent a fourth option silently.

## Tests
- Recorder (via Pyodide in node if feasible; otherwise on recorded JSON fixtures committed from the
  debug page): each sample produces the expected number of steps, stable ids, correct aliasing.
- Mapping functions: unit tests per candidate on the committed fixtures.
- Limits: infinite loop and deep recursion end with `truncated` or an error, never a hang.
- Bundle check passes with Pyodide absent from the main chunk.

## Acceptance criteria
1. Gates pass; `pyodide` is the only new dependency, exactly pinned; Pyodide is never in the main
   chunk.
2. All eight samples record correctly, including the error and the infinite loop.
3. `docs/PYTHON_TRACE_FORMAT.md` states the chosen mapping, the evidence for each criterion, and
   the exact additive type changes Phase 30 must make.
4. Measurements table is filled in.
5. Nothing user-facing changed outside the dev-only debug page.

## When done
Write `reports/phase-29-pyodide-tracer-spike.md` from the template. Work on branch
`phase-29-pyodide-tracer-spike`. **Stop without merging** (unless running under
`prompts/RUNNER-ds-python.md`, which defines the merge rule).
