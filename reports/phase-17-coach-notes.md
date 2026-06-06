# Phase 17 Report — Coach Notes: contextual teaching pop-ups

## 1. Summary

SE-Viz can now teach the *why*, not just show the *what*: an optional, typed **coach note** per step
renders as a chess.com-style bubble that points at the relevant element and says one sharp thing —
separate from (and rarer than) the always-on one-line narration. This phase delivers the
**capability** (an additive `Step.coach` field, a pure placement/variant module, and an anchored
`CoachBubble` overlay) and proves the feel by annotating **four exemplar modules** across all four
variants, anchored and fallback. It is fully **additive**: a step without `coach` behaves exactly as
before, every existing trace still renders, and `validateTrace` (extended to check coach anchors)
still passes. `typecheck`/`lint`/`test` (84)/`build` all pass; no `any`.

Branch: `phase-17-coach-notes`, cut from `main` (parallel to Phase 16, which I committed to its own
branch first). The coach is **two-beat aware but does not depend on Phase 16** — `coachVisibleOnBeat`
degrades to "show on the step" when no two-beat stepping is present (as on this branch).

## 2. What I built

- **`Step.coach` field** — `src/engine/trace/types.ts`: `CoachNote { variant, body, title?, anchorId?,
  anchorLine?, beat? }` + `CoachVariant`. Optional/additive.
- **Pure coach logic** — `src/engine/trace/coach.ts`: `coachVisibleOnBeat`, `COACH_VARIANT_META` /
  `coachVariantMeta`, `placeCoachBubble` (collision-aware), `fallbackPlacement`. (+ `coach.test.ts`)
- **CoachBubble renderer** — `src/components/CoachBubble.tsx`: anchored-with-tail or fallback,
  typed icon + color, dismiss (close / `Esc` / click-away), reappear-on-step-back (keyed remount),
  reduced-motion aware, re-measures on resize/scroll/layout-settle.
- **Stage wiring** — `src/components/Stage.tsx`: renders the bubble in the stage content box across
  all views; `data-coach-anchor` added to `CellView` / `StackFrame` / `HeapBlockView` roots and
  `data-coach-line` to `CodePanel` lines so anchors resolve by id/line.
- **validateTrace** — `src/engine/trace/validate.ts`: coach `anchorId` must resolve, `anchorLine`
  must be in range (additive). (+ cases in `validate.test.ts`)
- **Exemplars** — coach notes added to `se200/recursion/factorial.ts`,
  `se201/dynamic-memory/freeAndDangling.ts`, `se201/linked-lists/insertHead.ts`,
  `se200/debugging/maxArray.ts`.
- **Docs** — `docs/TRACE_FORMAT.md` (field shape) and `docs/CONTENT_AUTHORING.md` (authoring
  convention).

## 3. Acceptance criteria — self-assessment

- [x] **1. gates pass; no `any`; additive — existing traces render & `validateTrace` passes;
  narration bar unchanged.** typecheck/lint/test (84)/build green; `Step.coach` optional; the catalog
  `validateTrace` test passes over all traces (now including coach notes); `NarrationBar` untouched.
- [x] **2. `Step.coach` optional + documented; four variants render with distinct subtle styling +
  icons from existing tokens, legible in both themes/presentation.** `COACH_VARIANT_META`: idea
  neutral, watch-out amber (`active`), predict azure (`pointer`), recap teal (`heap`); each with a
  drawn icon. Documented in `docs/TRACE_FORMAT.md`.
- [x] **3. Anchors to its element with a tail (collision-aware); falls back consistently; auto-
  appears; dismissable (button/`Esc`/click-away) without blocking stepping; reappears on step-back;
  reduced-motion honored.** Verified in-browser: factorial base-case bubble anchored to the `fac1`
  frame with a tail; dual-trace bubble in the top-right fallback; close button dismisses; stepping
  away and back re-shows it; `useReducedMotion` gates the animation. `placeCoachBubble` flips
  side/clamps (unit-tested).
