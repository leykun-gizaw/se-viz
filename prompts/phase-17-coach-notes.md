# Phase 17 — Coach Notes: contextual teaching pop-ups (capability + exemplars) — SOLO engine

## Why this phase exists
SE-Viz is meant to **replace PowerPoint** for live teaching, but right now it shows *what* happens
(code + memory) with only a one-line narration — it rarely teaches *why*. PowerPoint carries that
"why" as walls of bullets. We want the opposite: a **chess.com-style coach** that steps in **at the
moments that matter**, **points at the relevant thing**, and says one sharp thing — contextual and
progressive, not a slide wall.

This phase builds the **capability** (an additive `coach` step field + an anchored coach-bubble
renderer) and proves it by **annotating 2–3 exemplar modules**. A later phase (18) will author coach
notes across the rest of the curriculum once you've validated the feel. This is a **solo** phase.

## Decisions already made (build to these)
- **Typed notes**, four variants: `idea` (key concept), `watch-out` (common bug/misconception),
  `predict` ("what will happen here?"), `recap` (section summary). Each gets a subtle icon + token
  color, like chess.com's move labels.
- **Anchored with fallback**: the bubble points at the element it's about (frame / cell / heap block
  / code line) with a small tail; when no anchor is given it sits in a consistent spot.
- **Capability + a few exemplars first** (this phase); broad content pass is Phase 18.

## Context to read
- `reports/phase-01-engine.md` (renderer, anchor registry, chrome), `reports/phase-11-concept-view-
  model.md` (views), and `prompts/phase-16-debugger-stepping.md` (the two-beat arrive/apply model).
- `src/engine/trace/types.ts`, `src/engine/anchorContext.ts` / `anchors.tsx` (the anchor registry
  that positions arrows — reuse it to position bubbles), `src/components/memory/ArrowOverlay.tsx`,
  `src/components/{NarrationBar,Stage,PresentationMode}.tsx`, `src/engine/trace/validate.ts`.
- `docs/TRACE_FORMAT.md`, `docs/CONTENT_AUTHORING.md`, `docs/design/` (reuse existing tokens — no
  restyle).

