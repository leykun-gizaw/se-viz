# Phase 1 Report — The Engine: Memory Renderer, Transport, Design System, Presentation Shell

## 1. Summary

Phase 1 turns the Phase 0 foundation into the **generic engine** every later content phase plugs
into. The locked design system (from `docs/design/DESIGN_SPEC.md` and the 9-screen PDF) is now real:
encoded once as CSS tokens with a working **dark/light toggle**, JetBrains Mono + Manrope (bundled,
no runtime network), and **ligatures off** in the code panel. The memory renderer draws all four
`Cell` kinds plus heap blocks with the four allocation states, and an **SVG overlay** draws pointer
arrows resolved by stable id — azure for live targets, **red dashed for dangling/UB**, a NULL sink
for null, and a labeled arc for pointer arithmetic. Animations (frame push/pop springs, the green
value pulse, the pointer-retarget glide) are all **derived from `diffSteps`**, so they reverse on
step-back. Transport is complete — step f/b, **play/pause autoplay**, **scrub**, **speed**, and full
**keyboard** control — and a keyboard-driven **presentation/fullscreen mode** is the
PowerPoint-replacement surface. Four hand-authored, verifiably-correct validation fixtures
(recursion, linked-list, pointer arithmetic, malloc/free) exercise every primitive and match their
PDF screens; a minimal tab switcher moves between them. The trace format was extended **additively**
(Phase 0 traces still valid) and documented. `typecheck`, `lint`, `test` (14 tests), and `build` all
pass; Prettier clean; no `any`.

## 2. What I built

**Design system** — [`src/index.css`](../src/index.css): `--se-*` semantic tokens for dark (primary)
and light, mapped through Tailwind v4 `@theme inline` so utilities (`bg-surface`, `text-pointer`,
`font-mono`…) re-theme on `data-theme`. `.se-code` disables ligatures. Bundled fonts via
`@fontsource/*` ([`main.tsx`](../src/main.tsx)); dark first-paint guard in
[`index.html`](../index.html). Reusable **[`Legend`](../src/components/Legend.tsx)** (matches PDF p.11).

**Engine** —
- [`engine/autoplay.ts`](../src/engine/autoplay.ts): pure `autoplayTick` + speed table.
- [`engine/trace/useTrace.ts`](../src/engine/trace/useTrace.ts): extended with autoplay/play/pause/
  speed (timer effect wraps the pure tick); Phase 0 API preserved.
- [`engine/anchorContext.ts`](../src/engine/anchorContext.ts) + [`engine/anchors.tsx`](../src/engine/anchors.tsx):
  anchor registry (refs + ResizeObserver + rAF "pulse" re-measure) for arrow targeting by id.
- [`engine/pointers.ts`](../src/engine/pointers.ts): pure pointer resolution + danger detection +
  `pointersByTarget`.
- [`engine/trace/diff.ts`](../src/engine/trace/diff.ts): added `pulsedCellIds` / `retargetedPointerIds`.
- [`engine/highlightC.ts`](../src/engine/highlightC.ts): tiny C tokenizer for the code panel.

**Memory renderer** ([`src/components/memory/`](../src/components/memory/)) — `CellView` (scalar,
pointer, array, struct), `StackFrame` (spring push/pop, hover tooltip, array-summary rows),
`HeapBlockView` (four allocation states), `ArrowOverlay` (SVG arrows/NULL sink/danger/arith arc with
animated `d`), `MemoryCanvas` (regions + overlay + render context + spring re-measure pulse),
`renderContext.ts`.

**Chrome** — [`TopBar`](../src/components/TopBar.tsx) (mark + curriculum breadcrumb + transport +
theme/presentation toggles), [`Transport`](../src/components/Transport.tsx) (icons, scrub, speed,
`Step k / N`), [`CodePanel`](../src/components/CodePanel.tsx) (highlight + line numbers + ligatures
off), [`NarrationBar`](../src/components/NarrationBar.tsx) (+ progress dots),
[`ConsolePanel`](../src/components/ConsolePanel.tsx), [`Tooltip`](../src/components/Tooltip.tsx),
[`Stage`](../src/components/Stage.tsx), [`PresentationMode`](../src/components/PresentationMode.tsx),
[`App`](../src/App.tsx) (fixture switcher + legend toggle). Hooks:
[`useTheme`](../src/hooks/useTheme.ts), [`useKeyboardControls`](../src/hooks/useKeyboardControls.ts).

