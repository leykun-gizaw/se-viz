# Phase 14 — Debugging: Dual Trace (SE 200) — CONTENT, Wave 2 (parallel)

Read `docs/CONTENT_AUTHORING.md` (shared rules) and the **`dual-trace` view convention** documented in
`docs/TRACE_FORMAT.md` by Phase 11. Concept-view **content** — data only, no engine edits. Depends on
Phase 11 being merged. Run on your own branch/worktree; touch only your folder.

## Context
- `docs/design/SE-ViZ-visual-style-exploration.pdf` screen 09 — the exact target.
- The `dual-trace` view renderer + its fixture from Phase 11 — match its data shape.

## Curriculum row (from `docs/CURRICULUM.md`, SE 200, week 2)
- **Debugging — `Debugging`** (course `SE 200`). (Verify the exact topic string.)

## What to author (as `dual-trace`-view data)
Two synchronized runs of the **same program**, **buggy vs fixed**, with the **first point of
divergence flagged** and linked across the columns:
- **Max-of-array** (the design's example, or an equally clear small bug): buggy `if (a[i] < max)`
  vs fixed `if (a[i] > max)` over `a[] = {3, 7, 2, 9}` — diverges at the first comparison
  (`i = 1`); the bug returns `2`/`3`, the fix returns `9`. Show both columns stepping together and
  flag the first row where state differs.
- Author **at least one** such dual-trace; a second classic bug (e.g. off-by-one loop bound, or `=`
  vs `==`) is welcome if it stays clear.
- Narration localizes the bug: scanning down to the **first** divergence pinpoints the offending
  line — everything after is downstream of it.

## Folder
`src/content/se200/debugging/` (course `SE 200`, topic per CURRICULUM.md).

## Teaching focus
Debugging by **comparison**: identical steps look identical; the first row where the two runs differ
is where the bug lives. The dual-trace makes "find the first divergence" a visual scan rather than a
read of the whole program.

## Acceptance (in addition to CONTENT_AUTHORING.md)
- A correct `dual-trace` module: two synchronized runs of one program (buggy vs fixed), equal step
  counts, the first divergence correctly identified and flagged; both final results correct.
- Auto-discovered + passes `validateTrace` (incl. equal-length columns / divergence checks); SE 200
  metadata; **no** engine/renderer/format edits. Verify both runs' values by hand + throwaway calc.

Report: `reports/phase-14-debugging-dual-trace.md`.
