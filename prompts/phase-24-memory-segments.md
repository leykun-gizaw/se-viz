# Phase 24 — Faithful memory segments: a static/data region (.data/.bss/.rodata) + correct array placement

## Your role and context
You are Claude Code, implementing **SE-Viz** (the frontend). Read first: `README.md`,
`docs/TRACE_FORMAT.md`, `docs/CONTENT_AUTHORING.md`, `src/engine/trace/types.ts`,
`src/engine/trace/validate.ts`, `src/components/memory/MemoryCanvas.tsx`,
`src/components/memory/StackFrame.tsx`, `src/components/Legend.tsx`, and the design tokens/colors.

Today the memory canvas shows only **two** regions — Stack and Heap — and the heap region is
mislabeled **"Heap & data"**, into which stack-local **array** contents are expanded. That is
pedagogically wrong: C memory has more regions than two, and a *local array lives on the stack*, not
the heap. SE 200 / SE 201 teaches the full memory layout explicitly, so this phase makes the
visualization model it **faithfully**.

**Goal:** introduce a real **static/data segment** with the three textbook sub-segments — **`.data`**
(initialized / nonzero globals & statics), **`.bss`** (zero / uninitialized globals & statics),
**`.rodata`** (read-only: string literals, `const`) — as a distinct region alongside Stack and Heap;
**route globals/statics there** (stop folding them into `main`); **fix stack-array placement** so a
local array reads as stack; and **lay the regions out to echo the canonical memory map** so the
distinctions are spatially legible. The **code editor IS the text/code segment** — do not draw a
separate empty "text" box.

This phase is the **frontend foundation + one exemplar lesson**. The backend mapper that populates
these segments for live-coding is a **separate later effort** (a spike + mapper in `se-viz-tracer`).
**Do not touch the tracer repo here** — just make the contract change cleanly so its mirror can follow.

> Note: this is the *substance* of the segments feature (a correctness/pedagogy change), NOT the
> general "UI polish/robustness" pass — that is permanently out of scope. Layout work here is in
> scope only insofar as it makes the segments faithful and legible.

## The contract change (additive, documented)
In `src/engine/trace/types.ts` (the canonical contract):
- Add optional **`Step.staticData?: StaticSegment`**.
- **`StaticSegment = { data: Cell[]; bss: Cell[]; rodata: Cell[] }`** — three sub-segments, each a
  list of existing `Cell`s (reuse the scalar/pointer/array/struct union, so a stack pointer can target
  a `.rodata` string, a `.data` global can be a struct, etc.). Each cell keeps a **stable id across
  steps** (e.g. `g@<addr>` / `s@<name>`), like frames and heap blocks.