**Fixtures** ([`src/content/fixtures/`](../src/content/fixtures/)) — `factorial.ts`, `linkedList.ts`,
`pointerArith.ts`, `mallocFree.ts`, `index.ts`.

**Tests** — `engine/autoplay.test.ts`, `engine/pointers.test.ts`, `engine/trace/pulse.test.ts`, plus
the Phase 0 `diff.test.ts` (14 tests total).

**Docs** — Phase 1 additions section in [`docs/TRACE_FORMAT.md`](../docs/TRACE_FORMAT.md).

Removed the now-superseded Phase 0 root components (`Cell`, `Controls`, `MemoryCanvas`, `StackFrame`).

## 3. Acceptance criteria — self-assessment

- [x] **1. typecheck/lint/test/build pass; no unjustified `any`.** All green (14 tests); Prettier
  clean; `@typescript-eslint/no-explicit-any: error` and zero `any` in the codebase.
- [x] **2. Design system as reusable tokens; light/dark toggle works and both read; code ligatures
  off.** Tokens in `index.css`; toggle verified in-browser (both themes legible);
  `font-variant-ligatures: none` + `font-feature-settings` on `.se-code` — `->`, `!=`, `<=` render
  literally (verified in the linked-list/pointer fixtures).
- [x] **3. Renderer draws all four Cell kinds AND heap blocks; four allocation states visually
  distinct, semantic colors.** `CellView` covers scalar/pointer/array/struct; `HeapBlockView` shows
  allocated (teal) / freed (hatched) / dangling (red dashed) / leaked (amber, no arrow) — verified
  on the malloc fixture's final step.
- [x] **4. Pointer arrows by id, handle NULL, animate on retarget, survive resize and push/pop.**
  `ArrowOverlay` + anchor registry; `resolvePointers` resolves by id; NULL → sink badge; `motion.path`
  animates `d` on retarget; ResizeObserver + rAF pulse keep arrows attached.
- [x] **5. Transport complete (f/b, play/pause, scrub, speed, keyboard ←/→/Space/Home/End) and
  `Step k / N`; step-back reverses.** `useTrace` + `Transport` + `useKeyboardControls`; keyboard
  verified (`ArrowRight`, `End`, `f`); diff-driven animations reverse symmetrically.
- [x] **6. Value changes show the green pulse, driven by `diffSteps` (not hard-coded).**
  `pulsedCellIds(prev, next)` drives `PulseValue`; covered by `pulse.test.ts`.
- [x] **7. Chrome matches design: top bar + breadcrumb from trace metadata (no invented codes), code
  highlight, narration bar, console panel for malloc.** Breadcrumbs come from `Trace.course/topic/
  file` sourced from `docs/CURRICULUM.md`; console renders for the malloc fixture.
- [x] **8. Presentation/fullscreen mode works and is keyboard-navigable.** `PresentationMode` (enter
  with `f` / button, exit with `Esc` / button); verified in-browser.
- [x] **9. All four fixtures render correctly and match their PDF screens; hover reveals detail.**
  Verified each in-browser against the PDF. Frames have styled hover tooltips; cells/nodes use native
  `title` tooltips (type/value/address) — see §5.
- [x] **10. Trace-format additions are additive, keep Phase 0 valid, documented.** All new fields
  optional; Phase 0 `addTrace` still type-checks and renders; documented in `TRACE_FORMAT.md` §"Phase
  1 additions".
- [x] **11. New engine logic has tests.** `autoplay.test.ts` (advance/stop-at-end),
  `pointers.test.ts` (target resolution + danger), `pulse.test.ts` (diff→pulse and retarget
  selection).

## 4. How to run & verify

```bash
npm install
npm run dev       # http://localhost:5173
```

The four fixtures are tabs across the top: **Recursion · Linked list · Pointer arithmetic · malloc /
free**. Drive with the transport or the keyboard: **←/→** step, **Space** play/pause, **Home/End**
jump to ends, **f** presentation mode, **Esc** exit. The theme toggle (top-right) flips light/dark;
**Legend** opens the swatch legend.

What to look for per fixture:
- **Recursion** — step in to watch `factorial` frames spring in (newest at the bottom, descending
  addresses); at the base case the return value green-pulses; unwinding multiplies 1·2·6·24.
