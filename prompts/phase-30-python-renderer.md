# Phase 30: Python trace contract and renderer (with diff motion)

## Why this phase exists
Phase 29 recorded Python execution in the browser and chose a trace mapping in
`docs/PYTHON_TRACE_FORMAT.md`. This phase makes that mapping the real contract and renders Python
traces in the Studio shell (Phase 28), with Manim-style motion that comes from animating the
difference between adjacent steps, reversed on step back.

## Context to read
- `docs/PYTHON_TRACE_FORMAT.md` and `reports/phase-29-pyodide-tracer-spike.md` (the decision and
  the exact type changes it requires). **That document is binding.** If it conflicts with this
  prompt on data shapes, the document wins; note the conflict in the report.
- `reports/phase-28-studio-shell.md` (the shell, explanation panel, `Step.explain`).
- `src/engine/trace/types.ts`, `diff.ts`, `beats.ts`, `validate.ts`, `pulse.test.ts`.
- `src/components/memory/*`, `src/components/CodePanel.tsx`, `src/engine/highlightC.ts`.
- `src/content/catalog.ts`, `src/content/module.ts`, `docs/CONTENT_AUTHORING.md`.

## Hard constraints
- Frontend only, TS strict; all gates pass, including `node scripts/check-bundle.mjs`.
- **No new dependencies.** Motion uses `framer-motion` (already installed).
- Trace changes are **additive**: `TraceLanguage` gains `'python'`; anything else exactly as
  `docs/PYTHON_TRACE_FORMAT.md` specifies. Every C trace and snapshot is unchanged.
- Both themes; tokens only. Respect `prefers-reduced-motion` (instant transitions).
- Pyodide is not needed to *render*: recorded traces are plain JSON. Do not load Pyodide in this
  phase except from the Phase 29 debug page.

## What to build
1. **Contract:** the additive types, validation rules in `validate.ts` (stable ids, every reference
   resolves, step indices), and documentation in `docs/TRACE_FORMAT.md` (a Python section).
2. **Static highlighting:** `src/engine/highlightPython.ts` (keywords, builtins, strings incl.
   f-strings, numbers, comments, decorators), same token classes as `highlightC.ts`, with tests.
3. **Renderer** in the stage's memory panel for `language: 'python'`:
   - **Frames:** "Global frame" plus one box per active function call, names in order, primitives
     inline, references as arrows.
   - **Objects area:** list (indexed cells), tuple (indexed, visually immutable), dict (key and
     value rows), set (unordered chips), instance (class name, attribute rows), function (name and
     parameters), class (name). Opaque summaries for ndarray and DataFrame (type, shape, dtype) as
     placeholders for Phases 34 and 35.
   - **Layout:** objects ordered by first appearance; an object referenced only from inside another
     object sits next to its parent; arrows reuse `ArrowOverlay`.
   - Existing colour semantics: references azure, current element amber, changed value green.
4. **Diff motion** (pure diff first, then animation):
   - extend the diff to report object-level events: object created, item appended or inserted,
     item removed, item value changed, dict key added or removed, attribute set, reference
     retargeted, frame pushed or popped;
   - animate each: new items slide in, removed items fade out, changed values cross-fade old to new
     with the green pulse, arrows redraw to their new target, frames push and pop;
   - stepping backwards plays the inverse event; scrubbing more than one step jumps without motion.
   - Two-beat stepping works for Python exactly as for C (arrive shows the pre-state).
5. **Fixtures and a sample module:** commit the Phase 29 sample recordings mapped to traces under
   `src/content/fixtures/python/` (data files only). Register one visible module (the harvest
   loop) through a top-level `src/content/fixtures/pythonHarvest.ts` that default-exports a
   `ContentModule`; the catalog only auto-discovers `fixtures/*.ts`, not nested folders.

## Tests
- Validation: good and bad Python traces (dangling reference, duplicate id, index mismatch).
- Diff: every event kind above on small hand-built step pairs, and the inverse for step back.
- Rendering: `renderToStaticMarkup` snapshots for aliasing, nested containers, recursion, instance.
- Highlighter: token streams for a representative snippet.
- All existing tests and snapshots pass unchanged.

## Acceptance criteria
1. Gates pass; no new dependency; type changes are additive, documented, and match
   `docs/PYTHON_TRACE_FORMAT.md`.
2. All Phase 29 samples render correctly: aliasing shows two arrows to one box, mutation changes
   the same box, recursion pushes and pops frames.
3. Motion plays forward and in reverse for every event kind; reduced motion disables it.
4. Both themes look right (screenshots in the report).
5. C modules are visually and behaviorally unchanged.

## When done
Write `reports/phase-30-python-renderer.md` from the template, including screenshots of the
aliasing, recursion and harvest samples mid-trace in both themes. Work on branch
`phase-30-python-renderer`. **Stop without merging** (when running under `prompts/RUNNER-ds-python.md`, follow its merge
rule instead).
