# Phase 11 — Concept-View Model + View Renderers (SOLO engine phase)

## Why this phase exists
Three remaining screens — the **static-library build pipeline**, the **preprocessor before→after**,
and **dual-trace debugging** — are **not live-memory** views. They were deferred in Phase 1 with a
note that a later phase would add an additive `view` discriminator. This is that phase. It builds the
**capability** (the view model + the three data-driven view renderers) so that Phases 12–14 only have
to author **data** and can run in parallel without touching shared code.

This is a **solo** phase that edits the shared trace format and renderer. Run it alone, on its own
branch, and merge it before Wave 2. After it, content authors must not need to touch the engine again.

## Context to read
- `docs/design/SE-ViZ-visual-style-exploration.pdf` screens **07 (build pipeline)**, **08
  (preprocessor)**, **09 (dual-trace debugging)** — the exact targets, plus the legend's `process`
  token treatment.
- `src/engine/trace/types.ts`, `docs/TRACE_FORMAT.md` — the contract you extend additively.
- `src/components/**` — the chrome (`TopBar`, `Transport`, `NarrationBar`), `MemoryCanvas`,
  `Stage`/`PresentationMode`, and the design tokens; the `process` box token already exists.
- `src/content/catalog.ts` (post-refactor auto-discovery) and `validate.ts`.

## Hard constraints
- Frontend only, TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build` pass.
- **Additive only.** A `Trace`/`Step` without a `view` must behave exactly as today (memory view).
  All Phases 0–10 traces remain valid. Reuse the design tokens; no restyle.

## What to build
1. **An additive `view` discriminator.** Let a trace declare its view kind; default (absent) =
   `memory` (today's renderer, unchanged). Add the three new kinds and the minimal typed payloads
   they need on `Step` (all optional/additive, documented in `docs/TRACE_FORMAT.md`):
   - `pipeline` — a left→right graph of **artifact nodes** (solid cards: `.c`, `.o`, `.a`, binary)
     and **process boxes** (dashed: `cc`, `ar`, `ld`) connected by edges; steps reveal/advance
     stages; only the final artifact carries an accent.
   - `before-after` — two code panels (source `before` and translation-unit `after`) bridged by a
     **process box** (`cpp`), with **substitution spans highlighted** reusing the value-changed
     green ("this text was transformed").
   - `dual-trace` — **two synchronized runs side by side** (e.g. buggy vs fixed); steps advance both;
     the **first point of divergence is flagged** and linked. This one may reuse the memory renderer
     per column, or a compact per-step state table — your call, but the divergence marker is required.
2. **A `ConceptStage` renderer** that switches on `view` and renders the right component, while the
   existing chrome (top bar + breadcrumb, transport, step counter, narration, keyboard, presentation
   mode) **works unchanged** for all view kinds. The memory view keeps using its current renderer.
3. **One minimal validation fixture per view kind** (like Phase 1's fixtures) proving each renders and
   steps correctly end-to-end. These are engine fixtures, not curriculum content — small but correct.
   Match the PDF screens 07/08/09.
4. **Extend `validateTrace`** so the new view payloads are checked too (e.g. pipeline edges reference
   existing node ids; dual-trace columns have equal step counts; before/after highlight spans are in
   range) — additive checks that don't break memory traces.
5. **Document the convention** content authors will follow for each view kind in `docs/TRACE_FORMAT.md`
   and add a short note to `docs/CONTENT_AUTHORING.md` so Phases 12–14 can author data with **no
   engine edits**.

## Acceptance criteria
1. `typecheck`/`lint`/`test`/`build` pass; no `any` without justification.
2. `view` is additive: every existing memory trace (Phases 0–10) renders and steps exactly as before;
   omitting `view` = memory.
3. The three view kinds render data-driven and match PDF screens 07/08/09; the shared chrome
   (transport, keyboard, presentation, breadcrumb, narration) works for all of them.
4. One correct minimal fixture per view kind exists and is auto-discovered.
5. `validateTrace` covers the new payloads; the catalog test passes over everything.
6. `docs/TRACE_FORMAT.md` + `docs/CONTENT_AUTHORING.md` document the authoring convention for each
   view kind precisely enough that Phases 12–14 need **zero** engine/renderer edits.

## When done
Write `reports/phase-11-concept-view-model.md`. In §6 document the **exact** `view` payload shapes and
the per-kind authoring convention (this is the contract Wave 2 depends on). Do not start a later phase.
