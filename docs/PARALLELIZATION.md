# Parallelization Plan (how to run the remaining phases)

The remaining work splits into **content** (additive, parallel-safe) and **foundation/polish**
(touches the shared contract — sequential and solo). This plan sequences it to maximize parallelism
without merge conflicts or contract drift.

## The rule that makes parallelism safe
- **Content phases** only create new files under `src/content/<course>/<topic>/`. After the catalog
  refactor (phase 05) the catalog **auto-discovers** these, so content phases edit **no shared
  file**. Several can run at once with zero collisions.
- **Foundation/polish phases** edit shared files (trace format, renderer, chrome). Run them **solo**
  (no other agent running) so the contract everyone builds on stays stable.
- **Every agent runs on its own git branch / worktree.** Never point two agents at the same working
  tree — they will overwrite each other. The reviewer (Claude in Cowork) reviews each branch's
  report + code; you merge them one at a time into `main`.

## Sequencing

```
Phase 04  Recursion ........................ (in flight, solo)        ── must merge first
Phase 05  Catalog refactor (auto-discovery) . solo, quick            ── must merge before Wave 1
─────────────────────────────────────────────────────────────────────
WAVE 1 — content, run in PARALLEL (each its own branch/folder):
  Phase 06  malloc / free — heap ............. src/content/se201/dynamic-memory/
  Phase 07  linked lists .................... src/content/se201/linked-lists/
  Phase 08  stacks & queues ................. src/content/se201/linear-adts/
  Phase 09  hash tables ..................... src/content/se201/hash-tables/
  Phase 10  argc / argv (remaining C) ....... src/content/se200/argc-argv/
  → merge each after review.
─────────────────────────────────────────────────────────────────────
Phase 11  Concept-view model + 3 view renderers . SOLO (engine)      ── must merge before Wave 2
─────────────────────────────────────────────────────────────────────
WAVE 2 — concept-view content, run in PARALLEL (each its own branch/folder):
  Phase 12  static-library build pipeline .... src/content/se200/static-libraries/
  Phase 13  preprocessor before→after ........ src/content/se200/preprocessor/
  Phase 14  debugging dual-trace ............. src/content/se201/debugging/
  → merge each after review.
─────────────────────────────────────────────────────────────────────
Phase 15  Presentation / theming / a11y polish . SOLO, last
(Later) WASM interpreter ...................... separate effort, solo
```

## Why these groupings
- Wave 1 rides on rendering that already exists (Phase 1 `mallocFree`/`linkedList` fixtures proved
  heap, structs, pointers, arrays). Pure content → parallel.
- Concept-views (static libraries, preprocessor, dual-trace) are **non-memory** screens that need an
  additive `view` model + view renderers. Phase 11 builds that capability once (solo); Phases 12–14
  then only author data → parallel.
- Polish touches shared chrome → solo, and best done once the content is stable.

## Dependencies at a glance
- 05 depends on 04 (both touch the catalog/`App`).
- Wave 1 (06–10) depends on 05; the five are independent of each other.
- 11 depends on Wave 1 being merged (solo, clean tree).
- Wave 2 (12–14) depends on 11; the three are independent of each other.
- 15 depends on everything (it polishes the finished surface).

## Review / merge flow (the reviewer's loop, unchanged)
For each branch: agent implements its prompt → writes `reports/<phase>.md` → reviewer checks the
report **and** the code (correctness, `validateTrace`, no shared-file edits) → you merge to `main`.
Run `npm run typecheck && lint && test && build` on the integration branch after each merge.

See `docs/CONTENT_AUTHORING.md` for the per-content rules every Wave 1/2 agent must follow.
