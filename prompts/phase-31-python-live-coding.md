# Phase 31: Python live coding (fully in the browser)

## Why this phase exists
A presenter should be able to type Python in class, press Run, and step through it with the same
player. Unlike C live coding (gated on `VITE_TRACER_URL` and a VPS backend), Python live coding runs
in the learner's browser through Pyodide, so it **ships in production**.

## Context to read
- `src/components/live/LiveCodingView.tsx`, `CodeEditor.tsx`, `src/live/*` (C live coding, the
  pattern to mirror, not to change).
- `src/python/worker.ts`, `recorder.py` and `docs/PYTHON_TRACE_FORMAT.md` (Phase 29),
  the Python renderer (Phase 30), the Studio shell (Phase 28).
- `src/App.tsx` (selection ids, lazy loading), `scripts/check-bundle.mjs`.

## Hard constraints
- Frontend only, TS strict; all gates pass including the bundle check. Pyodide and the Python
  editor code are lazy: nothing of either lands in the main chunk.
- **Exactly one new dependency: `@codemirror/lang-python`**, pinned to an exact version at least two
  weeks old and compatible with the installed `@codemirror/*` packages.
- C live coding behavior, gating and UI are unchanged.
- No network calls other than the pinned Pyodide CDN (and its package wheels).
- No AI, no code sharing service, no accounts.

## What to build
1. **Entry:** a "Live coding · Python" item in the course map, always present (own selection id,
   e.g. `live-python`). The existing C entry stays gated as today.
2. **Editor:** CodeMirror with Python language support, the app's editor theme in both themes, a
   default program (the DS 200 harvest loop), and the existing editor shortcuts (Cmd/Ctrl+Enter to
   run).
3. **Run pipeline:** preload Pyodide when the mode opens (show progress), run in the worker, map with
   the Phase 30 contract, play in the normal player with the explanation panel.
   - Imports of `numpy`, `pandas`, `matplotlib` or `scipy` load those packages on demand
     (`loadPackagesFromImports`) with a visible "Loading pandas..." status.
   - Stdin box for `input()`; stdout in the console panel per step.
   - Limits: steps (default 1000, max 5000), wall clock (default 10 s), output lines. A Stop button
     terminates the worker; the next Run recreates it.
4. **Errors:** syntax errors highlight the line and show the message without a trace; runtime
   exceptions end the trace on a final step that shows the exception type, message and line;
   truncation shows "Stopped after N steps" as the last step.
5. **Persistence:** the editor text and stdin persist locally (`usePersistentState`); a Reset button
   restores the default program.

## Tests
- Run-state machine (idle, loading runtime, loading packages, running, done, error, stopped) as a
  pure reducer, like `src/live/runState.ts`.
- Error mapping from worker results to steps (syntax, runtime, truncated) on fixtures.
- Package detection from source (which imports trigger which loads).
- Bundle check: assert Pyodide and `@codemirror/lang-python` are absent from the main chunk (extend
  `scripts/check-bundle.mjs` for this, keeping its existing checks).

## Acceptance criteria
1. Gates pass; only `@codemirror/lang-python` added, exactly pinned; bundle assertions hold.
2. In a production build (`npm run build && npm run preview`), Python live coding works with no
   env vars set; C live coding stays hidden without `VITE_TRACER_URL`.
3. The eight Phase 29 samples typed into the editor behave correctly, including the error cases and
   the infinite loop (stopped cleanly, app stays responsive).
4. A program importing pandas loads it once and runs; a second run does not reload it.
5. Both themes; screenshots of editor, a running trace, and an error state in the report.

## When done
Write `reports/phase-31-python-live-coding.md` from the template. Work on branch
`phase-31-python-live-coding`. **Stop without merging** (when running under `prompts/RUNNER-ds-python.md`, follow its merge
rule instead).
