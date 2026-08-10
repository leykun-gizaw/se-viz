# Phase 25 — Compile options in Live Coding (checkbox dropdown → real `gcc` flags)

## Your role and context

You are Claude Code, implementing **SE-Viz** (the frontend, this repo). Live Coding currently POSTs
`{ source, stdin? }` and the backend compiles with **no warning flags at all** — so code Savanna's
Betty checker would reject compiles clean and animates happily. The visualizer quietly teaches that
broken code is fine.

**Tracer Phase 08 fixes the backend half**: `POST /trace` now accepts an allowlisted `flags` array
and applies it to the compile. This phase adds the **UI half** — a compile-options control next to
**Run** where the student ticks the flags they want before running.

> **Blocked on tracer Phase 08.** Do not start until it is merged in `se-viz-tracer`. Read its
> `reports/phase-08-compile-flags.md` first — it records the confirmed flag-precedence behavior and
> any allowlisted flag the image's gcc does not support.
>
> **Verify against a LOCAL tracer, not production.** Production is deliberately not being updated
> until this feature is complete and proven end-to-end. Follow `docs/LOCAL_LIVE_CODING.md`: run the
> tracer with `npm run serve` in the `se-viz-tracer` checkout (Docker must be running for the
> recorder), and point this app at it with `VITE_TRACER_URL=/tracer-api` in `.env.local` — the Vite
> proxy makes it same-origin. Every "verified live" acceptance criterion below means *verified
> against that local tracer*.

Read first: `src/live/{tracerClient,config,runState}.ts`, `src/components/live/LiveCodingView.tsx`,
`src/hooks/usePersistentState.ts`, `docs/LOCAL_LIVE_CODING.md`, and the tracer's `docs/API.md`.

## The flag set (mirrors the backend allowlist exactly)

| Flag | Label | Default |
|---|---|---|
| `-Wall` | All common warnings | **on** |
| `-Wextra` | Extra warnings | **on** |
| `-Werror` | Treat warnings as errors | off |
| `-pedantic` | Strict ISO conformance | off |
| `-std=gnu89` / `-std=c11` | Language standard (single choice) | `-std=c11` |

Defaults are deliberate: warnings are **surfaced** but never block the animation. `-Werror` is
opt-in, because with it a single warning replaces the visualization with a compiler-output panel —
valuable when rehearsing Betty, punishing as a default for a beginner. Say this in the UI (see
"Copy"), don't leave them to discover it.

The dialect is a **radio group, not two checkboxes** — the backend rejects two `-std=` values, so the
UI must make that unrepresentable rather than surfacing a 400.

If the tracer's Phase 08 report says the image's gcc lacks one of these, drop it from the UI and note
it in your report — do not ship a checkbox that always errors.

## What to build

### A. Client (`src/live/tracerClient.ts`)

