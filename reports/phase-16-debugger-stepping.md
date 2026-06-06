# Phase 16 Report — Debugger-Style Stepping: Inline Code Values + Execute-to-Reveal

## 1. Summary

The code panel now behaves like an IDE debugger. **Feature A (inline values):** the active line shows
the variables it touches — the one that changed this beat pulses green, the rest are muted —
resolved against the **active frame** so recursion's repeated names show the right frame's value.
**Feature B (execute-to-reveal):** each logical step is split into two beats — `arrive` (highlight the
line "about to run", render the pre-state, no pulse) and `apply` (render the change, pulse) — default
**on**, with a persisted toggle (button + `b` key) back to single-beat. The beat logic is a pure,
unit-tested module; everything is **derived** from existing data (the previous step's snapshot + the
existing C tokenizer), so there is **no trace-format change and no content edit** — all ~30 traces
render unchanged and `validateTrace` still passes. Memory and dual-trace views get beats; the
`pipeline`/`before-after` concept views are forced single-beat (unaffected). `typecheck`, `lint`,
`test` (91), and `build` all pass.

Before starting, I resolved a pending change as instructed: the working tree held the
`react-resizable-panels` migration whose code was left uncommitted in `f827116` (so HEAD imported a
deleted `SplitPane` and didn't build). I committed that verbatim to `main` as its own commit, then
branched `phase-16-debugger-stepping` from the clean tree.

## 2. What I built

Pure engine logic (React-free, unit-tested):

- `src/engine/trace/beats.ts` — the beat model: `BeatPosition`, `advanceBeat`/`reverseBeat`,
  `canAdvance`/`canReverse`, `resolveBeatRender` (which snapshot to display + diff against),
  `clampToMode`, `beatLabel`, `viewSupportsBeats`, `EMPTY_STEP`. (+ `beats.test.ts`)
- `src/engine/trace/inlineValues.ts` — `findActiveFrame` (by activeId → frame, else top of stack)
  and `resolveInlineValues` (line identifiers → active-frame cells → changed/read). (+
  `inlineValues.test.ts`)

Wiring:

- `src/engine/trace/useTrace.ts` — integrated beats: persisted `mode` (`usePersistentState`,
  `se-viz-stepping-mode`), `effectiveMode`, beat-aware `next/prev/goTo/reset`, one-beat-per-tick
  autoplay, and new player fields (`beat`, `mode`, `effectiveMode`, `supportsBeats`, `toggleMode`,
  `beatLabel`, `displayStep`, `displayPrevStep`). Existing API preserved.
- `src/components/CodePanel.tsx` — renders inline-value chips on active line(s); changed chips pulse
  (honoring `useReducedMotion`), read chips muted; pointers shown as `p → 0x5004`.
- `src/components/Stage.tsx` — routes `displayStep`/`displayPrevStep` to the memory canvas, console,
  dual-trace, and (equal to the logical step) pipeline/before-after; passes the logical `step` +
  display snapshots + `pulseKey` to the code panel.
- `src/components/Transport.tsx` — step counter shows the beat (`· about to run` / `· ran`); added a
  "Reveal on/off" toggle (shown only for beat-supporting views).
- `src/hooks/useKeyboardControls.ts` + `src/App.tsx` — `b` toggles the mode; keys hint updated.

Pre-step (separate commit on `main`): the `react-resizable-panels` migration
(`Stage.tsx`/`useKeyboardControls.ts`/`package.json`).

## 3. Acceptance criteria — self-assessment

- [x] **1. typecheck/lint/test/build pass; no `any`; all existing traces render & `validateTrace`
  passes; no trace-format or content change.** All four gates green (91 tests, incl. the catalog
  `validateTrace` test over every trace). No `any`. No file under `src/content/**` or the trace
  format (`types.ts`) was touched.
- [x] **2. Inline values — changed pulse green, read muted, resolved against the active frame
  (recursion same-name).** `inlineValues.ts` + `CodePanel`. Verified in-browser on `factorial` at
  `unwind-2`: line `return n * factorial(n - 1)` shows `n = 2` (the active fac2), while fac4.n=4 /
  fac3.n=3 are also live. Test: `inlineValues.test.ts` → "resolves `n` against the ACTIVE frame".
- [x] **3. Two-beat default on: `→` highlights line with pre-state/no pulse, next `→` applies
  (pulse); `←` reverses; code & memory stay in sync.** Verified on control-flow: `arrive(sum-1)` →
  inline `sum = 0` muted + memory `sum 0`; `apply(sum-1)` → inline `sum = 1` (pulse) + memory `sum`
  pulses to 1 (active). Reverse retraces beats. Test: `beats.test.ts` → "reverse is the exact inverse
  of advance".
- [x] **4. Working toggle to single-beat; choice persists; counter shows step + beat.** "Reveal
  on/off" button + `b` key call `player.toggleMode`; persisted via `usePersistentState`
  (`se-viz-stepping-mode`) — verified it survived switching modules. Counter shows
  `Step 8 / 21 · about to run` / `· ran`.
- [x] **5. Autoplay, keyboard, and presentation respect the mode; reduced-motion honored.** Autoplay
  advances one beat per tick (the `useTrace` timer calls `advanceBeat`); keyboard `←/→/Space/Home/End`
  drive the beat-aware player; presentation renders the same beat-aware `Stage` + compact `Transport`
  (which shows the beat). Inline pulse uses `useReducedMotion` (instant when reduced).
- [x] **6. Memory & dual-trace get the feature; pipeline/before-after unaffected and don't break.**
  `viewSupportsBeats` ⇒ memory + dual-trace are two-beat; pipeline/before-after are forced single
  (no beat label, no toggle). Verified the Build-pipeline view renders fine as "Step 1 / 7" (no beat)
  and the dual-trace "Max of array" shows "Step 1 / 8 · ran". (Dual-trace keeps its existing column
  rendering for values — see §5.)
- [x] **7. Unit tests for the new logic.** `beats.test.ts` (advance/reverse sequence, symmetry,
  clamping, single mode, `resolveBeatRender` pre/post, mode helpers) and `inlineValues.test.ts`
  (`findActiveFrame`, the recursion same-name case, changed/read classification, pointer formatting).

## 4. How to run & verify

```bash
npm install              # react-resizable-panels is already in package.json
npm run typecheck && npm run lint && npm run test && npm run build   # all pass
npm run dev              # open the printed URL
```

In the app (default is two-beat / "Reveal on"):

- **Two beats:** pick "Variables & control flow". `→` lands on line 15 (`sum = sum + i`) showing
  `sum = 0  i = 1` muted with the stack unchanged ("· about to run"); `→` again reveals `sum = 1`
  (green pulse) and the memory `sum` pulses to 1 ("· ran"). `←` walks the beats back.
- **Recursion same-name:** pick "factorial(n)", step to where several `factorial` frames are live
  (e.g. press `b` for single-beat to get there fast, then `→` to `unwind-2`); line 6 shows `n = 2`,
  the **active** frame's value, not 4 or 3.
- **Toggle:** the "Reveal on/off" button or `b`; the counter's beat suffix appears/disappears; the
  choice persists across reloads/module switches.
- **Concept views:** "Build pipeline" (pipeline) shows no beat suffix and no toggle and renders
  normally; "Max of array" (dual-trace) shows the beat suffix and steps in two beats.

### How I verified the recursion same-name + arrive/apply correctness

- **Same-name:** a pure test pins it (`inlineValues.test.ts`): three live `factorial` frames
  (n = 4/3/2); resolving the line `return n * factorial(n - 1)` against the fac2 frame yields `n = 2`,
  and against fac4 yields `n = 4`. Confirmed visually (fac2 active, stack shows 4/3/2, inline `n = 2`).
- **arrive vs apply pre/post:** `beats.test.ts` pins `resolveBeatRender`: `arrive(n)` →
  `{displayIndex: n-1, diffPrevIndex: n-1}` (renders the previous snapshot, diffed against itself ⇒
  no pulse); `apply(n)` → `{displayIndex: n, diffPrevIndex: n-1}` (renders step n, diffed against n-1
  ⇒ the change pulses); `arrive(0)` → `{-1, -1}` (the empty pre-state). Confirmed visually that
  `arrive(0)` shows an empty stack with the line highlighted, and that arrive/apply of the same step
  keep code and memory in sync.

## 5. Key decisions & deviations

- **Pre-step migration committed to `main`.** The prompt said to "resolve the pending change first,
  separately" (it named `ArrowOverlay.tsx`; the actual pending change was the resizable-panels
  migration). Since HEAD didn't build without it, I committed the working-tree migration verbatim to
  `main` as its own commit (completing `f827116`), then branched. Phase 16 starts from a clean tree.
