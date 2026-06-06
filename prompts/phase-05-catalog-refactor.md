# Phase 05 — Catalog Refactor: Auto-Discovery (prep for parallel content)

## Why this phase exists
Several content phases are about to run **in parallel**. Today every content phase appends to the
single `src/content/catalog.ts`, which would cause constant merge conflicts. This phase removes that
contention point by making the catalog **auto-discover** content modules from the filesystem, so a
new content module registers itself **just by existing in the right folder** — no shared-file edit.

This is a **solo** phase. It must merge **after** Phase 04 (recursion) and **before** the parallel
content wave (Phases 06–10).

## Context to read
- `src/content/catalog.ts`, `src/content/fixtures/*`, `src/content/se200/*` — current structure.
- `src/engine/trace/types.ts`, `src/engine/trace/validate.ts`, `src/content/catalog.test.ts`.
- `src/App.tsx` / `src/components/ContentSidebar.tsx` — the catalog consumers.
- `docs/CONTENT_AUTHORING.md`, `docs/PARALLELIZATION.md` — the workflow this enables.

## Hard constraints
- Frontend only, TS strict, no `any` without justification. `typecheck`, `lint`, `test`, `build`
  pass at the end. Do not restyle the design or reshape the trace format (the `Trace` type already
  carries `course`/`topic`/`file`).

## What to build
1. **Auto-discovery catalog.** Replace the hand-maintained registry in `catalog.ts` with Vite
   `import.meta.glob` (eager) discovery of content modules, e.g. glob
   `./<course>/<topic>/<module>.ts` (and the existing `fixtures/`). Define one **clear export
   convention** a module file must follow to be discovered (e.g. a named export of its `Trace`, or a
   default-exported module descriptor). Document the convention in `docs/TRACE_FORMAT.md` and
   `docs/CONTENT_AUTHORING.md` so content authors know the one rule.
2. **Grouping & ordering.** Group discovered modules by `course` → `topic` (from each `Trace`'s
   metadata) for the sidebar. Sort deterministically: prefer an explicit optional `order` (curriculum
   week) falling back to a stable sort by topic/title, so ordering doesn't depend on glob order. If
   you add an optional `order` field it must be **additive** and documented.
3. **Folder normalization.** Establish `src/content/<course>/<topic>/` as the home for all content
   (e.g. `se200/`, `se201/`). Keep the engine **fixtures** discoverable as their own group (so the
   four Phase 1 fixtures still show), or fold them in — your call, but the four must remain visible.
4. **Consumers unchanged in behavior.** `App.tsx` / `ContentSidebar.tsx` read the grouped catalog as
   before; the UI still lists every module, grouped by topic. No design changes.
5. **Validation still global.** `catalog.test.ts` must run `validateTrace` over the **auto-discovered**
   set, so every current and future module is checked with no test edits per phase.
6. **Update the roadmap.** Update the `README.md` roadmap table to the regrouped plan in
   `docs/PARALLELIZATION.md` (05 refactor; 06–10 content wave; 11 concept-view model; 12–14
   concept-views; 15 polish). This is the one intentional shared-doc edit; it happens here, solo.

## Acceptance criteria
1. `typecheck`, `lint`, `test`, `build` pass; no `any` without justification.
2. Adding a new file under `src/content/<course>/<topic>/` that follows the documented export
   convention makes it appear in the catalog and the sidebar **with no edit to any shared file**
   (`catalog.ts`, `App.tsx`, tests, types). Demonstrate this in the report (e.g. describe adding a
   throwaway module and seeing it appear, then removing it).
3. All existing modules (Phase 2/3 content + the four engine fixtures + recursion from Phase 04) are
   still discovered, grouped by course→topic, ordered deterministically.
4. `validateTrace` runs over the auto-discovered catalog in `catalog.test.ts` and passes.
5. The discovery/export convention is documented in `docs/TRACE_FORMAT.md` and
   `docs/CONTENT_AUTHORING.md`; the README roadmap is updated.
6. Any new field (e.g. `order`) is additive and leaves Phases 0–4 traces valid.

## When done
Write `reports/phase-05-catalog-refactor.md` from the template. In §2/§3 document the **exact
export convention** content authors must follow (this is the contract the whole parallel wave
depends on — be precise). Do not start a later phase.
