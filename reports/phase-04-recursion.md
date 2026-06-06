# Phase 4 Report — Recursion (SE 200, the marquee concept)

## 1. Summary

Phase 4 promotes recursion into a proper SE 200 catalog topic with four hand-authored,
verifiably-correct traces. The canonical **`factorial(n)`** was promoted out of the Phase 1 fixtures
group (de-duplicated) and refined to curriculum narration quality with base-case condition chips;
three more modules were added — **`sum_to(n)`** (accumulation), **reverse a string** (recursion over
data, where the work happens on the unwind), and **`fibonacci(n)`** (tree recursion, modeled with
the exact depth-first push/pop order). Every module shows the call stack as the story: each call
pushes a **new frame with distinct id/`callId` and its own parameter copy**, the stack grows
downward (descending addresses) to an explicit base case, then unwinds with each frame's **pending
return expression resolving and green-pulsing**. The engine required **no change** — recursion is
just many frames with distinct ids. All gates pass — `typecheck`, `lint`, `test` (43 across 6
files), `build` — with no `any`; Phases 0–3 traces remain valid.

## 2. What I built

- **Modules** (`src/content/se200/recursion/`): `factorial.ts` (promoted), `sumTo.ts`,
  `reverseString.ts`, `fibonacci.ts`.
- **Catalog** (`src/content/catalog.ts`): a new SE 200 "Recursion" topic with the four modules
  (factorial leading); imports factorial from its new location.
- **De-duplication**: deleted `src/content/fixtures/factorial.ts`; removed it from
  `fixtures/index.ts` (and its `FIXTURES` entry) and from the "Engine fixtures → Renderer
  primitives" catalog group; repointed the engine's `pulse.test.ts` import to the promoted file
  (step/cell ids preserved so the test still exercises the unwind pulse).
- No trace-format or design change (see §6).

## 3. Modules and the concept each covers

| Module (file) | Concept | Course · topic · file | What it shows |
| --- | --- | --- | --- |
| `factorial.ts` | Canonical recursion | SE 200 · Recursion · factorial.c | Several `factorial` frames live at once (distinct ids `fac4…fac1`), each with its own `n`; stack grows to base `n<=1`, then unwinds; returns are pending `n * factorial(n-1)` resolving and pulsing. |
| `sumTo.ts` | Accumulation recursion | SE 200 · Recursion · sum_to.c | Builds to base `sum_to(0)=0`, then each frame adds its `n` to the value from below (`4 + sum_to(3)` → … → 10). |
| `reverseString.ts` | Recursion over data | SE 200 · Recursion · reverse.c | Parameter narrows each call (`s + 1`) to the `'\0'` base case; `putchar(*s)` runs **after** the recursive call, so chars print on the **unwind** → "tac". |
| `fibonacci.ts` | Tree recursion (advanced) | SE 200 · Recursion · fib.c | Two calls per frame ⇒ depth-first order; `fib(2)` is recomputed (repeated subproblem); pending `fib(n-1) + fib(n-2)` resolves left-then-right. |

All metadata is curriculum-sourced — SE 200 · Recursion (week 5).

## 4. How I verified correctness

Each trace was hand-traced and cross-checked with a throwaway calc (not shipped):

- **`factorial(4) = 24`** (4·3·2·1); base `factorial(1)=1`. Returns resolve 1 → 2 → 6 → 24 on unwind.
- **`sum_to(4) = 10`** (4+3+2+1+0); base `sum_to(0)=0`. Resolves 0 → 1 → 3 → 6 → 10.
- **`reverse("cat") = "tac"`**; base case at `'\0'`; output builds "t" → "ta" → "tac" as frames pop
  (verifying the work-on-unwind ordering).
- **`fibonacci(4) = 3`** (fib sequence 0,1,1,2,3).

Throwaway output: `factorial(4)=24`, `sum_to(4)=10`, `fib(4)=3` (seq `0,1,1,2,3`),
`reverse("cat")="tac"`.

**Tree-recursion push/pop order (the part most likely to be wrong) is exact.** The throwaway calc
logged the DFS activation order for `fib(4)` as the n-sequence **`4,3,2,1,0,1,2,1,0`** (9 calls),
which matches the authored activations `fib0…fib8` one-for-one:

| activation | fib0 | fib1 | fib2 | fib3 | fib4 | fib5 | fib6 | fib7 | fib8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| n | 4 | 3 | 2 | 1 | 0 | 1 | 2 | 1 | 0 |

