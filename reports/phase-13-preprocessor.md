# Phase 13 Report — Preprocessor Expansion (SE 200)

## 1. Summary
This phase adds one concept-view content module for SE 200 · Preprocessor (week 7), authored as
`view: 'before-after'` data against the Phase 11 contract. It walks a small C source through `cpp`:
the left panel is the source as written (an `#include` plus object-like and function-like `#define`
macros), the right panel is the post-`cpp` translation unit. Each step highlights, in the
value-changed green, exactly the text substituted that step. No engine, renderer, trace-format,
test, or shared-file changes — data only, auto-discovered by folder. All four gates are green.

## 2. What I built
- `src/content/se200/preprocessor/macros.ts` — `ContentModule` (default export) with a
  `before-after` trace (`id: se200-preprocessor-macros`, `course: 'SE 200'`, `topic: 'Preprocessor'`,
  `file: 'macros.c'`, `view: 'before-after'`, `source: ''`, `order: 70`). Six steps:
  source → `#include` paste → object-like `MAX` → function-like `SQ` → pitfall callout → final
  translation unit.

## 3. Acceptance criteria — self-assessment
- [x] **A correct `before-after` module covering object-like + function-like macros and `#include`,
  with accurate before/after text and highlighted substitution spans; SE 200 metadata.** —
  `src/content/se200/preprocessor/macros.ts`. Object-like (`#define MAX 100` → `int cap = 100;`),
  function-like (`#define SQ(x) ((x) * (x))`, `SQ(3 + 1)` → `((3 + 1) * (3 + 1))`), and `#include
  "bounds.h"` (header text pasted inline) are each a step. Metadata `course: 'SE 200'`,
  `topic: 'Preprocessor'`.
- [x] **Auto-discovered + passes `validateTrace` (incl. highlight-span range checks); no
  engine/renderer/format edits.** — File lives under `src/content/se200/preprocessor/` and
  default-exports a `ContentModule`; `npm run test` (validateTrace over the whole catalog) passes.
- [x] **Concept-view conventions** — `source: ''`, every step `highlightedLines: []`, `stack: []`,
  `heap: []`, and a `beforeAfter` payload with `processLabel: 'cpp'`; before/after restated every
  step. `order: 70` (≈ 10 × week 7).

### CURRICULUM row covered
`docs/CURRICULUM.md` SE 200, week 7: `| 7 | Preprocessor | C - Preprocessor | Yes (macro expansion) | 5 |`
→ module `se200-preprocessor-macros` (topic string `Preprocessor`, verified verbatim).

## 4. How to run & verify
```
cd /private/tmp/seviz-phase13 && npm run typecheck && npm run lint && npm run test && npm run build
```
All four pass. In the app the module appears under SE 200 → Preprocessor → "Macro expansion".

Correctness of before/after text and highlighted spans (hand-traced):

BEFORE (6 lines):
```
1  #include "bounds.h"
2  #define MAX 100
3  #define SQ(x) ((x) * (x))
4
5  int  cap  = MAX;
6  int  area = SQ(3 + 1);
```
AFTER (6 lines):
```
1  /* bounds.h */
2  extern int clamp(int v);
3  typedef struct Range { int lo; int hi; } Range;
4
5  int  cap  = 100;
6  int  area = ((3 + 1) * (3 + 1));
```

Step-by-step spans (all 1-based and in range: before has 6 lines, after has 6 lines):
- `source`: before `[1,2,3]` (the directives), after `[]`.
- `include`: before `[1]` (the `#include`), after `[1,2,3]` (the pasted header text).
- `expand-max`: before `[2,5]` (`#define MAX` + its use), after `[5]` (`int cap = 100;`).
- `expand-sq`: before `[3,6]` (`#define SQ` + its use), after `[6]`.
- `pitfall`: before `[3]`, after `[6]` (re-emphasizes the parenthesization).
- `translation-unit`: before `[]`, after `[1,2,3,5,6]` (the final compiled text; line 4 is blank).

Key textual-substitution check (the `SQ(3 + 1)` case): `SQ(x)` is defined as `((x) * (x))`. cpp pastes
the *argument text* `3 + 1` for each `x`, verbatim and twice, giving `((3 + 1) * (3 + 1))` — it does
**not** evaluate to 16. The `pitfall` step narrates the classic trap: a naive `#define SQ(x) x * x`
would expand `SQ(3 + 1)` to `3 + 1 * 3 + 1` = 7 (since `*` binds tighter than `+`), which is why every
parameter is parenthesized. The `MAX` case is verified the same way: pure token replacement of `MAX`
by `100`. The `#include` is a literal text paste of `bounds.h` (a header chosen to contain only plain
declarations, so the paste is clean and not itself re-expanded).

## 5. Key decisions & deviations
- No deviations from the prompt. No engine/renderer/trace-format edit was needed (the Phase 11
  `before-after` view covered everything).
- Chose a header (`bounds.h`) whose contents are plain declarations (no nested macros) so the
  `#include` step demonstrates "paste" cleanly without a second expansion muddying the example.
- Added a dedicated `pitfall` step (between `expand-sq` and the final unit) to make the `a + b`
  parenthesization trap explicit; it reuses the same panels and re-highlights the `SQ` lines.
- Used `order: 70` (≈ 10 × week 7). The `argc, argv` row shares week 7; ordering between the two
  week-7 topics is unaffected by this module and falls back to label as designed.

## 6. Trace format / API notes
No trace-format change — used the Phase 11 `before-after` view (`Trace.view = 'before-after'` +
per-step `Step.beforeAfter` payloads). Shapes consumed as documented in
`docs/TRACE_FORMAT.md § Phase 11 additions — concept views`.

## 7. Known issues / follow-ups
None. The build emits the pre-existing >500 kB chunk-size advisory (project-wide, unrelated to this
data-only module).

## 8. File map
- Added: `src/content/se200/preprocessor/macros.ts`
- Added: `reports/phase-13-preprocessor.md`
