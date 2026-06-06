# Phase 06 — malloc / free: the heap (SE 201) — CONTENT, Wave 1 (parallel)

Read `docs/CONTENT_AUTHORING.md` first — it has all the shared rules (constraints, auto-discovery
file placement, quality bar, correctness, parallel-safety, report format). This prompt only states
what's unique to this phase. Run on your own branch/worktree; touch only your content folder.

## Context
- `src/content/fixtures/mallocFree.ts` — the Phase 1 heap fixture (allocated/freed/dangling/leaked
  + the console heap-watch). This is your starting point and quality bar.
- `docs/design/SE-ViZ-visual-style-exploration.pdf` screen 04 — the target look (already
  implemented by the engine).

## Curriculum rows (from `docs/CURRICULUM.md`, SE 201, week 1)
1. **Introduction to Memory Allocation — `malloc and free`**
2. **malloc/free Commands — `More on malloc and free`**

## Folder
`src/content/se201/dynamic-memory/` (course `SE 201`, topic `Introduction to Memory Allocation` /
`malloc/free Commands` — verify exact topic strings against CURRICULUM.md).

## What to author
Promote and expand the `mallocFree` fixture into proper SE 201 content, then add the second-row
material. Cover, across focused modules:
- **`malloc` returns a heap block**; the returned pointer (stack) draws an azure arrow into the heap
  block; writing into it (e.g. `strcpy`) updates the block's bytes.
- **`free`** returns a block (state → `freed`, hatched); a pointer still holding the address becomes
  **dangling** (red arrow, UB) — show the `p = NULL` fix that clears it.
- **Leak**: dropping the only reference to a live block (`p = NULL` without `free`) → `leaked`
  (warning, no incoming arrow). Use the console **heap-watch** (`Step.watch`) for dangling/leak lines.
- **Checking `malloc`'s result for `NULL`** (allocation failure) — at least narrate/illustrate it.
- **`sizeof` / `realloc`** (row 2): `malloc(n * sizeof(T))` sizing, and `realloc` growing a block
  (copy-on-grow: a new block, old freed) — show the address change and why pointers must be
  reassigned.
- De-duplicate: once promoted, **remove the `mallocFree` entry from the engine-fixtures group** so
  there's one canonical copy (other fixtures stay).

## Teaching focus
Heap vs stack lifetime: heap blocks **outlive the call** that made them and must be **manually
freed**; the four states (`allocated`/`freed`/`dangling`/`leaked`) are the whole lesson. Make the
dangling-vs-leak distinction unmistakable (dangling = pointer to freed memory; leak = live memory
with no pointer). All four allocation `state`s already render — you only author the data.

## Acceptance (in addition to CONTENT_AUTHORING.md)
- Modules for both week-1 rows, all four allocation states demonstrated, the heap-watch console used,
  `realloc`/`sizeof` shown, NULL-check covered; `mallocFree` fixture de-duplicated into content.
- Every address, size, and state transition verified correct (report §4); auto-discovered + passes
  `validateTrace`; no shared-file edits; no trace-format/renderer/design change.

Report: `reports/phase-06-malloc-free.md`.