- **Linked list** — azure `head`/`current` arrows + the `next` chain to a **NULL sink**; stepping
  advances `current` and the arrowhead glides node→node.
- **Pointer arithmetic** — `p` on `arr[1]`, the `*(p+2)` arc with `0x5004 + 2×4 = 0x500c`, `arr[3]`
  amber-active, `x` pulses to 40.
- **malloc / free** — final step shows all four allocation states, `old`'s **red dashed** dangling
  arrow, the leaked block with no incoming arrow, and the console heap-watch warnings.

```bash
npm run typecheck && npm run lint && npm run test && npm run build   # all pass
```

## 5. Key decisions & deviations

**Loud deviations from the prompt / PDF (all deliberate):**

1. **Stack renders newest-at-the-bottom — contradicts §A's "render top-of-stack visually on top (as
   Phase 0 does)".** I followed the **locked PDF screen 01**, whose header literally reads "NEWEST
   FRAME AT THE BOTTOM" with descending addresses, over §A's parenthetical, because the prompt says
   the PDF is the target to match. The data model is unchanged (still bottom-first `stack[0]=main`);
   only the visual order differs from Phase 0. Flagging explicitly since it reverses Phase 0's choice.

2. **Pointer cells are azure-accented, not maroon.** The PDF screens 02–05 fill pointer *cells* with
   a maroon/crimson background, but `DESIGN_SPEC` and this prompt both state "pointer → azure" as
   *law*, the legend (PDF p.11) shows the pointer swatch azure, and **red is reserved for
   dangling/UB**. Using maroon for every pointer would dilute that signal, so pointer cells get an
   azure left-border + azure type/address (arrows azure too). Same class of reconciliation the prompt
   already calls out for the PDF's errors.

