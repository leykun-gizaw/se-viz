# Phase 4 — Recursion (SE 200, the marquee concept)

## Your role and context
You are Claude Code, implementing **SE-Viz**. Phases 0–3 are complete and committed: the trace
format, the full memory renderer (frames, scalars, pointers/arrows, arrays, structs, heap),
diff-driven animation (value pulse, frame springs, arrow retarget), full transport, the locked
design system, the content **catalog**, and the **`validateTrace`** check that runs over every
catalog trace. Read before starting:
- `README.md`, `docs/CURRICULUM.md` (authoritative concepts).
- `docs/TRACE_FORMAT.md`, `src/engine/trace/*` — the contract. Note the convention for **distinct
  frame ids per activation** so simultaneous recursive frames are distinguishable.
- `reports/phase-01-engine.md` … `reports/phase-03-pointers-arrays-strings.md` — conventions.
- **`src/content/fixtures/factorial.ts`** — the Phase 1 recursion fixture (matches PDF screen 01:
  nested frames, descending addresses, base-case pulse, unwind). This is your starting point.
- `src/content/se200/*` and `src/content/catalog.ts` — Phase 2/3 authoring quality + registration.
- `docs/design/` — the locked design (implemented; do not restyle).

Phase 4 is **content, not engine.** Recursion is fully supported already — it is just many stack
frames with distinct ids pushed and popped. The engine should need **no change** (additive +
documented only if genuinely required, which is unlikely).

## Hard constraints (unchanged)
- Frontend only. Traces-first (no interpreter). React + TS (strict) + Tailwind + Framer Motion.
- No `any` without justification. `typecheck`, `lint`, `test`, `build` must all pass.
- **Do not reshape the trace format or restyle the design system.** Reuse Phases 0–3.
- Register every module in `src/content/catalog.ts`; `validateTrace` must pass over all of them.
- Metadata (`course`/`topic`/`file`/`covers`) from `docs/CURRICULUM.md` — all SE 200, wk 5. Never
  fabricate course codes.

## What to author (SE 200 · Recursion, wk 5)
Promote recursion into a proper catalog topic `src/content/se200/recursion/` and cover these. One
clear, correct, well-narrated trace each; quality over quantity.

1. **`factorial(n)`** *(canonical — promote the fixture)*. Take `src/content/fixtures/factorial.ts`,
   refine it to Phase 2/3 narration quality, give it curriculum metadata (`course: 'SE 200'`,
   `topic: 'Recursion'`, `file: 'factorial.c'`, `covers: ['SE200: Recursion']`), and register it in
   the catalog under Recursion. **Remove the now-duplicated factorial entry from the "Engine
   fixtures" group** so there is one canonical copy (other fixtures stay).
2. **An accumulation recursion** — e.g. `sum_to(n)` (returns `n + sum_to(n-1)`, base `sum_to(0)=0`)
   or a countdown. Simplest possible shape: shows the stack build to the base case, then each frame
   adding its `n` to the returned value on the way up.
3. **Recursion over data** — recursion isn't only numeric: e.g. **print/reverse a string
   recursively** or **sum an array recursively**. Show the parameter narrowing each call (a shorter
   string / a moved pointer or index) and the base case (empty string / index past the end).
4. **(Optional, advanced) `fibonacci(n)` — tree recursion.** Only include if you model it correctly:
   two recursive calls per frame means the stack follows **depth-first call order** — at any moment
   only the current path is live; frames push and pop as each branch resolves. Use it to motivate
   **repeated subproblems** (why naïve fib is slow). If you can't make the push/pop order exactly
   right, skip it rather than ship a wrong stack.

## The teaching focus of this phase: the call stack as the story
Recursion clicks when learners *see the stack*. Make these unmistakable (the factorial fixture
already does most of this — hold every module to that bar):
- **Each call pushes a NEW frame with its own copy of the parameters/locals.** Use **distinct frame
  ids per activation** (e.g. `factorial#0`, `factorial#1`, …) and `callId` so the renderer shows
  several `factorial` frames at once, each with its own `n`. Frames spring in on call.
- **The stack grows to the base case, then unwinds.** The deepest frame is the **active** one at the
  bottom (per PDF screen 01); descending frame `address`es read as the stack growing downward.
- **Return values propagate up.** Show each frame's return as a **pending expression** (e.g.
  `4 * factorial(3)`) that **resolves to a number** as its child returns — the resolved value
  **green-pulses**, then the frame pops. The base case returns the seed value.
- **The base case is explicit.** Highlight the base-case test and narrate why recursion stops there.

Use existing mechanisms (frames, `activeId`, value pulses via `diffSteps`, `Step.condition` for the
base-case test, narration). Do not add fields.

## Content organization
- Modules under `src/content/se200/recursion/…`, registered in `catalog.ts` under a "Recursion"
  topic. Keep the canonical `factorial` as the lead module.

## Non-goals for Phase 4 (do NOT build)
- No tree/graph **data structures** (Fibonacci is tree *recursion*, which is fine — a binary tree
  *structure* is not in scope). No heap/`malloc`, linked lists, stacks/queues, hash tables.
- No concept-views, no navigation shell, no interpreter, no design restyle, no trace-format reshape,
  no new memory primitive.

## Acceptance criteria (the reviewer will check these against the code)
1. `typecheck`, `lint`, `test`, `build` all pass; no `any` without justification.
2. `factorial` is promoted to catalog content with curriculum metadata, refined narration, and is
   **de-duplicated** from the fixtures group; plus at least two more recursion modules (an
   accumulation and a recurse-over-data). All SE 200 · Recursion.
3. Simultaneous recursive frames render correctly — **distinct frame ids/`callId` per activation**,
   each with its own parameter value; the stack visibly **grows to the base case and unwinds**.
4. Return values show as **pending expressions that resolve and green-pulse** on unwind; the base
   case is explicit (e.g. via `Step.condition`); deepest frame is active at the bottom with
   descending addresses.
5. All new traces registered in the catalog and pass `validateTrace`.
6. Any engine/trace-format change (ideally none) is additive, leaves Phases 0–3 valid, documented.
7. Every returned value is **verifiably correct** — report §4 must show the checks (e.g.
   `factorial(4)=24`, `sum_to(4)=10`, the data example's result), hand-trace + throwaway calc; no
   shipped interpreter. If `fibonacci` is included, the report must show the **exact push/pop
   order** is correct.

## When done
Write your report to `reports/phase-04-recursion.md` using `reports/TEMPLATE.md`. In §3 list each
module + concept; in §4 show the correctness checks (and, for any tree recursion, the call order);
in §5 flag deviations (incl. whether `fibonacci` was included); in §6 note any additive change
(ideally "none"). Do not start a later phase.
