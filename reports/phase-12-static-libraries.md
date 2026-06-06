# Phase 12 Report — Static-Library Build Pipeline (SE 200)

## 1. Summary
This phase delivers one concept-view content module for **SE 200 · Static Libraries** (week 6),
authored as `view: 'pipeline'` data against the Phase 11 pipeline contract. It renders the
`.c → .o → .a → binary` build left→right with multiple sources, showing separate compilation
(`cc -c`), archiving (`ar rcs`), and link-time symbol resolution (`ld`). No engine, renderer,
trace-format, or shared-file changes — the catalog auto-discovers the new module by folder. All four
gates (typecheck, lint, test, build) are green.

## 2. What I built
- `src/content/se200/static-libraries/buildPipeline.ts` — a `ContentModule` whose `Trace`
  (`view: 'pipeline'`) steps through 7 stages of a multi-source static-library build:
  sources (`main.c`, `circle.c`, `square.c`) → `cc -c` → objects (`main.o`, `circle.o`, `square.o`)
  → `ar rcs` → `libshapes.a` → `ld` → `app` (the only accent artifact).
- `reports/phase-12-static-libraries.md` — this report.

## 3. Acceptance criteria — self-assessment
CURRICULUM row covered (SE 200, week 6):
`| 6 | Static Libraries | C - Static Libraries | Yes (conceptual/linking) | 5 |` →
`course: 'SE 200'`, `topic: 'Static Libraries'`.

- [x] **A correct `pipeline`-view module for the `.c→.o→.a→binary` flow with the right tools/artifacts and edges** — `buildPipeline.ts`: artifacts are solid file cards (`.c`/`.o`/`.a`/binary), processes are dashed boxes (`cc -c`/`ar rcs`/`ld`); 11 nodes + 12 edges modeling fan-out at compile, fan-in at archive, and main.o joining the archive at link.
- [x] **Staged stepping, accurate narration** — 7 steps keyed by a per-node `stage` (idle → active → done); narration explains separate compilation, `ar rcs` flags + symbol index, and link-time symbol resolution.
- [x] **SE 200 metadata (not the PDF's stray "SE 220")** — `trace.course = 'SE 200'`, `topic = 'Static Libraries'`, `file = 'Makefile'`, `order = 60` (10×week 6).
- [x] **Concept-view conventions** — `source: ''`, every step `highlightedLines: []`, `stack: []`, `heap: []`, exactly one `activeId` per step, and the `pipeline` payload on every step.
- [x] **Auto-discovered + passes `validateTrace` (incl. pipeline edge checks)** — `npm run test` green (69 tests); `validateTrace` runs over the whole catalog.
- [x] **No engine/renderer/format edits** — only new files under `src/content/se200/static-libraries/`.

## 4. How to run & verify
```
cd /private/tmp/seviz-phase12
npm run typecheck   # tsc -b --noEmit — clean
npm run lint        # eslint . — clean
npm run test        # vitest run — 6 files, 69 passed
npm run build       # vite build — built
```
In `npm run dev` the module appears under **SE 200 → Static Libraries → "Build pipeline"**; stepping
advances one stage at a time, with the executable `app` as the sole accented artifact.

**Pipeline stages/edges verified (hand-trace):**
- Nodes declared left→right in pipeline order so connectors render correctly:
  `main.c, circle.c, square.c → cc → main.o, circle.o, square.o → ar → libshapes.a → ld → app`.
- Edges, all endpoints resolving to declared node ids:
  sources→`cc` (3); `cc`→objects (3); `circle.o`,`square.o`→`ar` (2); `ar`→`libshapes.a`;
  `main.o`→`ld` and `libshapes.a`→`ld`; `ld`→`app`. 12 edges total.
- Correctness of the model: `main.c` is **not** archived (only the library objects `circle.o` +
  `square.o` go into `libshapes.a`); `main.o` links directly against the archive — matching real
  `ar rcs libshapes.a circle.o square.o` + `cc main.o -L. -lshapes -o app` semantics. `app` is the
  only `accent: true` node, per the design (last artifact only).

## 5. Key decisions & deviations
- **Stage-driven reveal instead of the fixture's linear index.** The Phase 11 fixture
  (`buildPipeline.ts`) is a single linear chain, so it derives node state from the array index. This
  module has fan-out/fan-in (3 sources, 3 objects, `main.o` bypassing `ar`), so I added a `stage`
  field per node and compute `idle/active/done` from the current step's stage. This stays fully
  within the `pipeline` payload shape — no contract change.
- **`activeId` picks one representative per multi-node stage** (e.g. `main.c` for the sources stage,
  `main.o` for the objects stage), honoring the "exactly one focal element" authoring rule while the
  whole stage shows `active` state.
- No deviations from the prompt's required artifacts/tools/metadata.

## 6. Trace format / API notes
No trace-format change — used the Phase 11 `pipeline` view (`Trace.view = 'pipeline'`,
`Step.pipeline = { nodes, edges }`) exactly as documented in
`docs/TRACE_FORMAT.md § Phase 11 additions — concept views`. No shared interface was touched.

## 7. Known issues / follow-ups
None. (The Vite chunk-size >500 kB warning at build is pre-existing and unrelated to this phase.)

## 8. File map
```
src/content/se200/static-libraries/buildPipeline.ts   (new) — pipeline-view content module
reports/phase-12-static-libraries.md                  (new) — this report
```