- **Dual-trace gets two-beat stepping but keeps its existing value rendering** (no on-line inline
  chips). Its data model is per-column state-tables (`DualColumnRow`), not stack frames, so the
  frame-based inline resolver doesn't apply; and each column already shows a changed/read state
  table. This is the prompt's allowed "if not feasible, leave dual-trace's existing rendering
  unchanged and note it." Two-beat works via `displayStep` (arrive shows the previous step / an empty
  panel at step 0; apply shows the current step).
- **Pipeline / before-after are forced single-beat** (`effectiveMode = 'single'`) so they don't gain
  a redundant double-click; the toggle is hidden and the counter omits the beat for them. This is the
  cleanest reading of "unaffected and don't break."
- **`displayStep` vs logical `step`.** The player exposes both: the **logical** `step` drives the
  line highlight, narration, condition chip, and counter (so on `arrive(n)` you read "about to run"
  line n while memory shows n-1); `displayStep`/`displayPrevStep` drive memory/console/inline. The
  active frame for inline values is found by the **logical** step's `activeId` looked up inside the
  **displayed** snapshot — this is what keeps the same-name resolution correct across the
  frame-transition boundary.
- **Navigation niceties:** `arrive(0)` shows a synthetic empty pre-state (`EMPTY_STEP`); scrub /
  Home / End land on a step's `apply` beat; `reset` goes to the very first beat. The `b` key was
  chosen for the toggle (free; "beat").
