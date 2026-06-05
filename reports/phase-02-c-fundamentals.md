# Phase 2 Report — C Fundamentals (the first real curriculum content)

## 1. Summary

Phase 2 delivers the first real SE 200 curriculum content as hand-authored, verifiably-correct
traces that play on the existing engine — no engine rewrite, no restyle. Five polished modules cover
the four week-1–3 concepts (Hello World; Variables/if-else/while; Functions and Nested Loops, split
into a functions trace and a nested-loops trace; and the week-3 combination of a function called
inside nested loops). The new pedagogical element — **legible control flow** — is realized with one
small **additive** trace-format field, `Step.condition`, rendered as a green/muted chip (`i <= n →
true`) beside the narration; loops visibly iterate with the counter and accumulator pulsing each
pass and the condition re-evaluated every time. Content is organized under `src/content/se200/<topic>`
and registered in a single `catalog.ts` (course → topic), which the workbench now lists in a grouped
sidebar (the Phase 1 fixtures are kept as an "Engine fixtures" group). A reusable `validateTrace`
utility checks structural invariants and a Vitest test runs it over **every** catalog trace. All
gates pass — `typecheck`, `lint`, `test` (33 across 6 files), `build` — with no `any`; Phase 0/1
traces remain valid.

## 2. What I built

- **Content modules** (`src/content/se200/`):
  - `hello-world/helloWorld.ts`
  - `variables-control-flow/controlFlow.ts`
  - `functions-nested-loops/functions.ts`, `functions-nested-loops/nestedLoops.ts`
  - `more-functions-loops/areaTable.ts`
- **Catalog** `src/content/catalog.ts` — course → topic → module registry + `allCatalogTraces()` /
  `allCatalogModules()`.
- **Validator** `src/engine/trace/validate.ts` (`validateTrace`, `validateTraces`) +
  `validate.test.ts` (unit tests) + `src/content/catalog.test.ts` (runs the validator over the
  whole catalog).
- **Workbench** `src/components/ContentSidebar.tsx` + rewired `src/App.tsx` (grouped module
  navigator replacing the Phase 1 tab strip).
- **Additive engine change**: `Step.condition` (`StepCondition`) in `src/engine/trace/types.ts`,
  rendered as a chip in `src/components/NarrationBar.tsx`.
- **Docs**: Phase 2 additions section in `docs/TRACE_FORMAT.md`.

## 3. Modules and the concepts they cover

| Module (file)                                   | Concept (CURRICULUM row)                          | Course · topic · file            | What it teaches |
| ----------------------------------------------- | ------------------------------------------------- | -------------------------------- | --------------- |
| `helloWorld.ts`                                 | Hello, World (SE 200, wk 1)                       | SE 200 · Hello, World · hello.c  | One `main` frame + `printf` to the console panel. |
| `controlFlow.ts`                                | Variables, if/else, while (SE 200, wk 1)          | SE 200 · Variables, if, else, while · control.c | Scalar declare/assign; an `if/else` branch (shows which branch and why); a `while` loop that iterates step-by-step with `sum`/`i` pulsing and the condition chip re-evaluated each pass. |
| `functions.ts`                                  | Functions and Nested Loops (SE 200, wk 2) — part 1 | SE 200 · Functions and Nested Loops · square.c | Function call/return: argument copied into the parameter, return value assigned back, frame push/pop (Phase 1 stack renderer). |
| `nestedLoops.ts`                                | Functions and Nested Loops (SE 200, wk 2) — part 2 | SE 200 · Functions and Nested Loops · grid.c | Nested `for` loops with distinct `i`/`j` counters; `j` resets to 1 each outer pass; prints a 2×2 grid. |
| `areaTable.ts`                                  | More Functions, More Nested Loops (SE 200, wk 3)  | SE 200 · More Functions, More Nested Loops · table.c | The combination: `product(row, col)` called inside nested loops — a frame pushed/popped on every (row, col), result printed. |

All metadata (`course`/`topic`/`file`/`covers`) is taken from `docs/CURRICULUM.md`. SE 200 is the
correct course for every one of these (weeks 1–3); no course code was invented.

## 4. How I verified correctness

Every authored value, loop count, and console line was hand-traced, and the determinate arithmetic
was double-checked with a throwaway calculation (not shipped — no interpreter):

- **controlFlow** (`n = 4`): `4 % 2 == 0` → true ⇒ the `if` branch prints `even`. The `while`
  accumulates `1+2+3+4 = 10` over four passes (i: 1→2→3→4→5, exiting when `5 <= 4` is false). Final
  `sum = 10`, prints `sum = 10`.
- **functions**: `square(4) = 16`, `square(7) = 49`, prints `16 49`.
- **nestedLoops / areaTable** (`i,j` and `row,col` each 1..2): products `1, 2, 2, 4`; rows
  `"1 2 "` then `"2 4 "`.