3. **Breadcrumb course codes corrected from the PDF** (the prompt's "never fabricate, source from
   `docs/CURRICULUM.md`" rule). The PDF mislabels two screens; I used the curriculum:
   - **Recursion → SE 200** (C Programming I, wk 5). PDF said "SE 201".
   - **malloc/free → SE 201** (DSA I, "Introduction to Memory Allocation"). PDF said "SE 200".
   - Linked lists (SE 201) and Pointers (SE 200) already matched. (The PDF's own "SE 220" build-
     pipeline error is moot — concept views aren't built this phase.)

**Decisions left open by the prompt:**
- **Fonts bundled via `@fontsource`** (not a CDN link) to honor "no network at runtime."
- **Arrays render in the data region (right), with a compact summary row in the stack frame** — the
  array is a stack local but the design pulls it out beside the stack; the summary row owns the
  `arr` anchor, the expanded element cells own their own ids, so `p`'s arrow resolves to `arr[1]`.
- **Heap layout hint** (`Trace.heapLayout`) chooses row (linked-list chain) vs column (independent
  malloc blocks) — an additive field rather than guessing from content.
- **Hover detail:** frames get a styled popover listing locals; cells/nodes use the native `title`
  attribute for type/value/address (robust, accessible). A fully styled per-cell popover is a
  cosmetic later polish.
- **Pointer cells** also gained an optional `display` already in Phase 0; I reuse it for the held
  address text.

**Non-goals respected:** no hash-table/stack-queue/static-lib/preprocessor/debugging content; **no
concept-view (non-memory) rendering** — only the `process`-box token exists. A later phase will add
an additive `view` discriminator (noted in `TRACE_FORMAT.md`). No interpreter, no nav shell, no
persistence.

## 6. Trace format / API notes (the additive changes)

All additions are **optional**, so Phase 0 traces remain valid. Full prose in
[`docs/TRACE_FORMAT.md`](../docs/TRACE_FORMAT.md); authoritative types in
[`types.ts`](../src/engine/trace/types.ts).

- **`Trace`**: `course?`, `topic?`, `file?` (breadcrumb, curriculum-sourced); `heapLayout?: 'row' |
  'column'` (default `row`).
- **`Step`**: `activeId?: string` (the one amber-active element); `annotations?: Annotation[]`
  (`{ id, fromId, toId, label }`, the pointer-arithmetic arc); `stdout?: string[]` (console output);
  `watch?: WatchEntry[]` (`{ level: 'info' | 'dangling' | 'leak'; message }`).
- **`StackFrame`**: `address?: string` (frame base, for descending recursion addresses).
- **`HeapBlock`**: `state?: AllocationState` = `'allocated' | 'freed' | 'dangling' | 'leaked'`
  (default `allocated`).
- **New exported types**: `AllocationState`, `WatchLevel`, `WatchEntry`, `Annotation`.
- **Derived, never authored:** green pulse (`pulsedCellIds`), retarget glide
  (`retargetedPointerIds`), and the red danger arrow (`resolvePointers` → `danger` when the target
  block is `freed`/`dangling`). Content modules author correct snapshots + `state`s only.

Engine API also gained: `useTrace` returns `isPlaying/play/pause/togglePlay/speed/speedIndex/
setSpeedIndex/speeds`; `autoplayTick`, `PLAYBACK_SPEEDS`; the anchor registry (`AnchorProvider`,
`useAnchors`, `useAnchorRef`); `resolvePointers`/`classifyTarget`/`pointersByTarget`/`indexStep`;
`tokenizeLine`.

## 7. Known issues / follow-ups

- **Dev-mode first paint:** in `vite dev` the CSS is JS-injected, so there can be a sub-second flash
  before tokens load; mitigated with an inline dark background + `color-scheme` in `index.html`. The
  production build links the stylesheet, so no flash there. (During verification I initially misread
  the dark-charcoal surfaces as light; a magenta-injection test confirmed surfaces paint dark —
  computed `--se-bg` = `#0d0e11`.)
- **Cell/node hover** uses native `title` tooltips (frames use a styled popover). Unifying on a
  styled popover everywhere is cosmetic polish.
- **Arrow routing** is a simple cubic/quadratic between facing edges; with many crossing pointers
  (future dense structures) it may need orthogonal routing or collision avoidance.
- **Pointer-arithmetic `·p+2` sub-label** on the array element is conveyed via the amber active ring
  + the annotation chip rather than an extra element label; faithful enough, not pixel-identical.
- **Lint is clean (0 warnings, 0 errors):** the `react-refresh/only-export-components` warnings that
  initially appeared were eliminated by splitting the anchor context/hooks out into
  `anchorContext.ts` so `anchors.tsx` exports only the provider component.
- **No autoplay test for the React timer** — the pure `autoplayTick` is tested; the effect wiring is
  exercised manually. A fake-timer hook test could be added later.
- Concept views (static libraries, preprocessor, dual-trace debugging) are deferred to a later phase
  via an additive `view` discriminator.

## 8. File map

```
index.html                         # dark first-paint + data-theme
src/
  index.css                        # design tokens (dark/light) + @theme + .se-code
  main.tsx                         # bundled fonts, default theme
  App.tsx                          # workbench: top bar, fixture tabs, legend, keyboard, presentation
  engine/
    autoplay.ts (+ .test.ts)       # pure autoplay tick + speeds
    highlightC.ts                  # C tokenizer for the code panel
    anchorContext.ts               # anchor types/context/hooks
    anchors.tsx                    # AnchorProvider (refs + ResizeObserver + rAF pulse)
    pointers.ts (+ .test.ts)       # pure pointer resolution + danger detection
    trace/
      types.ts                     # + additive fields (documented)
      diff.ts                      # + pulsedCellIds / retargetedPointerIds
      useTrace.ts                  # + autoplay/play/pause/speed
      pulse.test.ts                # diff→pulse / retarget selection
      diff.test.ts                 # (Phase 0, unchanged)
  hooks/
    useTheme.ts
    useKeyboardControls.ts
  components/
    TopBar.tsx  Transport.tsx  CodePanel.tsx  NarrationBar.tsx
    ConsolePanel.tsx  Legend.tsx  Tooltip.tsx  Stage.tsx  PresentationMode.tsx
    memory/
      MemoryCanvas.tsx  StackFrame.tsx  CellView.tsx  HeapBlockView.tsx
      ArrowOverlay.tsx  renderContext.ts
  content/
    phase0/                        # (Phase 0 slice, unchanged)
    fixtures/
      factorial.ts  linkedList.ts  pointerArith.ts  mallocFree.ts  index.ts
docs/
  TRACE_FORMAT.md                  # + Phase 1 additions section
reports/
  phase-01-engine.md               # this file

# Removed (superseded by components/memory/*): components/{Cell,Controls,MemoryCanvas,StackFrame}.tsx
```