- [x] **4. Honors the two-beat `beat` when present; degrades gracefully without Phase 16.**
  `coachVisibleOnBeat(note, beat)` returns `true` when `beat` is `undefined` (this branch), else
  matches `note.beat ?? 'apply'` — unit-tested. Stage passes `undefined` here; a comment marks where
  the merged build passes the live beat.
- [x] **5. Works in memory + dual-trace; pipeline/before-after show a fallback bubble.** The bubble
  renders in the stage content box regardless of view; verified on memory (anchored) and dual-trace
  (fallback). pipeline/before-after use the same fallback path.
- [x] **6. 2–3 exemplars across all four variants (anchored + fallback), pass `validateTrace`.** Four
  modules annotated (see §below); variants idea + recap + predict + watch-out; anchored (frame /
  pointer / cell / heap-block) and fallback; all pass the catalog validator.
- [x] **7. `validateTrace` checks coach anchor resolution; convention documented.** Done in
  `validate.ts` (+ tests) and `docs/CONTENT_AUTHORING.md § Coach notes` + `docs/TRACE_FORMAT.md`.
- [x] **8. New pure logic has unit tests.** `coach.test.ts` (beat visibility, variant distinctness,
  placement collision/flip/clamp, fallback) and the coach cases in `validate.test.ts`.

### The `coach` shape, positioning, and exemplars (prompt §3)

**Shape:** one optional `CoachNote` per step (above). **Positioning:** the bubble resolves
`anchorId`/`anchorLine` to a DOM element tagged `data-coach-anchor`/`data-coach-line` inside the
stage content box, measures its rect relative to that box, and runs `placeCoachBubble` — prefer
right of the anchor, else left, else below, else above (whichever fits without covering it), then
clamp inside the box with the tail kept on the bubble edge pointing at the anchor's center. No
resolvable anchor → `fallbackPlacement` (top-right, beside the canvas, no tail). It re-measures on
resize, scroll (capture phase, to catch the inner memory-canvas scroll), and a post-layout rAF.

**Exemplars annotated (for the reviewer to step through):**

| Module | Note(s) | Variant · placement |
| --- | --- | --- |
| `se200/recursion/factorial.ts` | base case "needs a base case" (anchored to frame `fac1`); unwind summary | `idea` anchored · `recap` fallback |
| `se201/dynamic-memory/freeAndDangling.ts` | "what happens to p after free?" (anchored to `p`); "p dangles — UB" (anchored to block `p-block`) | `predict` · `watch-out`, both anchored |
| `se201/linked-lists/insertHead.ts` | "does the rewire order matter?" (anchored to `new`); "link new->next first or you lose the list" (anchored to `nn.next`) | `predict` · `watch-out`, both anchored |
| `se200/debugging/maxArray.ts` (dual-trace) | "first divergence — debug by comparison" at the divergence step | `watch-out` fallback |

## 4. How to run & verify

```bash
npm install
npm run typecheck && npm run lint && npm run test && npm run build   # all pass
npm run dev
```

- **Anchored + idea:** open "factorial(n)", step to the base case (Step 6/12) — a neutral "THE BASE
  CASE" bubble points (tail) at the deepest `factorial()` frame. Click ×: it dismisses and stepping
  still works; step back one and forward again: it reappears.
- **predict / watch-out (anchored):** "free & dangling" — a predict bubble before `free(p)`, then a
  watch-out on the dangling block. "Insert at head" — predict before the rewires, watch-out anchored
  to `new->next`.
- **Fallback + dual-trace:** "Max of array" → step to the divergence (Step 2/8): an amber "FIRST
  DIVERGENCE" bubble sits top-right (no anchor) over the two-column view.
- **Reduced motion:** with the OS "reduce motion" setting on, the bubble appears without the
  scale/fade.

I verified the recursion same-name-frame correctness of the **anchor** by stepping factorial: the
bubble points at the active `fac1` frame specifically (not another `factorial()` frame), because the
anchor is its stable frame id. arrive/apply correctness is covered by `coach.test.ts` (the
`coachVisibleOnBeat` logic) since two-beat stepping isn't present on this branch.