- **Reduced motion:** the new inline pulse honors `useReducedMotion()` directly (instant). I did not
  change the memory-canvas pulse (Phase 15's domain); the existing `prefers-reduced-motion` CSS
  remains.

## 6. Trace format / API notes

**No trace-format change** (`src/engine/trace/types.ts` untouched) and **no content change**
(`src/content/**` untouched). The only shared-interface change is additive on the **`TracePlayer`**
object returned by `useTrace`: new read-only fields `beat`, `mode`, `effectiveMode`, `supportsBeats`,
`beatLabel`, `displayStep`, `displayPrevStep`, and a `toggleMode()` method; all existing fields
(`step`, `prevStep`, `index`, `total`, `next/prev/goTo/reset`, autoplay, speed) are unchanged, so
existing consumers keep working. `useKeyboardControls` gained an optional `onToggleStepMode?` handler.
New persisted key: `se-viz-stepping-mode` (`'two-beat' | 'single'`, default `'two-beat'`).

## 7. Known issues / follow-ups

- **Dual-trace** does not render on-line inline chips (uses its existing per-column state tables); its
  `arrive(0)` shows an empty panel (the pre-state). Adding column-aware inline chips is a possible
  follow-up.
- **Inline chips right-align** at the end of the active line; for an unusually long line + many vars
  they can extend the code panel's horizontal scroll. Fine for the current traces.
- **The repo is not fully Prettier-formatted** (pre-existing content/engine files fail
  `prettier --check`); I formatted only the files I touched. The required `lint` gate (eslint) passes.
- The changed-inline pulse settles to bright ink and read values are muted, so the changed/read
  distinction persists subtly after the green flash fades — intentional, but worth a design glance.

## 8. File map

```
src/engine/trace/
  beats.ts                 # NEW — pure beat model (arrive/apply, advance/reverse, render resolution)
  beats.test.ts            # NEW — beat sequence / symmetry / pre-post / mode helpers
  inlineValues.ts          # NEW — findActiveFrame + resolveInlineValues (identifier → active-frame cell)
  inlineValues.test.ts     # NEW — same-name correctness + changed/read + pointer formatting
  useTrace.ts              # CHANGED — beats + persisted mode + displayStep/displayPrevStep + beat fields
src/components/
  CodePanel.tsx            # CHANGED — inline value chips (changed pulse / read muted; reduced-motion)
  Stage.tsx                # CHANGED — route displayStep/displayPrevStep + pulseKey to panels
  Transport.tsx            # CHANGED — beat label in counter + Reveal on/off toggle
src/hooks/
  useKeyboardControls.ts   # CHANGED — `b` → onToggleStepMode
src/App.tsx                # CHANGED — wire onToggleStepMode; keys hint

# Separate pre-step commit on main (not Phase 16):
#   src/components/Stage.tsx, src/hooks/useKeyboardControls.ts, package.json, package-lock.json
#   — the react-resizable-panels migration left uncommitted in f827116.
reports/phase-16-debugger-stepping.md   # this file
```
