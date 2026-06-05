# Phase 1 — The Engine: Memory Renderer, Transport, Design System, Presentation Shell

## Your role and context
You are Claude Code, implementing **SE-Viz**. Phase 0 is complete and committed: the trace
format (`src/engine/trace/types.ts`), the step differ (`diff.ts`), the player hook
(`useTrace.ts`), a hand-authored `add`/`main` slice, and a minimal renderer that draws stack
frames only. Read these before starting:
- `README.md` and `docs/CURRICULUM.md` — product + concept coverage.
- `docs/TRACE_FORMAT.md` and `src/engine/trace/*` — the existing contract you build on.
- `reports/phase-00-scaffold.md` — what already exists and the conventions used.
- **`docs/design/DESIGN_SPEC.md`, `docs/design/VISUAL_COVERAGE.md`, and
  `docs/design/SE-ViZ-visual-style-exploration.pdf`** — the **locked** visual design. The PDF's
  nine screens are the target; match them. This phase is where that design becomes real.

Phase 1 turns the Phase 0 foundation into the **generic engine** every later content phase
plugs into. You are NOT building the full curriculum here — you are building the engine and
renderer that can express *all* of it, and proving it against a small set of validation
fixtures. Keep the trace format contract stable: **extend it additively, never reshape it**, and
document any addition in `docs/TRACE_FORMAT.md`.

## Hard constraints (unchanged from Phase 0)
- **Frontend only.** No backend, no network at runtime.
- **Traces-first.** No C interpreter/compiler. All execution is hand-authored trace data.
- React + TypeScript (strict) + Tailwind + Framer Motion + Vite. **No `any`** without a
  commented justification (ESLint enforces this — keep it passing).
- `npm run typecheck`, `lint`, `test`, and `build` must all pass at the end.

## The locked design system — implement it as the foundation
Everything below comes from `docs/design/DESIGN_SPEC.md` and the PDF. Encode it ONCE as reusable
tokens (CSS variables + Tailwind theme), because every content phase depends on it.

- **Aesthetic:** IDE-grade, calm, flat. No gradients, no glow, no drop shadows. Hairline (~1px)
  borders, 8–12px radii, generous whitespace. **Dark is primary**, with a working **light
  variant** behind a toggle. Every color must read in both.
- **Typography:** **JetBrains Mono** for everything technical (code, values, types, addresses);
  a clean sans (**Manrope** or similar) for chrome/narration. **Ligatures OFF in the code panel**
  (`font-variant-ligatures: none`) — beginners must see literal `->`, `!=`, `<=`, `++`, not
  `→ ≠ ≤`. Sentence case; no ALL CAPS except small section labels as in the design.
- **Semantic color (this is law, not decoration) — define as named tokens:**
  - `pointer` → **azure**. Pointer cells, `next`/`prev` links, every connector arrow.
  - `heap` → **teal**. Heap-allocated blocks/nodes; carry an address header.
  - `stack` → **neutral/desaturated**. Frames and scalar locals recede.
  - `active` → **amber** ring + badge. Exactly one element is current per step.
  - `value-changed` → a single **green** pulse that fades.
  - `process` → **dashed neutral** box (hash fn, pipeline stage, preprocessor) — reads as
    "process," not memory. (Type only this phase; concept-views are a later phase — see non-goals.)
  - **Allocation states (heap):** `allocated` (teal), `freed` (desaturated + hatched),
    `dangling` (a pointer aimed at a freed block — flagged **red**, UB), `leaked` (warning
    marker, no incoming arrow).
- Build a reusable **swatch legend** component from these tokens (matches PDF page 11).

## What to build

### A. Full memory renderer (the core deliverable)
Replace the Phase 0 placeholder `MemoryCanvas` with a renderer that draws **every `Cell` kind and
heap block**, styled per the design system:
- **Scalar** cells — name, muted type, value, tiny address; **green pulse** when the value
  changed this step (drive from `diffSteps`).
- **Pointer** cells — show the held address; **draw an arrow** from the pointer to its target
  (cell or heap block) resolved **by stable id**. `NULL`/`null` targets render as a `NULL` sink,
  not an arrow.
- **Array** cells — contiguous cells with **shared borders** (no gaps), index labels, ascending
  addresses; support the **pointer-arithmetic** visual (a pointer sitting on an element, an
  offset annotation). Strings = `char` arrays with a visible `\0`.
- **Struct** cells — a node box of field cells (linked-list node, hash entry), with its own
  address header when heap-allocated.
- **Heap blocks** — drawn in a distinct heap region with the **four allocation states** visually
  distinct as specified above.
- **Stack region** — keep the bottom-first model; render top-of-stack visually on top (as Phase 0
  does). Frame `spring` push on call, spring pop on return; reversible on step-back.

**Pointer arrows — architecture guidance.** Use an **SVG overlay** layered over the memory DOM.
Each cell/block registers its on-screen rect (refs + `useLayoutEffect`/`ResizeObserver`,
measured relative to the canvas); the overlay resolves each pointer's `target` id to that rect
and draws a path from the pointer's anchor to the target's anchor. On **retarget** (from
`diffSteps.pointersRetargeted`), animate the arrowhead/path from old target to new (~250ms). Make
this robust to layout changes (window resize, frame push/pop). This is the hardest part of the
phase — design it cleanly; later phases lean on it heavily.

### B. Diff-driven animation
Phase 0 computes `diffSteps` but doesn't consume it. Wire it in: frame push/pop, **value-changed
green pulse**, and **pointer retarget glide** all derive from the diff between the previous and
current step. All transitions must **reverse correctly on step-back** (~250ms springs, physical
not bouncy).

