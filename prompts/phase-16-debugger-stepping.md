# Phase 16 — Debugger-Style Stepping: Inline Code Values + Execute-to-Reveal (SOLO engine)

## Why this phase exists
The code panel today only highlights the active line — all the "what changed" signal lives in the
memory canvas, and a single click both moves to a line and applies its effect at once. This phase
makes the code panel behave like an IDE debugger:
1. **Inline values in the code** — show variable values right on the active line, mirroring the
   memory canvas's change signal into the code.
2. **Execute-to-reveal stepping** — split each step into two beats: first *arrive* on the line
   ("about to run", state unchanged), then *apply* it on the next click (value updates + pulses).

This is a **solo engine/renderer phase**. It is **additive and derivable** — **no trace-format
change and no content re-authoring** (all ~30 traces stay exactly as-is). The "before" state is just
the previous step's snapshot; inline values come from existing cell data + the existing C tokenizer.

## Context to read
- `reports/phase-01-engine.md` (the renderer, transport, diff, `useTrace`) and
  `reports/phase-02-c-fundamentals.md` (`Step.condition`).
- `src/engine/trace/{types.ts,diff.ts,useTrace.ts}`, `src/engine/highlightC.ts` (the C tokenizer),
  `src/engine/pointers.ts`.
- `src/components/CodePanel.tsx`, `src/components/memory/MemoryCanvas.tsx`,
  `src/components/Transport.tsx`, `src/hooks/useKeyboardControls.ts`,
  `src/components/PresentationMode.tsx`, `src/components/Stage.tsx`.
- `docs/design/` — reuse the existing tokens (`value-changed` green, muted/read styling). Don't restyle.

## Hard constraints
- Frontend only, TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build` pass.
- **No trace-format change. No content-file change. No restyle.** Everything is derived from existing
  data. All existing traces must still render and `validateTrace` must still pass.
- Start from a clean tree (resolve the pending `ArrowOverlay.tsx` change first, separately).

## Feature A — Inline values in the code panel
On the **active line(s)**, render the values of the variables that line touches, resolved against
the **currently executing frame** (the active frame — the one containing `activeId`, else the top of
stack). Correctness in recursion matters: when several frames share a name (`n` in many `factorial`
frames), the inline value must be the **active frame's** `n`, not another's.
- Use `highlightC.ts` to tokenize the line and find identifiers; match them to cells (by `name`) in
  the active frame's variables (recurse into array/struct members as needed).
- Classify each matched identifier using the step diff (`diffSteps`/`pulsedCellIds`):
  - **changed this step** → render the value with the **green value-changed pulse** (same token as
    the memory canvas), e.g. `sum = 10`.
  - **read but unchanged** → render **muted**, e.g. `i = 4`.
- Render the chips tastefully (e.g. right-aligned at the end of the line, or just after the line's
  code) in mono, using existing tokens; don't overflow or clutter. Pointers may show their held
  address/target compactly (`p → 0x5004`) where they appear on the line; keep it readable.
- Only the active line(s) get inline values (not a running history) — this matches the chosen scope:
  "current line, changed + read vars."
- This is a **memory-view** feature. In the **dual-trace** view, apply the same inline values per
  column if feasible; if not, leave dual-trace's existing rendering unchanged and note it. The
  `pipeline` and `before-after` views have no line-by-line memory — leave them unaffected.

## Feature B — Execute-to-reveal stepping (two beats), default ON with a toggle
Split each logical step `n` into two visual **beats**:
- **arrive(n):** highlight `step(n).highlightedLines` ("about to run"), but render the **memory and
  inline values of step n-1** (the pre-state) — **no pulse**. (For the first step, arrive shows the
  initial/empty state.)
- **apply(n):** render `step(n)`'s snapshot — memory updates, the changed cell **pulses** in the
  canvas, and the inline value on the line updates and pulses. This is the "reveal".

Advancing goes `arrive(n) → apply(n) → arrive(n+1) → …`; **step-back reverses the same beats
symmetrically**. Both the **code panel and the memory canvas** must respect the current beat (they
stay in sync — pre-state on arrive, post-state on apply).
- **Default ON.** Add a clear **toggle** (button + a keyboard shortcut) to switch to **single-beat**
  stepping (today's behavior: one click = full step, line + change together). Persist the choice like
  the theme toggle.
- The **step counter** shows the logical step plus the beat, e.g. `Step 5 / 14 · about to run` then
  `· ran` (or an equivalent clear indicator + the progress dots).
- **Autoplay** advances one beat per tick so the arrive→apply rhythm is visible at the chosen speed
  (in single-beat mode it advances a full step per tick, as today).
- **Keyboard** (`←/→/Space/Home/End`) and **presentation mode** must all respect the active mode.
- `prefers-reduced-motion` is honored (pulses degrade to instant, per Phase 15).
- Keep the beat/stepping logic **pure and testable** (e.g. a reducer/helper separate from React) so
  the advance/reverse sequence can be unit-tested.

## Non-goals
- No trace-format fields, no content edits, no concept-view (pipeline/before-after) changes beyond
  leaving them working. No new memory primitive, no restyle, no nav changes.

## Acceptance criteria (the reviewer will check against the code)
1. `typecheck`/`lint`/`test`/`build` pass; no `any` without justification; all existing traces still
   render and `validateTrace` passes; no trace-format or content changes.
2. **Inline values**: the active line shows its variables — changed one(s) pulse green, read ones
   muted — resolved against the **active frame** (verify on a recursion trace where a name repeats:
   the value shown is the active frame's).
3. **Two-beat stepping default on**: `→` first highlights the line with pre-state memory/inline
   values and **no pulse**, then the next `→` applies the change (memory + inline value pulse); `←`
   reverses both beats correctly; code panel and memory canvas stay in sync across beats.
4. A working **toggle** switches to single-beat (today's behavior) and the choice persists; the step
   counter shows step + beat.
5. Autoplay, keyboard, and presentation mode all respect the active mode; reduced-motion honored.
6. Memory traces and the dual-trace view get the feature; `pipeline`/`before-after` views are
   unaffected and don't break under the toggle.
7. New stepping/inline-value logic has unit tests (pure functions): the two-beat advance/reverse
   sequence, and the identifier→cell→changed/read classification (incl. the recursion same-name case).

## When done
Write `reports/phase-16-debugger-stepping.md` from the template. In §3 describe the beat model and
the inline-value resolution; in §4 show how you verified the recursion same-name case and the
arrive/apply pre/post correctness; in §5 flag deviations; §6 must confirm "no trace-format change, no
content change." Do not start another phase.