## 5. Key decisions & deviations

- **Branching:** Phase 17 is cut from `main` (not from Phase 16), per "don't hard-depend on Phase
  16." I committed the completed Phase 16 work to its own branch first so it isn't lost. The coach's
  beat-handling is written and unit-tested but the *runtime* two-beat path can only be exercised once
  Phase 16 is merged; here it degrades to "show on the step" (verified).
- **Anchor resolution via `data-coach-*` attributes + the stage content box**, rather than the
  canvas-local anchor registry. The registry resolves rects only within the memory canvas; coach
  notes also target **code lines** and must work in concept views, so a stage-level, view-agnostic
  resolution (same "by stable id" idea) is cleaner and uniform. Memory elements already carried anchor
  refs; I added a parallel `data-coach-anchor` to the same roots.
- **Four exemplars, not 2–3.** I annotated four modules so the set spans all four variants *and*
  demonstrates the dual-trace path; each note is short and load-bearing. (The prompt said "2–3"; I
  flag the extra one loudly here — it's the dual-trace coverage required by acceptance #5.)
- **Dual-trace uses a fallback bubble** (its rows have no stable ids to anchor to). The prompt allows
  fallback for the non-memory views; the divergence bubble reads well in the corner.
- **`Esc`** dismisses the bubble; in presentation mode the global `Esc` also exits presentation
  (both fire) — acceptable, since exiting also removes the bubble. In normal mode the global `Esc`
  (exit-presentation) is a no-op, so `Esc` cleanly dismisses.

## 6. Trace format / API notes

**Additive only — no other trace-format change.** New: `Step.coach?: CoachNote` and the `CoachNote`
/ `CoachVariant` types (documented in `docs/TRACE_FORMAT.md § Phase 17 additions`). A step without
`coach` is unchanged; all existing traces validate and render identically. `validateTrace` gained two
additive checks (coach `anchorId` resolves; `anchorLine` in range). No renderer/design restyle (the
bubble is built from existing tokens), no new memory primitive, no concept-view payload change, and
the narration bar is untouched.

## 7. Known issues / follow-ups

- **Broad content pass is Phase 18** — only these four exemplars are annotated now.
- **Two-beat runtime** (predict-on-arrive / explain-on-apply) is logic-complete and tested but only
  visibly active once Phase 16 is merged; Stage passes `undefined` for the beat on this branch.
- **Anchor scroll tracking:** the bubble re-measures on scroll, but if an anchored element scrolls
  out of the memory canvas the bubble clamps to the edge rather than hiding. Fine for teaching;
  could hide-when-offscreen later.
- A pre-existing Tailwind lint *suggestion* (`min-w-[15rem]` → `min-w-60` in `StackFrame.tsx`) is
  unrelated to this phase and left as-is; `lint` passes.

## 8. File map

```
src/engine/trace/
  types.ts            # + CoachNote / CoachVariant / Step.coach (additive)
  coach.ts            # NEW — pure: visibility-by-beat, variant tokens, placement, fallback
  coach.test.ts       # NEW — unit tests for the above
  validate.ts         # + coach anchor/line checks (additive)
  validate.test.ts    # + coach cases
src/components/
  CoachBubble.tsx     # NEW — anchored/fallback bubble (tail, dismiss, reappear, reduced-motion)
  Stage.tsx           # render CoachBubble in the content box; resolve via data-coach-*
  CodePanel.tsx       # + data-coach-line on each line
  memory/CellView.tsx, StackFrame.tsx, HeapBlockView.tsx   # + data-coach-anchor on element roots
src/content/          # exemplar coach notes (additive to existing steps):
  se200/recursion/factorial.ts, se200/debugging/maxArray.ts,
  se201/dynamic-memory/freeAndDangling.ts, se201/linked-lists/insertHead.ts
docs/
  TRACE_FORMAT.md     # + Phase 17 additions (coach field)
  CONTENT_AUTHORING.md# + Coach notes authoring convention
reports/phase-17-coach-notes.md   # this file
```
