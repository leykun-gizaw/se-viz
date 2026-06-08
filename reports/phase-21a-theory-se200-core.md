# Phase 21a Report — Theory Content Pass: SE 200 core topics

> Shard of the Phase 21 theory content pass. Assigned folders only:
> `se200/{hello-world, variables-control-flow, functions-nested-loops, debugging, more-functions-loops}`.

## 1. Summary

Authored **five slide-deck `theory.md` files**, one per assigned SE 200 topic folder, following the
Phase 20 slide contract (`docs/THEORY_AUTHORING.md`). Each is a complete, presentable mini-lecture:
an auto-generated title slide from the frontmatter, then `---`-separated concept slides following the
deck arc (why → mental model → syntax/rules → patterns → pitfalls → worked example → recap → "see it
run"), with `idea`/`watch-out`/`recap` callouts, highlighted C code blocks (ligatures off), and
tables/nested lists where they help. Every deck's frontmatter `course`/`topic` was copied verbatim
from a sibling module so it pins as that topic's Theory entry. This is **content only** — no
engine/renderer/shared-file edits. `typecheck`/`lint`/`test` (134)/`build` all pass; the two existing
decks (pointers, recursion) are untouched.

Branch: `phase-21a-theory-se200-core`, cut from `main` (Phase 20 merged).

## 2. What I built

Five new files (each a slide deck, ~10 slides):

- `src/content/se200/hello-world/theory.md`
- `src/content/se200/variables-control-flow/theory.md`
- `src/content/se200/functions-nested-loops/theory.md`
- `src/content/se200/debugging/theory.md`
- `src/content/se200/more-functions-loops/theory.md`

No other files changed.

## 3. Acceptance criteria — self-assessment

- [x] **1. gates pass; no shared-file edits; no trace-format/renderer/design change.** typecheck /
  lint / test (134) / build green. `git status` shows only the five new `theory.md` files.
- [x] **2. A slide-deck `theory.md` exists for every assigned folder; existing decks untouched.** All
  five written; `pointers-arrays-strings` and `recursion` not modified.
- [x] **3. Frontmatter `course`/`topic` copied exactly from a sibling module so it pins;
  `theory.test.ts` passes.** Each `topic` matches its modules verbatim (see table); the per-doc
  frontmatter + catalog-resolution tests pass (test count rose 124 → 134, i.e. +2 per new deck).
- [x] **4. Each deck follows the slide convention and matches exemplar quality/depth.** Top-level
  `---` separators, one idea per slide, the full deck arc, callouts, C code blocks, a table
  (debugging), and a nested list (functions). Spot-verified the Debugging deck rendering in-browser.
- [x] **5. All C / worked-example values verified; each deck names its topic's modules in the closing
  slide.** See §4. Every "See it run" slide names the real module(s).

### Each topic → the deck I wrote (and the module it pins above)

| Folder | `topic` (verbatim) | order | Deck title | Closing "see it run" names |
| --- | --- | --- | --- | --- |
| `hello-world` | `Hello, World` | 10 | Hello, World | *Hello, World* |
| `variables-control-flow` | `Variables, if, else, while` | 20 | Variables & Control Flow | *Variables & control flow* |
| `functions-nested-loops` | `Functions and Nested Loops` | 30 | Functions & Nested Loops | *Functions: call & return*, *Nested loops* |
| `debugging` | `Debugging` | 35 | Debugging | *Max of array* (dual-trace) |
| `more-functions-loops` | `More Functions, More Nested Loops` | 40 | Functions Inside Loops | *Function inside nested loops* |

Each deck's arc: title (auto) → why it matters → mental model → syntax/rules → patterns → pitfalls
(`watch-out`) → worked example (C) → recap (`recap`) → see it run.

## 4. How I verified the C and the values

I hand-traced every worked example and cross-checked computed results:

- **hello-world** — standard `#include <stdio.h>` / `int main(void)` / `printf("...\n")` / `return 0`;
  `\n`, the exit-status convention, and the `cc hello.c -o hello` → `./hello` cycle are accurate.
- **variables-control-flow** — matches the module's program: `n = 4` is even (`n % 2 == 0`), and the
  `while` loop sums `1+2+3+4 = 10` (`sum = 10`). Re-checked the running sum 1→3→6→10.
- **functions-nested-loops** — `square(5) = 25`; the 3×3 grid prints `1 2 3 / 2 4 6 / 3 6 9`
  (row `i = 2` → `2 4 6`), `3 × 3 = 9` body runs. Pass-by-value stated correctly.
- **debugging** — read the actual module source: `a[] = {3,7,2,9}`, seed `max = a[0] = 3`, buggy
  `a[i] < max` vs fixed `a[i] > max`. Traced both columns: buggy → **2**, fixed → **9**, first
  divergence at **i = 1** (`7 < 3` false vs `7 > 3` true). The table in the deck reproduces this row
  by row and was confirmed against the source's narration.
- **more-functions-loops** — read the module: helper `product(a, b)` called as `product(row, col)`
  with `row, col` each `1 → 2`. Verified `product(1,1)=1, (1,2)=2, (2,1)=2, (2,2)=4` → output `1 2 2 4`,
  `2 × 2 = 4` calls. The "stack churns one frame at a time" matches what the trace shows.

Each deck ties back to what its visualization actually displays (stack frames, line highlights,
dual-trace columns, push/pop rhythm).

## 5. Key decisions & deviations

- **No deviations from the contract.** Stayed strictly within the five assigned folders; content-only.
- **Title chosen per deck** as a clean human concept name (e.g. "Functions Inside Loops" for *More
  Functions, More Nested Loops*) — the frontmatter `title` drives the auto title slide.
- **`order` set to each folder's module order** (10/20/30/35/40) so the topic keeps its place; theory
  pins first within the topic regardless.
- **The functions deck covers both of its modules** (call/return and nested loops) since the folder
  has two modules under one topic; the closing slide names both.
- **Debugging uses a 6-row table** (header + 5 rows) — the convention's `≤6 rows` cap; verified it
  fits the 16:9 frame at slide type in-browser.

## 6. Trace format / API notes

**No trace-format change, and no shared-file edits of any kind.** Theory docs are an additive,
auto-discovered content type (one `theory.md` per topic folder, picked up by the existing `?raw`
glob); adding them required no change to `catalog.ts`, `theory.ts`, the renderer, the trace format, or
`validateTrace`. All existing modules/traces and `validateTrace` are unaffected.

## 7. Known issues / follow-ups

- **Remaining Phase 21 folders are other shards** — `se200/{more-pointers-arrays-strings,
  even-more-pointers-arrays-strings, static-libraries, argc-argv, preprocessor}` and the four SE 201
  topics still need decks (not in my assignment).
- Decks are authored to the per-slide budget; if a future engine change alters slide sizing, re-check
  the few denser slides (the debugging table, the functions grid code).

## 8. File map

```
src/content/se200/
  hello-world/theory.md              # NEW — deck
  variables-control-flow/theory.md   # NEW — deck
  functions-nested-loops/theory.md   # NEW — deck
  debugging/theory.md                # NEW — deck
  more-functions-loops/theory.md     # NEW — deck
reports/phase-21a-theory-se200-core.md   # this file
```
