# Phase 05 Report — Catalog Refactor: Auto-Discovery

## 1. Summary

Phase 05 removes the single contention point that would have made the parallel content waves
collide: the hand-maintained registry in `src/content/catalog.ts`. The catalog now **auto-discovers**
content modules from the filesystem with Vite `import.meta.glob` (eager). A content file registers
itself **just by existing** under `src/content/<course>/<topic>/<module>.ts` (or `fixtures/*.ts`) and
following one rule — `export default` a `ContentModule`. Grouping (course → topic) is read from each
trace's own breadcrumb metadata; ordering is deterministic (explicit course rank → topic min-order →
module order → label), independent of glob order. The discovered tree **exactly reproduces** the
previous hand-maintained catalog (same courses, topics, module order, and the Engine-fixtures
bucket). All four gates pass (`typecheck`, `lint`, `test` — 43 across 6 files, `build`), no `any`,
and Phases 0–4 traces remain valid. Content phases 06–15 can now run in parallel with **zero** edits
to any shared file.

## 2. What I built

- **`src/content/module.ts`** (new) — the `ContentModule` contract: `{ trace, summary, label?,
  order?, course?, topic? }`. This is the single registration interface content authors implement.
- **`src/content/catalog.ts`** (rewritten) — `import.meta.glob` discovery, group-by-course→topic
  from trace metadata, deterministic sort, and a `COURSE_META` map for course titles/rank. Keeps the
  same public surface: `CATALOG: readonly CatalogCourse[]`, `CatalogCourse`/`CatalogTopic`/
  `CatalogModule` types, `allCatalogTraces()`, `allCatalogModules()` — so `App.tsx` and
  `ContentSidebar.tsx` are **unchanged**.
- **19 content modules migrated** — each now `export default`s a `ContentModule` (the `label`/
  `summary`/`order` moved out of the central catalog into the file they describe). The three engine
  fixtures additionally set `course: 'Engine fixtures'` / `topic: 'Renderer primitives'` to keep
  their existing bucket. Files: all of `src/content/se200/**` (16) + `src/content/fixtures/{linkedList,
  pointerArith,mallocFree}.ts` (3).
- **`src/content/fixtures/index.ts`** (deleted) — the only consumer was the old catalog; its
  `FIXTURES`/`FixtureEntry` exports were unused by the app.
- **Docs** — `docs/TRACE_FORMAT.md § Content catalog` and `docs/CONTENT_AUTHORING.md` now document
  the exact export convention; `README.md` roadmap regrouped to the wave plan (05 refactor; 06–10
  Wave 1; 11 concept-view model; 12–14 Wave 2; 15 polish).

## 3. Acceptance criteria — self-assessment

- [x] **`typecheck`, `lint`, `test`, `build` pass; no `any` without justification.** All four green
  (see §4). No `any` introduced — the glob is typed `import.meta.glob<{ default: ContentModule }>`.
- [x] **Adding a new file under `src/content/<course>/<topic>/` that follows the convention makes it
  appear with no edit to any shared file.** Demonstrated: I created a throwaway
  `src/content/se201/__demo/demo.ts` default-exporting a `ContentModule`; with no other edit it
  appeared as a new `SE 201 → Demo topic` entry, and `catalog.test.ts` automatically validated its
  trace (per-trace count rose to 23). Removed afterward; final tree is clean.
- [x] **All existing modules still discovered, grouped by course→topic, ordered deterministically.**
  The discovered tree matches the old catalog one-for-one: SE 200 in curriculum order (Hello World →
  … → Recursion) and the three fixtures under Engine fixtures. (See §4 for the printed tree.)
- [x] **`validateTrace` runs over the auto-discovered catalog in `catalog.test.ts` and passes.** The
  test iterates `allCatalogTraces()`, which now returns the discovered set — **no test edit needed
  per phase**. 43/43 pass.
- [x] **The convention is documented in `docs/TRACE_FORMAT.md` and `docs/CONTENT_AUTHORING.md`; the
  README roadmap is updated.** Done (§2).
- [x] **Any new field (`order`) is additive and leaves Phases 0–4 traces valid.** `order` is optional
  on `ContentModule` (not on `Trace` at all); modules without it sort last within their topic. No
  `Trace` field changed.

## 4. How to run & verify

```
npm ci          # if needed
npm run typecheck   # ✓ clean
npm run lint        # ✓ clean
npm run test        # ✓ 6 files, 43 tests (catalog.test.ts validates every discovered trace)
npm run build       # ✓ built
npm run dev         # workbench at http://localhost:5173 — sidebar lists the same modules as before
```

Discovered catalog tree (printed via a throwaway probe during development, since Vitest swallows
`console.log`):