- Add `flags?: string[]` to `PostTraceOptions` and include it in the request body **only when
  non-empty** (an omitted `flags` must reproduce today's request byte-for-byte).
- The backend echoes the effective flags on success; if present, thread them through
  `PostTraceResult` so the UI can show what was actually applied. Tolerate its absence — the
  deployed tracer may lag.
- **The backend also returns `warnings?: string` on success** (tracer Phase 08b) — the gcc warning
  text from a build that compiled anyway. Thread it through `PostTraceResult` as an optional field.
  Tolerate its absence. **This is what makes the `-Wall`/`-Wextra` defaults observable**; without
  rendering it, ticking those boxes changes nothing a student can see.
- `invalid_request` already maps to the generic error state. Because the UI can only produce
  allowlisted combinations, seeing one means UI and backend allowlists have drifted; surface the
  backend's `message` rather than a generic string so that's diagnosable.

### B. The options control (`src/components/live/`)

A new component (e.g. `CompileOptions.tsx`), placed in the editor toolbar **left of stdin**, in the
`ml-auto` group at `LiveCodingView.tsx` ~line 153.

- A small trigger button — label it with the count, e.g. `⚙ Options · 2` — opening a popover with
  the checkboxes and the dialect radio group.
- Each row: checkbox, the flag in `font-mono`, and a one-line plain-language gloss. Students are
  learning what these *mean*; the flag alone teaches nothing.
- Reuse existing design tokens (`border-hairline`, `bg-surface-2`, `text-ink-muted`, `ring-pointer`)
  — no new colors. Must work in both themes.
- **Accessibility:** real `<input type="checkbox">`/`<input type="radio">` with labels (not divs),
  keyboard reachable, `Esc` closes the popover, focus returns to the trigger, click-outside closes,
  `aria-expanded` on the trigger.
- **Presentation mode:** the popover must not escape or mis-layer when presenting — check it.

### C. Persistence & wiring

- Persist the selection with `usePersistentState` under a namespaced key (e.g.
  `seviz.live.compileFlags`), so a student's choice survives reloads like the split ratio does.
- **Validate what comes out of storage** against the known flag set before use — a stale or
  hand-edited value must fall back to defaults, never post an unknown flag.
- `run()` in `LiveCodingView.tsx` passes the assembled flags to `postTrace`.
- Show the effective flags near the result (e.g. `gcc -Wall -Wextra -std=c11 …`) so the student can
  see the exact command shape their code was compiled with. This is teaching surface, not chrome.

### D. Copy (write these carefully — they are the lesson)

- A one-line note in the popover: **"`-Werror` turns any warning into a compile error — you'll see
  the compiler output instead of the animation."**
- When a run fails as `compile_error` **and** `-Werror` was on, add a line above the gcc output:
  **"`-Werror` is on, so a warning stopped the build. Untick it to run anyway."** Students will
  otherwise think the tool broke.
- **On a successful run that returned `warnings`,** show them in a collapsible panel above the
  visualization — headed something like "Compiled with warnings" — using the same console styling as
  the compile-error panel but in a non-fatal tone. The program still ran; the point is that it ran
  *despite* something worth fixing. Do not hide it behind a click-to-reveal that a student won't
  notice: the count (or the panel header) must be visible without interaction.

## Constraints

- Frontend only. **Do not change the trace format, the renderer, or the player.**
- React + TS strict, no `any` without justification. `typecheck`/`lint`/`test`/`build` green.
- **Degrade gracefully.** Live Coding is still gated on `VITE_TRACER_URL`; nothing here may affect
  the curriculum modules or any non-live view.
- Additive only — a student who never opens the popover gets the documented defaults, and the
  existing keyboard shortcut (⌘/Ctrl+Enter) keeps working.

## Tests

Follow the existing `src/live/*.test.ts` style (node env, no DOM), so put the logic in a pure,
testable module and keep the component thin:

- Flag assembly: defaults → `['-Wall','-Wextra','-std=c11']`; all off → `['-std=c11']`; dialect
  switch replaces rather than appends; output order is stable.
- `postTrace` includes `flags` when non-empty and **omits the key entirely** when empty (assert the
  serialized body).
- Storage rehydration: a valid stored value round-trips; an unknown flag, a non-array, and malformed
  JSON each fall back to defaults.
- The client tolerates a success response both with and without the echoed `flags`.

## Acceptance criteria

- [ ] Gates green: `typecheck`, `lint`, `test`, `build`. No unjustified `any`.
- [ ] Options popover next to Run: 4 checkboxes + a dialect radio group, defaults `-Wall -Wextra`
      on and `-Werror` off, keyboard accessible, works in both themes and in presentation mode.
- [ ] Selection persists across reloads and is validated on read.
- [ ] Selected flags reach the tracer and demonstrably change the outcome — verified live:
      a program with an unused variable runs fine with `-Werror` off and returns compiler output
      with it on.
- [ ] `-std=gnu89` + a C99-style for-loop declaration fails to compile; `-std=c11` compiles.
- [ ] The `-Werror` explanation appears above the gcc output when that's why the build failed.
- [ ] **With the defaults (`-Wall -Wextra`, no `-Werror`), a program with an unused variable runs
      AND visibly reports the warning** — verified live. This is the acceptance test for the whole
      phase: if ticking the default boxes produces no observable difference, the feature has failed.
- [ ] Effective flags are visible with the result.
- [ ] With no tracer configured, everything behaves exactly as before.

## When done

Write `reports/phase-25-compile-options.md` from `reports/TEMPLATE.md`, commit on branch
`phase-25-compile-options`, and **stop — do not merge.** Include a screenshot or precise description
of the popover in both themes, and note any divergence between the UI's flag set and the backend
allowlist (there should be none — if there is, that's a bug in one of them, and say which).
