# Phase 13 — Preprocessor Expansion (SE 200) — CONTENT, Wave 2 (parallel)

Read `docs/CONTENT_AUTHORING.md` (shared rules) and the **`before-after` view convention** documented
in `docs/TRACE_FORMAT.md` by Phase 11. Concept-view **content** — data only, no engine edits. Depends
on Phase 11 being merged. Run on your own branch/worktree; touch only your folder.

## Context
- `docs/design/SE-ViZ-visual-style-exploration.pdf` screen 08 — the exact target.
- The `before-after` view renderer + its fixture from Phase 11 — match its data shape.

## Curriculum row (from `docs/CURRICULUM.md`, SE 200, week 7)
- **Preprocessor — `Preprocessor`** (course `SE 200`).

## Folder
`src/content/se200/preprocessor/` (topic `Preprocessor` — verify exact string).

## What to author (as `before-after`-view data)
Source **before** → `cpp` (process box) → translation unit **after**, with substituted spans
highlighted (the value-changed green = "this text was transformed"):
- **`#define` object-like macro** — `#define MAX 100`, then `int cap = MAX;` → `int cap = 100;`.
- **`#define` function-like macro** — `#define SQ(x) ((x)*(x))`, then `SQ(3 + 1)` →
  `((3 + 1)*(3 + 1))` — emphasize it's **textual** (argument pasted twice, **not** evaluated; a great
  spot to show the classic `a+b` macro pitfall in narration).
- **`#include`** — the header's contents are pasted inline (e.g. a small `limits.h` snippet appears in
  the "after").
- Step through each substitution; narration: the preprocessor runs **before** the compiler and is
  pure text substitution.

## Teaching focus
The preprocessor is **textual**, not semantic: macros are find-and-replace, `#include` is paste, and
function-like macros copy their arguments verbatim (hence the parenthesization rule and the
`SQ(3+1)` vs evaluation distinction). Green marks every substituted span.

## Acceptance (in addition to CONTENT_AUTHORING.md)
- A correct `before-after` module covering object-like + function-like macros and `#include`, with
  accurate before/after text and highlighted substitution spans; SE 200 metadata.
- Auto-discovered + passes `validateTrace` (incl. highlight-span range checks); **no**
  engine/renderer/format edits.

Report: `reports/phase-13-preprocessor.md`.
