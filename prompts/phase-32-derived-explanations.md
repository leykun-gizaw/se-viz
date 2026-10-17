# Phase 32: Derived step explanations (no AI)

## Why this phase exists
The step explanation panel (Phase 28) shows authored `Step.explain` text, with thin fallbacks. Live
Python code (Phase 31) has no authored text, so the panel must explain each step from the trace
itself: what was bound or changed, which branch ran, which loop iteration this is, what a call
returned. All text comes from deterministic templates. **No AI, no network.**

## Context to read
- `reports/phase-28-studio-shell.md` (panel sections, `Step.explain`, fallback rules).
- `docs/PYTHON_TRACE_FORMAT.md`, `src/python/recorder.py`, the Phase 30 diff events.
- `src/engine/trace/diff.ts`, `beats.ts`.

## Hard constraints
- Frontend only, TS strict; all gates pass including the bundle check. No new dependencies.
- **Authored text always wins** over derived text, section by section.
- Additive trace changes only (the recorder may add fields; C traces unchanged).
- Plain, short, learner-facing English. Use the code's own names and values. Never guess: when a
  fact can't be derived reliably, leave the sentence out.

## What to build
1. **Recorder additions** (additive): per line event, the statement kind of the line from Python's
   `ast` (Assign, AugAssign, AnnAssign, If, Elif, Else, For, While, Return, Expr with Call, Import,
   FunctionDef, ClassDef, Try, Raise, Pass, Break, Continue), the targets of assignments, and for
   `call`/`return` the function name, arguments and return value. Document in
   `docs/PYTHON_TRACE_FORMAT.md`.
2. **`deriveExplanation(trace, stepIndex, beat)`**, a pure function returning the panel sections:
   - **What this step did:** an ordered breakdown, e.g. for `harvest[crop] += 10`: looked up
     `crop` ("beans"), read `harvest["beans"]` (45), added 10 (55), stored it back.
   - **What changed:** from the Phase 30 diff events, phrased per event kind.
   - **Branch taken:** for `if`/`elif`/`while`, the condition result inferred from the next line
     executed, and which lines are skipped.
   - **Loop iteration:** for `for`/`while`, iteration number and the loop variable's new value.
   - **Calls and returns:** "Called `factorial(3)`", "`factorial(3)` returned 6 to line 5".
   - **Exceptions:** type, message, line, and which `except` (if any) caught it.
   - **Concept:** a short glossary entry keyed by statement kind and object type (for example
     `+=` on a dict value, `append` vs `+`, aliasing when two names share one list). Glossary lives
     in one reviewed file, `src/engine/explain/glossary.ts`, written in the same voice as the
     course.
   - Respect two-beat stepping: on `arrive`, describe what is about to run, not its effects.
3. **C traces:** apply the same function where the data allows (value changes, frame push/pop,
   `condition` chips), so C modules without authored text also get richer fallbacks.
4. **Wire it** into the explanation panel; authored `explain` fields override per section.

## Tests
- Golden tests: for each Phase 29 sample, the derived sections for every step match a committed
  snapshot that a human can read and review.
- Unit tests per statement kind and per diff event, both beats, first and last step.
- Authored-wins precedence per section.
- At least two C modules produce sensible derived text where they lack authored text.

## Acceptance criteria
1. Gates pass; no new dependency; additive changes documented.
2. The harvest sample's step 9 reads equivalently to the design canvas (Direction A) breakdown.
3. Every sentence in the golden snapshots is true for its step (reviewed in the report: list any
   you are unsure of).
4. No step shows a contradictory or speculative sentence; missing facts are omitted.
5. Live coding shows derived explanations for arbitrary programs without errors.

## When done
Write `reports/phase-32-derived-explanations.md` from the template, quoting the derived text for
the harvest and factorial samples. Work on branch `phase-32-derived-explanations`.
**Stop without merging** (when running under `prompts/RUNNER-ds-python.md`, follow its merge
rule instead).
