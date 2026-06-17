# Phase 24 Report — Faithful memory segments (static/data region + correct array placement)

## 1. Summary
The memory canvas now models C memory **faithfully**. An additive `Step.staticData`
(`.data` / `.bss` / `.rodata`) introduces a real **static / data segment** that renders as a distinct
violet-toned region with three labeled sub-trays, alongside the Stack and Heap. The three regions are
stacked vertically to echo the **canonical memory map** (Stack on top → Heap → Static at the bottom,
nearest the code/text panel). Two pedagogical errors are fixed: a **stack-local array now renders
inside its owning frame** (stack-toned) instead of being pulled into the data region, and the heap
region is **heap-blocks-only, relabeled "Heap"** (was "Heap & data"). Globals/statics are routed out
of pseudo-frames into the static segment — the two SE 201 hash-table traces now keep `table[N]` in
`.bss`, with its bucket pointers arrowing up into the heap. A new exemplar trace walks one small C
program across **all** regions, backed by a memory-map theory deck. Everything is **additive**: a trace
without `staticData` (e.g. every Phase 0–23 trace) draws no static region and renders as before. All
gates green (typecheck, lint, **221 tests**, build) and the behavior is verified live in the browser.

## 2. What I built
- **Contract (`src/engine/trace/types.ts`)** — `StaticSegment { data: Cell[]; bss: Cell[]; rodata: Cell[] }`
  and additive `Step.staticData?`; additive `Trace.staticLayout?: 'auto' | 'full'` (the "show all three
  sub-trays even when empty" hint). Full TSDoc with `@remarks Added in Phase 24` and the tracer-sync note.
- **Validation (`src/engine/trace/validate.ts`)** — static cells join the step id universe
  (cross-region uniqueness) and the pointer-target check, so pointers resolve **into and out of** any
  sub-segment.
- **Engine participation (`src/engine/pointers.ts`, `src/engine/trace/diff.ts`)** — `indexStep`,
  `collectPointerCells`, `pointersByTarget`, and the diff’s cell index now walk `staticData`, so static
  cells draw arrows, pulse on value change, retarget, and resolve as pointer targets.
- **Renderer**
  - `src/components/memory/MemoryCanvas.tsx` — vertical memory-map layout (Stack → Heap → Static);
    a new **Static** region with `.data` / `.bss` / `.rodata` sub-trays; removed the `arrayCells`
    extraction; relabeled "Heap & data" → "Heap"; grow-direction hints (`grows ↓` / `grows ↑`).
  - `src/components/memory/staticRegion.ts` (new) — pure, testable sub-tray selection helpers.
  - `src/components/memory/StackFrame.tsx` — array locals render fully **in-frame** via `CellView`
    (the compact summary row that punted them to the data region is gone).
  - `src/components/memory/CellView.tsx` — `ArrayCellView` now owns the array’s container anchor +
    active ring (single render site; no split anchor).
  - `src/components/Stage.tsx` — threads `trace.staticLayout` to the canvas.
- **Design system** — `--se-static` (violet; dark + light) + `--color-static`/`--color-static-soft`
  tokens in `src/index.css`; a **"Static / global data"** swatch in `src/components/Legend.tsx`.
- **Globals routed (`src/content/se201/hash-tables/{insert,lookup}.ts`)** — a `liftGlobalsToStatic`
  post-map moves the synthetic `globals` frame’s `table[N]` into `.bss` while leaving every
  hand-verified per-step value untouched.
- **Exemplar content (auto-discovered, new topic `SE 201 · The C Memory Map`)**
  - `src/content/se201/memory-map/segments.ts` — 13-step trace across `.data`/`.bss`/`.rodata`, heap,
    and stack (incl. a local array).
  - `src/content/se201/memory-map/theory.md` — slide-deck on the C memory map.
- **Tests** — `validate.test.ts` (static-segment cases), `staticRegion.test.ts` (tray visibility),
  `pointers.test.ts` + `diff.test.ts` (static cells participate).

## 3. Acceptance criteria — self-assessment
- [x] **Gates green; no unjustified `any`** — `npm run typecheck`, `lint`, `test` (221 pass), `build`
  all clean. No `any` introduced (the only `as` is the pre-existing `step.heap as HeapBlock[]`).
- [x] **`Step.staticData` added (additive, documented); `validateTrace` covers it; existing traces
  unaffected** — see `types.ts` TSDoc; `validate.ts` static-cell uniqueness + pointer resolution;
  the catalog validation test runs `validateTrace` over every trace (all pass, incl. the unchanged ones).
- [x] **Static region with `.data`/`.bss`/`.rodata` sub-trays + a new legend color; regions laid out
  to echo the canonical memory map; arrows/animations intact** — verified live: Static region renders
  all three sub-trays (violet), Legend shows the new swatch, layout is the vertical map, and the
  pointer arrows / danger arrow / value pulses all work across it (see §4).
- [x] **Stack-local arrays render in their frame (stack-toned); heap region is heap-blocks-only and
  relabeled "Heap"; globals routed to the static segment (existing global-using traces updated)** —
  `squares[3]` renders inside `main` in the exemplar; the heap region holds only blocks; the
  hash-table `table[N]` now lives in `.bss` with pointers into the heap.
- [x] **One exemplar segment trace (all regions) + a memory-map theory deck, auto-discovered,
  validating** — `se201-memory-segments` + `theory.md` under `SE 201 · The C Memory Map`; both
  auto-discovered (verified in the sidebar) and the trace passes `validateTrace` (catalog test).

## 4. How to run & verify
```bash
npm install
npm run typecheck && npm run lint && npm test && npm run build
npm run dev   # http://localhost:5173
```
**`validateTrace` coverage** (`src/engine/trace/validate.test.ts › static segment (Phase 24)`):
well-formed static segment incl. a **stack→`.rodata`** pointer and a **`.data`→`.rodata`** pointer;
`activeId` into the static segment; a static id that **duplicates** a frame id (cross-region
uniqueness); a `.data` pointer to a **missing** target; a stack pointer whose static target was
**removed**; and a **staticData-less** trace unaffected. Engine participation is locked by
`pointers.test.ts` (a `.data` pointer → heap block, a stack pointer → `.rodata` cell, `pointersByTarget`
includes static pointers) and `diff.test.ts` (a `.bss` scalar change pulses; an appearing static cell
is "added"). Sub-tray selection is locked by `staticRegion.test.ts`.

**All regions on the exemplar** — open **SE 201 → The C Memory Map → "Memory segments — all regions"**:
- *Step 1 (load)*: Stack "no active frames", Heap "no allocations", **Static shows all three sub-trays**
  — `.data` (`counter = 7` active, `label`), `.bss` (`total = 0`), `.rodata` (`"rows"`) — with `label`’s
  arrow landing on `"rows"`. (Globals exist before `main`.)
- *Steps 2–4*: `n` then the **local array `squares[3]`** appear **inside `main`’s frame**; `malloc`
  adds a heap block and `heap`’s azure arrow lands on it.
- *Steps 5–9*: `squares[i]` (stack) and `heap[i]` (heap) fill in lockstep (green pulses);
  `total = counter + squares[2] = 16` pulses in `.bss`.
- *Step 10 (print)*: console shows `rows = 16`.
- *Step 11 (free)*: heap block goes **freed** (hatched) and `heap` **dangles** (red dashed arrow), while
  stack and static memory are untouched — confirming the danger arrow works in the new layout.

**Globals routed** — open **SE 201 → Hash Tables → "Insert with chaining"** (or "Lookup"): `table[8]`
renders in the **Static `.bss`** tray; bucket pointers arrow **up** into the heap entries; the
owl→dog collision chain renders. **Additive check** — any Phase 0–23 trace (e.g. SE 200 → Hello, World)
shows only Stack + Heap, no static region.

## 5. Key decisions & deviations
- **Vertical memory-map layout (layout trade-off).** The prompt blesses "a vertical memory-map
  arrangement … if it reads better." I stacked the regions **Stack → Heap → Static** to match the
  textbook image (high addresses on top; static nearest the code/text panel). This is the one visible
  change to *existing* traces: previously Stack/Heap sat side-by-side, now they stack. Region **content,
  animations, and arrows are unchanged** (the overlay is anchor-based, so push/pop springs, pulses,
  pointer arrows, the danger arrow, and pointer-arithmetic arcs all still route correctly — verified
  live). I read the "renders identically when `staticData` is absent" clause as *stack/heap semantics
  unaffected*, with the mandated array-placement and "Heap" relabel as the intended exceptions.
- **"se200 array-stack trace" reconciliation.** No SE 200 trace actually places a global in `main`.
  The example conflated two fixes: the **array-mislabel** fix (e.g. `arrayIndexing.ts`’s local `arr`,
  now in-frame via the renderer change — no per-trace edit needed) and the **globals-routing** fix.
  The only traces that represented a file-scope global as a stack entity were the **SE 201 hash-table**
  traces (a synthetic `globals` frame); those are the "existing global-using traces" I updated.
- **Hash-table routing via a `liftGlobalsToStatic` post-map.** Rather than rewrite ~30 hand-verified
  step snapshots, a 6-line transform lifts the `globals` frame’s `table[N]` into `.bss`. `entry_t *table[N]`
  is a zero-initialized global ⇒ `.bss`. This also exercises the new contract well: `.bss` pointer cells
  targeting **heap** blocks.
- **Curriculum placement (flagged, as the prompt requests).** The C memory map spans SE 200 (segments/
  globals fundamentals) and SE 201 (the heap/`malloc`). No existing curriculum topic maps cleanly, and
  every existing topic already owns a `theory.md`. I created a **new topic `The C Memory Map` under the
  real course `SE 201`** (course code **not** fabricated), ordered just before "Introduction to Memory
  Allocation" as its conceptual primer; `covers: ['SE201: Introduction to Memory Allocation']`. If the
  reviewer prefers, the trace’s `topic`/the deck frontmatter can be repointed to an existing topic with
  a one-line change (no shared-file edit).
- **`.rodata "rows"` modeled as a single `const char[5]` cell** (not a 5-char array) to keep the
  static region compact on screen; `label` targets it to demonstrate a pointer into `.rodata`.
- **Render/smoke testing without a DOM.** The test env is `environment: 'node'` (no jsdom; the prompt
  forbids new heavy deps), so the "render/smoke" test targets the pure, extracted tray-selection logic
  (`staticRegion.test.ts`) — sub-trays appear for a static-using step; a `staticData`-less step yields no
  region. Full visual rendering was verified live in the browser (§4) instead of via a DOM test.

## 6. Trace format / API notes
Additive only — every prior trace remains valid and renders identically (no static region drawn).
```ts
interface StaticSegment { data: Cell[]; bss: Cell[]; rodata: Cell[] } // ids stable & unique across the whole step
interface Step  { /* … */ staticData?: StaticSegment }
interface Trace { /* … */ staticLayout?: 'auto' | 'full' } // 'full' = show all three sub-trays even when empty
```
- Cells reuse the scalar/pointer/array/struct union; a stable id (`g@…` / `s@…`) unique across
  frames + heap + static. Pointers may target — and live in — any region including the sub-segments.
- `validateTrace` enforces cross-region id uniqueness and resolvable pointer targets for static cells.
- `MemoryCanvas` gained a `staticLayout?: 'auto' | 'full'` prop (threaded from `Trace.staticLayout`).

## 7. Known issues / follow-ups
- **Backend sync needed (do NOT start here):** the canonical mirror `se-viz-tracer`
  `docs/trace-contract.ts` plus the tracer **mapper** (populate `.data`/`.bss`/`.rodata` for live
  coding) and the **oracle** must be synced to this contract in the backend phase. The tracer repo was
  **not** touched.
- **Inline code values** (the code-panel overlay) resolve against the active **frame** only, so global
  reads/writes don’t show an inline chip on their source line — globals are shown in the static region
  instead. Not a regression; could be extended later if desired.
- **Curriculum topic** for the memory-map lesson is a best-fit new SE 201 topic (see §5) — confirm or
  repoint.
- Pre-existing `build` chunk-size warning (>500 kB) is unchanged and unrelated to this phase.

## 8. File map
```
Changed (engine/contract):
  src/engine/trace/types.ts        + StaticSegment, Step.staticData, Trace.staticLayout
  src/engine/trace/validate.ts     + static cells in id universe & pointer-target checks
  src/engine/pointers.ts           + static cells in indexStep/collectPointerCells/pointersByTarget
  src/engine/trace/diff.ts         + static cells in the diff index
Changed (renderer / design):
  src/components/memory/MemoryCanvas.tsx   memory-map layout, Static region, no arrayCells, "Heap"
  src/components/memory/StackFrame.tsx     array locals render in-frame
  src/components/memory/CellView.tsx       ArrayCellView owns container anchor + active ring
  src/components/Stage.tsx                 thread staticLayout
  src/components/Legend.tsx                Static / global data swatch
  src/index.css                            --se-static / --color-static tokens (dark + light)
Changed (content — globals routed):
  src/content/se201/hash-tables/insert.ts  table[N] → .bss via liftGlobalsToStatic
  src/content/se201/hash-tables/lookup.ts  table[N] → .bss via liftGlobalsToStatic
Added:
  src/components/memory/staticRegion.ts        pure sub-tray selection helpers
  src/components/memory/staticRegion.test.ts   tray-visibility tests
  src/content/se201/memory-map/segments.ts     exemplar all-regions trace
  src/content/se201/memory-map/theory.md       memory-map theory deck
Tests touched:
  src/engine/trace/validate.test.ts  + static-segment suite
  src/engine/pointers.test.ts        + static participation suite
  src/engine/trace/diff.test.ts      + static diff suite
```