Cross-check (Node, throwaway): `controlFlow sum (expect 10): 10 | even? true`; `grid rows: ["1 2 ",
"2 4 "]`; `square(4),square(7): 16 49` — all match the authored traces.

**Structural correctness** is enforced automatically: `validateTrace` runs over all 9 catalog traces
in `catalog.test.ts` and passes — confirming `steps[i].index === i`, every `highlightedLines` entry
is within the source, ids are unique per step, and every `activeId`/pointer-target/annotation
resolves. I also stepped through in the browser: the `if` branch prints `even`; the `while` chip
shows `i <= n → true` each pass with `sum`/`i` pulsing, then `i <= n → false` at exit; and in
`areaTable` the `product()` frame visibly pushes inside the loop with `a`/`b` copied from
`row`/`col`. (Operators render literally — `i <= n`, not `i ≤ n` — in both the code panel and the
chip.)

## 5. Key decisions & deviations

- **No deviations from the prompt's constraints or non-goals.** No pointer/array/heap content, no
  concept-views, no navigation shell, no restyle, no trace-format reshape. The design system and
  engine are reused as-is.
- **One concept split into two traces** (Functions and Nested Loops → `functions.ts` +
  `nestedLoops.ts`), which the prompt explicitly permits ("2–3 short traces if it genuinely aids
  teaching"). Splitting keeps each trace focused and short; the week-3 module then *combines* them,
  giving a clean wk2 → wk3 progression.
- **`controlFlow` takes the `if`-true branch** (`n = 4`, even) so the highlighted-branch-taken
  behavior is shown on the `if` line; the `else` line is visibly skipped. One branch per run is
  inherent (a single execution), so the trace demonstrates the taken branch and narrates why.
- **Loop bounds kept small** (sums to 4; 2×2 grids) so every iteration is shown explicitly without
  an exhausting step count, while still making the loop "go around" several times.
- **For-loop counters persist in `main`'s frame** across iterations (and `j`/`col` visibly resets to
  1 each outer pass) rather than being scoped/destroyed per C block rules — a deliberate teaching
  simplification that makes the nested-counter relationship legible.
- **Additive field added** (`Step.condition`) — see §6. It materially improves branch/loop clarity
  and is optional, so it does not touch Phase 0/1 traces.

## 6. Trace-format change (additive)

`Step.condition?: StepCondition` where `StepCondition = { expr: string; result: boolean }`.

- **Purpose**: make branch/loop tests legible — the learner sees the exact expression and its
  boolean result for the current step instead of inferring it.
- **Rendering**: a chip in the narration bar, `expr → result`, green (`bg-changed`) when `true` and
  muted (neutral surface) when `false`. It uses the `.se-code` class so ligatures are off and
  operators read literally (`i <= n`), matching the code panel.
- **Compatibility**: optional and ignored when absent; all Phase 0/1 traces remain valid (confirmed
  by the still-passing Phase 0/1 tests and by `validateTrace`, which does not require it).
- Documented in `docs/TRACE_FORMAT.md` ("Phase 2 additions"); typed with TSDoc in `types.ts`.

No other trace-format or engine changes were made. `validateTrace` and the catalog are new code, not
changes to the existing contract.

## 7. Known issues / follow-ups

- **Step counts are deliberately fine-grained** (e.g. the control-flow module is 21 steps, the
  combined module 34) to show each iteration and each call/return. Autoplay/scrub make this
  comfortable, but a future "skip to next iteration" affordance could help with longer loops.
- **For-loop variable scope** is simplified (counters persist visually); fine for teaching, not a
  literal model of C block scope.
- **The condition chip is the only new control-flow affordance**; richer ideas (branch-not-taken
  ghosting, loop trip-count badges) were intentionally not built — the prompt warned against
  over-building.
- The legacy `src/content/fixtures/index.ts` still exports `FIXTURES`; it is now only used as the
  import source for the catalog's "Engine fixtures" group (the workbench no longer imports it
  directly). Harmless; could be tidied later.

## 8. File map

```
src/
  engine/trace/
    types.ts                 # + StepCondition / Step.condition (additive)
    validate.ts              # NEW: validateTrace / validateTraces
    validate.test.ts         # NEW: validator unit tests
  components/
    NarrationBar.tsx         # + condition chip (ligatures off)
    ContentSidebar.tsx       # NEW: grouped module navigator
  App.tsx                    # rewired to catalog + sidebar
  content/
    catalog.ts               # NEW: course → topic registry + helpers
    catalog.test.ts          # NEW: validateTrace over every catalog trace
    se200/
      hello-world/helloWorld.ts
      variables-control-flow/controlFlow.ts
      functions-nested-loops/functions.ts
      functions-nested-loops/nestedLoops.ts
      more-functions-loops/areaTable.ts
    fixtures/                # Phase 1 fixtures (unchanged; grouped into the catalog)
docs/
  TRACE_FORMAT.md            # + Phase 2 additions section
reports/
  phase-02-c-fundamentals.md # this file
```