```
SE 200 — C Programming I
  • Hello, World → Hello, World
  • Variables, if, else, while → Variables & control flow
  • Functions and Nested Loops → Functions: call & return; Nested loops
  • More Functions, More Nested Loops → Function inside nested loops
  • Pointers, Arrays and Strings → Pointer basics; Array indexing; Strings
  • More Pointers, Arrays and Strings → Pass-by-pointer (swap); Walking a string (strlen)
  • Even More Pointers, Arrays and Strings → Pointer to pointer; strcpy (two pointers)
  • Recursion → factorial(n); sum_to(n); Reverse a string; fibonacci(n)
Engine fixtures — Phase 0–1 validation traces
  • Renderer primitives → Linked-list traversal; Pointer arithmetic; malloc / free
```

This is identical to the order the hand-maintained catalog produced.

## 5. Key decisions & deviations

- **Engine fixtures kept as their own bucket (not folded by metadata).** The fixture traces carry
  illustrative `course`/`topic` (`SE 201 · Linked lists`, `SE 201 · Dynamic memory`, `SE 200 ·
  Pointers`). Grouping strictly by those would scatter them — and drop two of them straight into the
  SE 201 topics Wave 1 is about to author for real, plus a near-duplicate "Pointers" topic in SE 200.
  The prompt explicitly allows either; I used the `ContentModule.course`/`.topic` overrides to keep
  the three under "Engine fixtures" exactly as before. Curriculum content never sets these overrides.
- **Topic labels are now sourced from trace metadata.** One cosmetic change falls out of grouping by
  metadata: the Variables topic header now reads **"Variables, if, else, while"** (the trace's
  `topic`) instead of the old hand-typed **"Variables, if / else, while"**. This is correct-by-spec
  (single source of truth) and I left it as-is rather than special-casing.
- **`order` semantics.** I encoded `order ≈ 10 × curriculum week` with a unit digit to order modules
  within a week, so the current order is reproduced exactly and Wave authors can just set their week.
- **Discovery fails loud.** Any `*.ts` in a discovered folder lacking a default `ContentModule`
  throws a clear error at catalog load (naming the path), rather than silently dropping or crashing
  obscurely. Helpers must live outside topic folders. Documented in both docs.
- **`fixtures/index.ts` deleted** (not just excluded from the glob) — it was dead code after the
  rewrite (only the old catalog imported it). The individual fixture files keep their **named** trace
  exports (`linkedListTrace`, `mallocFreeTrace`), which `pointers.test.ts`/`pulse.test.ts` import.

## 6. Trace format / API notes

**No `Trace` change.** The trace format is untouched. The new shared interface is `ContentModule`
(`src/content/module.ts`) — the contract every content file default-exports:

```ts
interface ContentModule {
  trace: Trace;       // grouping read from trace.course / trace.topic
  summary: string;    // required; sidebar tooltip
  label?: string;     // defaults to trace.title
  order?: number;     // ordering hint (≈ 10 × week); additive
  course?: string;    // grouping override (engine-fixtures bucket only)
  topic?: string;     // grouping override
}
```

Catalog output types (`CatalogCourse`/`CatalogTopic`/`CatalogModule`) and the functions
`allCatalogTraces()` / `allCatalogModules()` are unchanged, so all downstream consumers and tests
keep working without edits.

## 7. Known issues / follow-ups

- **`COURSE_META` is the one curated shared map.** Adding a brand-new course code shows it (title
  falls back to the code, sorted after known courses), but giving it a nice title + explicit rank
  needs a one-line entry there. SE 200 / SE 201 / Engine fixtures are already present, so Waves 1–2
  need no edit. Documented in `catalog.ts` and `TRACE_FORMAT.md`.
- **Glob scope is two patterns** (`./*/*/*.ts`, `./fixtures/*.ts`). Deeper nesting (a
  `<course>/<topic>/<sub>/x.ts`) would not be discovered — content is expected to be exactly
  course/topic/module deep, which matches `docs/CONTENT_AUTHORING.md`.
- The `phase0/` scratch traces remain undiscovered by design (two segments, not matched), exactly as
  before.

## 8. File map

```
src/content/
  module.ts                         # NEW — ContentModule contract
  catalog.ts                        # REWRITTEN — import.meta.glob auto-discovery + grouping/sort
  fixtures/
    index.ts                        # DELETED — dead after rewrite
    linkedList.ts                   # + default ContentModule (Engine fixtures bucket)
    pointerArith.ts                 # + default ContentModule
    mallocFree.ts                   # + default ContentModule
  se200/**/*.ts                     # 16 modules: + default ContentModule (label/summary/order)
docs/
  TRACE_FORMAT.md                   # § Content catalog — documents auto-discovery + convention
  CONTENT_AUTHORING.md              # concrete export convention example
README.md                           # roadmap regrouped to the wave plan
reports/
  phase-05-catalog-refactor.md      # this file
```