### C. Full transport / player
Extend `useTrace` + controls to the complete set:
- **Step forward / back / reset**, **play / pause autoplay**, a **scrub bar**, and a **speed**
  control. A `Step k / N` readout and the progress dots from the design.
- **Keyboard navigation:** `←`/`→` step, `Space` play/pause, `Home`/`End` to ends. Document the
  bindings.
- Autoplay advances on a timer at the chosen speed and stops at the end. Keep the hook pure/
  testable (timer logic separable from React where reasonable).

### D. The chrome + layout shell
Assemble the full screen from the PDF:
- **Top bar:** SE-Viz mark, a **breadcrumb** (course · topic · file), the `Step k / N` readout,
  and transport controls. **Breadcrumb/course/topic/file come from the trace's metadata, sourced
  from `docs/CURRICULUM.md` — never fabricate a course code** (the design exploration wrongly
  invented "SE 220"; static libraries is SE 200). Add additive optional metadata fields to the
  `Trace` type for this (e.g. `course`, `topic`, `file`) and document them.
- **Code panel** (left): the source, current line(s) highlighted, line numbers, ligatures off.
- **Memory panel** (right): the renderer from (A).
- **Narration bar** (bottom): the current step's narration, styled per design.
- **Console / output panel:** several screens (e.g. malloc/free) show stdout + a heap-watch.
  Add an **additive optional** per-step output model to the trace format (e.g. `Step.stdout?` and
  optional heap-watch warnings) and render a console panel when present. Document the addition.

### E. Presentation / fullscreen mode
A fullscreen, keyboard-driven mode with larger type for projecting in class: hides editing chrome,
keeps the three panels + transport, `←`/`→` to step. This is the PowerPoint-replacement surface.

### F. Validation fixtures (prove the engine — minimal, not full content)
Author a SMALL set of hand-written, **known-correct** traces that together exercise every
primitive the renderer supports, each matching its design screen. Required:
1. **Recursion** — extend/replace the Phase 0 slice into `factorial(4)` (PDF screen 01): nested
   frames, per-frame `n` + return, base-case green pulse, descending stack addresses.
2. **Linked-list traversal** (PDF screen 02): struct nodes in the heap, `head`/`current`
   pointers, azure `next` arrows, `current` retarget animation, `NULL` sink.
3. **Pointer arithmetic over an array** (PDF screen 03): contiguous `int[5]`, a pointer `p`,
   `*(p+2)` with the byte-offset annotation and the correct address math.
4. **malloc / free** (PDF screen 04): heap blocks in all four allocation states, the dangling red
   arrow, the leaked block with no incoming arrow, and the console/heap-watch panel.

These are **engine validation fixtures**, not polished curriculum modules — keep them minimal but
correct. They live under `src/content/` (e.g. `src/content/fixtures/`). Every value, address, and
step must be verifiably correct (these are teaching artifacts).

If a simple route/switcher is needed to view the four fixtures, a minimal one is fine; a full
course→week→project navigation shell is NOT this phase.

## Non-goals for Phase 1 (do NOT build)
- No hash table, stack/queue, static-library, preprocessor, or debugging content. (Hash table /
  stack-queue are content for later phases; the renderer should already be *capable* of them.)
- **No concept-view (non-memory) rendering** — the build-pipeline, preprocessor before→after, and
  dual-trace screens need a different view model. Do not bolt it on now; note in the report that a
  later phase will add an additive `view` discriminator. Just define the `process`-box token.
- No interpreter. No full curriculum navigation shell. No persistence/back end.

## Acceptance criteria (the reviewer will check these against the code)
1. `npm run typecheck`, `lint`, `test`, `build` all pass; no `any` without justification.
2. The design system is implemented as reusable tokens; the **light/dark toggle works** and both
   read correctly; **code-panel ligatures are off** (verify `->`, `!=`, `<=` render literally).
3. The renderer draws all four `Cell` kinds **and** heap blocks; the **four allocation states are
   visually distinct** and match the design (azure/teal/neutral/amber/green/red used semantically).
4. **Pointer arrows** are drawn from pointer cells to targets by id, handle `NULL`, and **animate
   on retarget**; they survive window resize and frame push/pop.
5. Transport is complete: step f/b, **play/pause autoplay**, **scrub**, **speed**, **keyboard**
   (`←`/`→`/`Space`/`Home`/`End`), and `Step k / N`. Step-back reverses animations.
6. Value changes show the **green pulse**, driven by `diffSteps` (not hard-coded per fixture).
7. The chrome matches the design: top bar + **breadcrumb sourced from trace metadata (no invented
   course codes)**, code panel with line highlight, narration bar, and a **console panel** for the
   malloc fixture.
8. **Presentation/fullscreen mode** works and is keyboard-navigable.
9. All four validation fixtures render correctly and match their PDF screens; hovering cells,
   nodes, and frames reveals detail (type/value/address).
10. The trace-format additions (metadata fields, per-step output) are **additive**, keep Phase 0
    traces valid, and are documented in `docs/TRACE_FORMAT.md`.
11. New engine logic has tests (e.g. autoplay/advance behavior, pointer target resolution,
    diff→pulse selection) — extend the Vitest suite beyond Phase 0's two tests.

## When done
Write your report to `reports/phase-01-engine.md` using `reports/TEMPLATE.md`. In §5 call out any
deviations loudly; in §6 document the exact trace-format additions (metadata + output) so later
phases and the reviewer can rely on them. Do not start a later phase.