## Hard constraints
- Frontend only, TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build` pass.
- **Additive only**: a `Step` without `coach` behaves exactly as today; all existing traces stay
  valid and `validateTrace` still passes. No restyle of the design system (only variant treatments
  built from existing tokens). No new memory primitive.
- Keep the **one-line narration bar** as-is (the running subtitle). The coach bubble is a **separate,
  occasional** layer — not a replacement for narration.

## Feature A — the `coach` step field (additive)
Add an optional coach note to `Step` (one note per step keeps the UI focused), e.g.:
```ts
interface CoachNote {
  variant: 'idea' | 'watch-out' | 'predict' | 'recap';
  body: string;            // the explanation — SHORT: 1–3 sentences, one idea
  title?: string;          // optional short heading
  anchorId?: string;       // a frame / cell / heap-block id (or a view element id) to point at
  anchorLine?: number;     // alternatively anchor to a 1-based source line
  beat?: 'arrive' | 'apply'; // when two-beat stepping is active: show on arrive (predict) or apply (explain). Default 'apply'.
}
// on Step:  coach?: CoachNote
```
Document the exact shape in `docs/TRACE_FORMAT.md`. Field names are your call, but keep it minimal,
optional, and additive. No other trace-format change.

## Feature B — the coach-bubble renderer
A `CoachBubble` (or similar) overlay that, when the current step has a `coach`:
- **Positions itself by anchor**: resolve `anchorId`/`anchorLine` via the existing anchor registry to
  the element's on-screen rect and place the bubble adjacent with a **small tail/pointer** at it
  (chess.com "this, right here"). Be **collision-aware** — don't cover the anchor or key elements;
  flip side / reposition as needed. When there's no anchor, use a **consistent fallback spot**
  (e.g. a corner beside the canvas).
- **Typed styling**: each `variant` gets a subtle icon + token color (e.g. `idea` neutral/info,
  `watch-out` amber, `predict` azure, `recap` teal) using existing design tokens — readable in dark
  (primary) and light, and at presentation scale.
- **Tone & length**: the body reads like a coach speaking — concise, plain, one idea. Render long
  text gracefully but the authoring convention caps it (below).
- **Non-blocking flow**: auto-appears when you land on its step, is **dismissable** (close button +
  `Esc` + click-away) without preventing stepping, and **reappears if you step back** to it. Smooth
  appear/dismiss; honor `prefers-reduced-motion`.
- **Two-beat aware**: if the debugger two-beat stepping (Phase 16) is active, show the note on its
  `beat` (`predict` notes naturally on *arrive*, explanations on *apply*); if two-beat isn't present
  or it's single-beat mode, just show it on the step. Don't hard-depend on Phase 16 — degrade
  gracefully.
- **Across views**: works in the memory view and the **dual-trace** view (the divergence step is a
  perfect coach moment); for `pipeline` / `before-after` views, at minimum render a fallback-
  positioned bubble (anchor to a node/line if those views expose anchorable ids).

## Feature C — exemplar annotations (prove the feel)
Annotate **2–3 existing modules** with a handful of coach notes spanning all four variants and both
anchored + fallback placement. Choose high-teaching-value moments, e.g.:
- A **linked-list insert or delete** — `predict` before a pointer rewire, `watch-out` on the
  classic "rewire in the wrong order and you lose the list" pitfall.
- **Recursion (factorial)** — an `idea` at the base case, a `recap` on the unwind.
- **malloc/free dangling** — `predict` before `free`, `watch-out` when `old` dangles.
- or the **dual-trace debugging** divergence — a `watch-out` pointing at the first diverging row.
Keep each note short and genuinely illuminating — this sets the bar for Phase 18.

## Feature D — document the authoring convention
Add a "Coach notes" section to `docs/CONTENT_AUTHORING.md` (and the field to `docs/TRACE_FORMAT.md`):
selective (only steps that add insight — not every step), **1–3 sentences, one idea**, pick the right
variant, anchor to what it's about, predict-on-arrive / explain-on-apply. This guides Phase 18.

## validateTrace
Extend `validateTrace` (additively) so a coach `anchorId` resolves to an element present in that step
and `anchorLine` is within the source — like the existing checks. Don't break memory traces.

## Non-goals
- No broad content authoring (that's Phase 18 — only the 2–3 exemplars here). No restyle, no new
  memory primitive, no concept-view payload changes, no nav changes. Don't replace the narration bar.

## Acceptance criteria
1. `typecheck`/`lint`/`test`/`build` pass; no `any` w/o justification; additive — all existing traces
   render and `validateTrace` passes; narration bar unchanged.
2. `Step.coach` is optional and documented; the four variants render with distinct subtle styling +
   icons from existing tokens, legible in both themes and at presentation scale.
3. The bubble **anchors to its element with a tail** (collision-aware) and **falls back** to a
   consistent spot with no anchor; auto-appears, is dismissable (button/`Esc`/click-away) without
   blocking stepping, and reappears on step-back; reduced-motion honored.
4. Honors the two-beat `beat` when present; degrades gracefully without Phase 16.
5. Works in memory + dual-trace views; pipeline/before-after at least show a fallback bubble.
6. 2–3 exemplar modules are annotated across all four variants (anchored + fallback) and pass
   `validateTrace`.
7. `validateTrace` checks coach anchor resolution; the coach-authoring convention is documented in
   `docs/CONTENT_AUTHORING.md` + `docs/TRACE_FORMAT.md`.
8. New pure logic (anchor/placement resolution, variant selection) has unit tests.

## When done
Write `reports/phase-17-coach-notes.md` from the template. In §3 describe the `coach` shape, the
positioning/collision approach, and the exemplars; in §5 flag deviations; §6 documents the additive
field. Note for the reviewer which modules you annotated so they can step through them. Do not start
Phase 18.
