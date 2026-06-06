# Phase 12 — Static-Library Build Pipeline (SE 200) — CONTENT, Wave 2 (parallel)

Read `docs/CONTENT_AUTHORING.md` (shared rules) and the **`pipeline` view convention** documented in
`docs/TRACE_FORMAT.md` by Phase 11. This is concept-view **content** — author data only, no engine
edits. Depends on Phase 11 being merged. Run on your own branch/worktree; touch only your folder.

## Context
- `docs/design/SE-ViZ-visual-style-exploration.pdf` screen 07 — the exact target.
- The `pipeline` view renderer + its fixture from Phase 11 — match its data shape.

## Curriculum row (from `docs/CURRICULUM.md`, SE 200, week 6)
- **Static Libraries — `Static Libraries`** (course `SE 200`).

## Folder
`src/content/se200/static-libraries/` (topic `Static Libraries` — verify exact string).

## What to author (as `pipeline`-view data)
The build pipeline `.c → .o → .a → binary`, left to right:
- **Sources** (`main.c`, plus library sources e.g. `circle.c`, `square.c`) → **`cc -c`** (process
  box) → **objects** (`main.o`, `circle.o`, `square.o`).
- **`ar rcs`** (process box) bundles the **library** objects into a **`.a` archive**
  (`libshapes.a`).
- **`ld`** (process box) links `main.o` against the archive into the final **executable** (`app`) —
  the only artifact carrying the accent.
- Step through the stages (compile → archive → link); narration explains each: independent
  compilation, archiving, symbol resolution at link time.

## Teaching focus
Separate compilation and linking: each `.c` compiles independently to a `.o`; `ar` bundles objects
into a reusable `.a`; the linker resolves `main.o`'s symbols against the archive to produce one
binary. Dashed boxes are **processes**, solid cards are **files on disk**.

## Acceptance (in addition to CONTENT_AUTHORING.md)
- A correct `pipeline`-view module for the `.c→.o→.a→binary` flow with the right tools/artifacts and
  edges, staged stepping, accurate narration; **SE 200** metadata (not the PDF's stray "SE 220").
- Auto-discovered + passes `validateTrace` (incl. pipeline edge checks); **no** engine/renderer/format
  edits (use only the Phase 11 `pipeline` convention).

Report: `reports/phase-12-static-libraries.md`.