`fib(2)` appears at fib2 **and** fib6 — the repeated subproblem the module calls out. The full
push/pop sequence authored is: push fib0,fib1,fib2,fib3, pop fib3, push fib4, pop fib4, pop fib2,
push fib5, pop fib5, pop fib1, push fib6,fib7, pop fib7, push fib8, pop fib8, pop fib6, pop fib0 —
i.e. each frame evaluates its entire left subtree (push+pop) before its right call, and only the
current path is ever live (peak depth = 4 `fib` frames). Frame **addresses are assigned by stack
depth** (`0x7ffee540…4b0`), so a slot is correctly reused when a frame pops and its sibling pushes.

**Structural correctness is enforced automatically:** `validateTrace` runs over all catalog traces
(now including the four recursion modules) and passes — confirming `steps[i].index === i`, in-range
`highlightedLines`, unique ids per step, and resolvable `activeId`s (so the 9 distinct `fib` frame
ids and their cells are all consistent). I also browser-verified the `fibonacci` peak state: four
`fib()` frames with n = 4,3,2,1, descending addresses, each showing its pending return expression,
the `n < 2 → true` chip, and the deepest frame active at the bottom.

## 5. Key decisions & deviations

- **`fibonacci` was included.** The prompt makes tree recursion optional and says to skip it unless
  the push/pop order is exactly right. I included it because I could verify the exact DFS order (see
  §4) — it is the strongest motivator for "repeated subproblems / why naïve fib is slow."
- **No deviations from constraints/non-goals.** No tree/graph data structures (Fibonacci is tree
  *recursion*, not a tree *structure*), no heap, no concept-views, no shell, **no engine or
  trace-format change**, no restyle.
- **Pending-return modeling.** Returns are authored as evolving strings: e.g. `fib(3) + fib(2)` →
  `2 + fib(2)` → `3`; the final resolution to a number is a value change, so the engine's
  `diffSteps` pulses it automatically (no per-fixture animation hard-coding). For `factorial`/`sum_to`
  the right operand resolves directly to the number (e.g. `4 * factorial(3)` → `24`).
- **Promotion preserved ids.** The promoted `factorial` keeps its step ids (`start`, `unwind-3`,
  `unwind-4`, …) and cell ids (`fac4.ret`, `fac3.n`, …) so the engine's `pulse.test.ts` — which
  asserts the unwind green-pulse selection — keeps passing with only an import-path change.
- **Base case made explicit** via `Step.condition` (Phase 2 mechanism): the recursion test is shown
  as a chip — `n <= 1 → false` on the way down, `→ true` at the base — on every module.
- **Frame ids per activation.** `factorial`/`sum_to` use the unique `n` as the id suffix (each `n`
  occurs once); `fibonacci` uses a global activation counter (`fib0…fib8`) because the same `n`
  recurs, and `callId` is the activation order. All ids are distinct within any step.

## 6. Additive change

**None.** No trace-format field was added or changed, and the engine/design were not touched.
Recursion is expressed entirely with existing mechanisms: multiple `StackFrame`s with distinct ids,
`activeId`, value pulses derived from `diffSteps`, `Step.condition` for the base-case test, and
narration. Phases 0–3 traces are unaffected.

## 7. Known issues / follow-ups

- **`fibonacci` is 21 steps** and the other modules are step-dense by design (one push/pop/resolve
  per step) so the stack story is legible; the transport (scrub/play) makes this comfortable. A
  future "step over this call" affordance could help skip a resolved subtree.
- **Pending expressions are authored strings**, not computed — correct here because the values are
  hand-verified, but a future interpreter phase would generate them.
- **Addresses are illustrative** (a tidy descending `0x7ffee5xx` ladder), not a real ABI layout — a
  deliberate teaching simplification consistent with the Phase 1 fixture.
- The Phase 1 `FIXTURES` array in `fixtures/index.ts` is now three entries and still unused by the
  app (the catalog drives the UI); harmless, could be retired later.

## 8. File map

```
src/
  content/
    se200/recursion/
      factorial.ts          # promoted from fixtures, refined + base-case chips (ids preserved)
      sumTo.ts              # accumulation recursion
      reverseString.ts      # recursion over data (print on unwind)
      fibonacci.ts          # tree recursion (exact DFS order; fib(2) recomputed)
    catalog.ts              # + SE 200 "Recursion" topic; factorial removed from Engine fixtures
    fixtures/
      index.ts              # factorial import/export + FIXTURES entry removed
      factorial.ts          # DELETED (promoted to se200/recursion/)
  engine/trace/
    pulse.test.ts           # import repointed to se200/recursion/factorial.ts
reports/
  phase-04-recursion.md     # this file
```