- Document it in the file's JSDoc style with `@remarks Added in Phase 24`, stating it's **additive**
  (traces without it are unchanged) and that the **canonical mirror** in `se-viz-tracer`
  `docs/trace-contract.ts` plus the tracer mapper/oracle must be synced in the backend phase (note
  it; don't edit the tracer).
- Update **`validateTrace`**: validate `staticData` when present — ids unique across the whole step
  (frames/heap/static), cells well-formed, and **pointer targets resolvable to any region including
  the static sub-segments**.

## Renderer
- Add a **Static** region to `MemoryCanvas.tsx` with three clearly-labeled sub-trays — **`.data`**,
  **`.bss`**, **`.rodata`**. Render a sub-tray when it has cells; allow a hint (like the existing
  `heapLayout` prop) to **show all three even when empty** so a *memory-layout lesson* can teach the
  full map — default elsewhere to "non-empty only."
- A **new semantic color** for the static segment, distinct from the existing
  azure(pointers)/teal(heap)/neutral(stack)/amber(active)/green(value-changed)/red(dangling). Add it
  to the design tokens and to `Legend.tsx`. Preserve "color = meaning."
- **Lay the regions out to echo the canonical memory map** so relative position teaches the real
  layout (text/code = the code panel → static segments → heap "grows up" → stack). A vertical
  memory-map arrangement is acceptable if it reads better. **Keep the SVG arrow overlay, frame
  push/pop springs, value pulses, and pointer arrows all working** across the new layout.

## Fix the array mislabel
- A **stack-local array** must read as stack: render its cells **under/within its owning stack frame**
  (stack-toned), NOT in the heap/data region. Remove the logic in `MemoryCanvas.tsx` that pulls
  `kind === 'array'` cells out of frames into the heap region (`arrayCells`). The heap region renders
  **heap blocks only**. (A heap-allocated array — cells inside a `HeapBlock` — stays in the heap,
  correctly.)
- **Relabel the heap region to just "Heap"** (no "& data").

## Route globals to the static segment
- Authored traces currently place file-scope globals in the `main` frame. In this phase **authored
  content places globals/statics into `staticData`**: `.data` if nonzero-initialized, `.bss` if
  zero/uninitialized, `.rodata` if `const` / a string literal. **Update any existing authored trace
  that puts globals in `main`** (e.g. the se200 array-stack trace) to use the new region. (The tracer
  mapper's matching change is the backend phase.)

## Exemplar content (prove it end-to-end)
- Author **one memory-layout teaching trace**: a small, complete C program that exercises **all**
  regions — a nonzero-initialized global (→ `.data`), a zero/uninitialized global (→ `.bss`), a
  string literal and/or `const` (→ `.rodata`), a `malloc` (→ heap), and locals including a **local
  array** (→ stack). Step through it so the learner watches each datum appear in its correct region as
  the program runs; the narration names the segment each lives in and why (lifetime, mutability).
- Add a short **theory deck** (one `theory.md`, slide-deck format) on the C memory map:
  text/`.data`/`.bss`/`.rodata`/heap/stack — what goes where and why. Place it under the correct
  course/topic per `docs/CURRICULUM.md`; **never fabricate a course code** — if the topic mapping is
  ambiguous, pick the best fit and flag it in the report.
- Follow auto-discovery: add files under `src/content/...` per the `ContentModule` default-export
  contract; do not edit shared catalog/renderer files beyond the additive `types.ts`/`validate.ts`
  change.

## Constraints
- React + TS strict, no unjustified `any`; `typecheck`/`lint`/`test`/`build` green. No new heavy deps;
  keep the hand-rolled markdown/SVG conventions. **Additive:** every existing trace must still
  validate and render **identically** when `staticData` is absent (stack+heap unaffected).
- **Do not touch the `se-viz-tracer` repo.** Note in the report that its `docs/trace-contract.ts`
  mirror + mapper + oracle need syncing in the backend phase.

## Tests
- `validateTrace` unit tests for `staticData`: valid shapes, bad ids, pointer targets into each
  sub-segment, absence (existing traces unchanged).
- A render/smoke test that the Static region + its three sub-trays appear for a trace that uses them,
  and that a `staticData`-less trace renders exactly as before.
- The exemplar trace passes `validateTrace` and places each datum in the correct region.

## Acceptance criteria
1. Gates green; no unjustified `any`.
2. `Step.staticData` added (additive, documented); `validateTrace` covers it; existing traces
   unaffected.
3. Static region with `.data`/`.bss`/`.rodata` sub-trays + a new legend color; regions laid out to
   echo the canonical memory map; arrows/animations intact.
4. Stack-local arrays render in their frame (stack-toned); heap region is heap-blocks-only and
   relabeled "Heap"; globals routed to the static segment (existing global-using traces updated).
5. One exemplar segment trace (all regions) + a memory-map theory deck, auto-discovered, validating.

## When done
Write `reports/phase-24-memory-segments.md` from `reports/TEMPLATE.md`. In §4 show `validateTrace`
coverage and describe all regions rendering on the exemplar. In §5 flag the tracer
contract-mirror + mapper + oracle sync needed next, the `docs/CURRICULUM.md` topic you placed the
lesson under, and any layout trade-offs. **Do not start the backend work.**
