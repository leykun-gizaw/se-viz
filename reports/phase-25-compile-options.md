# Phase 25 Report — Compile options in Live Coding

## 1. Summary

Live Coding now has a compile-options popover next to **Run**: four warning checkboxes and a
language-standard radio group, defaulting to `-Wall -Wextra` on and `-Werror` off with `-std=c11`.
The selection persists across reloads, is re-validated on read, and reaches the tracer as the
allowlisted `flags` array Phase 08 added. The point of the phase is that the defaults are
*observable*: a program with an unused variable now **runs and shows the warning** — verified live
against a local tracer, screenshot in §4. Ticking `-Werror` turns that same warning into a compiler
-output panel with an explanation of why. Nothing outside Live Coding changed; the trace format, the
renderer, and the player are untouched.

## 2. What I built

| Path | What |
| ---- | ---- |
| `src/live/compileOptions.ts` | **new** — the flag set, defaults, canonical assembly, single-dialect rule, and `parseStoredFlags` storage validation. All pure. |
| `src/components/live/CompileOptions.tsx` | **new** — the trigger + portalled popover. Layout and a11y only; every rule lives in the module above. |
| `src/live/tracerClient.ts` | `flags` in `PostTraceOptions` (omitted when empty); `flags` and `warnings` threaded out of a success. |
| `src/live/runState.ts` | success carries `warnings`/`appliedFlags`; state carries the launched `flags`; new `werrorExplanation`, `warningsHeadline`, `countWarnings`. |
| `src/components/live/LiveCodingView.tsx` | wiring, the `WarningsPanel`, the `CompiledWith` line, and the `-Werror` explanation in `ErrorPanel`. |
| `src/live/compileOptions.test.ts` | **new** — 20 tests: assembly, dialect replacement, allowlist parity, rehydration. |
| `src/live/{tracerClient,runState}.test.ts` | +15 tests for the new client and state behavior. |

## 3. Acceptance criteria — self-assessment

- [x] **Gates green: `typecheck`, `lint`, `test`, `build`. No unjustified `any`.** All four pass;
      **258 tests / 16 files** (was 223 / 14 — +35). No `any` in the phase's code.
- [x] **Options popover next to Run: 4 checkboxes + a dialect radio group, defaults `-Wall -Wextra`
      on and `-Werror` off, keyboard accessible, works in both themes and in presentation mode.**
      Screenshots in §4 for both themes. Real `<input type="checkbox">`/`<input type="radio">` in
      `<fieldset>`/`<legend>`, wrapped in `<label>`, so they are tab-reachable and clickable by
      label. `aria-expanded` + `aria-controls` on the trigger; Esc closes and returns focus
      (verified live: `focusReturnedToTrigger: true`, `triggerAriaExpanded: "false"`);
      click-outside closes. Presentation mode verified — see the layering note in §5.
- [x] **Selection persists across reloads and is validated on read.** Verified live: stored
      `["-Wall","-pedantic","-std=gnu89"]`, reloaded, and the popover came back with `-Wall` ✓,
      `-Wextra` ✗, `-Werror` ✗, `-pedantic` ✓, dialect `gnu89` ✓. Validation verified live too —
      see the `-fsanitize=address` result in §4.
- [x] **Selected flags reach the tracer and demonstrably change the outcome — verified live: a
      program with an unused variable runs fine with `-Werror` off and returns compiler output with
      it on.** Both driven through the real UI against the local tracer; screenshots in §4.
- [x] **`-std=gnu89` + a C99-style for-loop declaration fails to compile; `-std=c11` compiles.**
      Verified live through the app's own proxy: gnu89 → `400 compile_error`,
      `error: 'for' loop initial declarations are only allowed in C99 or C11 mode`; c11 → `200`.
- [x] **The `-Werror` explanation appears above the gcc output when that's why the build failed.**
      Screenshot in §4 — it sits between the headline and the gcc text.
- [x] **With the defaults (`-Wall -Wextra`, no `-Werror`), a program with an unused variable runs
      AND visibly reports the warning — verified live.** **This is the one that matters, and it
      passes.** See §4: the player shows `Step 1 / 5` with the stack/heap panels *and*
      `⚠ COMPILED WITH 1 WARNING` with the gcc text is on screen at the same time, without any
      interaction.
- [x] **Effective flags are visible with the result.** A `COMPILE COMMAND · gcc -Wall -Wextra
      -std=c11 …` line above the result, on both success and failure. It prefers the backend's
      echoed `flags` over our own selection, so it reports what actually happened.
- [x] **With no tracer configured, everything behaves exactly as before.** The feature is still
      gated on `VITE_TRACER_URL` (`tracerConfig()` → `null` → the Live Coding entry never renders),
      and nothing here is imported by any non-live view. With `flags` omitted or empty, `postTrace`
      omits the key entirely — asserted on the serialized body, so the request is byte-for-byte the
      pre-phase one.

## 4. How to run & verify

```sh
# backend (se-viz-tracer, on merged main — Docker running)
npm run serve                     # http://localhost:8080
curl -s localhost:8080/healthz    # {"status":"ok"}

# frontend (this repo)
echo 'VITE_TRACER_URL=/tracer-api' > .env.local
npm run dev                       # http://localhost:5173 → "Live coding" in the sidebar
```

**The acceptance test.** Paste this and press Run with the untouched defaults:

```c
#include <stdio.h>
int main(void)
{
int unused = 5;
printf("hi\n");
return 0;
}
```

![defaults](../../p25-defaults-warning.png)

The program **ran** — `EXECUTION · Step 1 / 5`, transport, stack and heap panels — **and** the
warning is visible without interaction: `⚠ COMPILED WITH 1 WARNING` over
`./usercode.c:4:5: warning: unused variable 'unused' [-Wunused-variable]`, with
`COMPILE COMMAND gcc -Wall -Wextra -std=c11 …` above it.

**Tick `-Werror`, run the same program:**

![werror](../../p25-werror.png)

`COMPILER OUTPUT` → "Your program did not compile." → **"`-Werror` is on, so a warning stopped the
build. Untick it to run anyway."** → the gcc text. The trigger count goes `· 2` → `· 3`.

**The popover, both themes** (light / dark):

![light](../../p25-light.png)
![dark](../../p25-dark.png)

Identical structure in both: a `WARNINGS` fieldset of four rows (checkbox · flag in mono · label ·
gloss), the `-Werror` caution line, then a `LANGUAGE STANDARD` fieldset with two radios. All colour
comes from existing tokens (`border-hairline`, `bg-surface`, `text-ink-muted`, `text-ink-faint`,
`accent-pointer`, `ring-pointer`) — no new colours.

**Storage validation, live.** With `localStorage['seviz.live.compileFlags']` hand-set to
`["-Wall","-fsanitize=address","-std=c11"]`, the reloaded UI showed `· 2` and the intercepted
request body carried `["-Wall","-Wextra","-std=c11"]` — the sanitizer never reached the wire.

**Dialect, live** (through the app's own Vite proxy, same path the UI uses):

| flags | result |
| ----- | ------ |
| `-Wall -Wextra -std=c11` on the unused-variable program | `200`, `warnings` present |
| `-Wall -Wextra -Werror -std=c11` | `400 compile_error`, `error: unused variable 'unused' [-Werror=unused-variable]` |
| `-Wall -Wextra -std=gnu89` on a C99 for-loop | `400 compile_error`, `'for' loop initial declarations are only allowed in C99 or C11 mode` |
| `-Wall -Wextra -std=c11` on the same | `200` |

## 5. Key decisions & deviations

**Two real bugs the live check found that the tests could not.** The repo's vitest environment is
`node`, so components are never rendered in tests — both of these were only visible in a browser:

1. **The popover was clipped.** Absolutely positioned inside the toolbar, it was cut off by the
   resizable editor panel's overflow — the entire `LANGUAGE STANDARD` radio group was invisible, so
   the dialect was unreachable. Fixed by **portalling the panel to `document.body`** and positioning
   it `fixed`, re-anchored to the trigger on resize and on scroll (capture). This is why
   `CompileOptions` has a `panelRef` as well as a `rootRef`: with a portal, "click outside" means
   outside *both*.
2. **It would have floated over presentation mode.** I first gave the portal `z-100`. Pressing `f`
   with the trigger focused enters presentation with the popover still open, and at `z-100` it drew
   *on top of* the presentation overlay (`z-50`). Fixed by slotting it at **`z-40`** — above the
   memory-view layers (cells `z-10`, arrows `z-20`, tooltip `z-30`), below the overlay — so the
   overlay covers it by construction rather than by remembering to close it. I also **removed the
   `stopPropagation()`** from the Esc handler: outside presentation the global "exit presentation"
   is a no-op, and inside it one Esc should do both. Verified live: presentation renders clean, and
   a single Esc dismissed both.

**A copy collision I only saw on screen.** The flags line was labelled "Compiled with" and the
warnings panel is headed "Compiled with N warnings" — stacked vertically they read as a stutter. The
flags line is now **`COMPILE COMMAND`**.

**Decisions the prompt left open:**

- **The warnings panel is `<details open>`.** The spec requires the header/count be visible without
  interaction; I default it to *expanded* as well. A warning a student has to click to discover is a
  warning they will not read, and the whole phase exists to make these visible. They can collapse it.
- **`warnings` is capped and blank-checked client-side too.** A whitespace-only string is treated as
  absent so the panel can never render empty, even if a future backend sends `""`.
- **The count on the trigger counts warning toggles only, not the dialect** — there is always exactly
  one dialect, so counting it would make "0 selected" impossible and the number meaningless.
- **`COMPILE COMMAND` prefers the backend's echoed `flags`** over the local selection, falling back
  when absent. If the two ever disagree, the student sees what actually ran.
- **The command shape ends in `…`** rather than spelling out `-ggdb -O0 -fno-omit-frame-pointer`.
  Those are the recorder's pinned tracing flags, not the student's choice, and listing them would
  imply otherwise.
- **`RunState` gained a required `flags` field on the `run` action.** Deliberate: the `-Werror`
  explanation must describe *the run being shown*, not the current picker state, which the student
  can change mid-run. This meant **updating 6 existing call sites in `runState.test.ts`**
  (`{type:'run'}` → `{type:'run', flags: []}`) — the only pre-existing test file I modified, and only
  mechanically. `warnings`/`appliedFlags` are optional keys, so the existing `toEqual` assertions on
  the success status still pass untouched.
- **Storage is validated at point of use, not inside `usePersistentState`.** That hook is shared with
  other views; changing its contract to add validation would have been a wider blast radius than this
  phase warrants. `LiveCodingView` holds it as `unknown` and runs `parseStoredFlags` in a `useMemo`,
  so an invalid stored value can never be *used* even though it stays in storage until the next edit.

**No deviation from the flag set.** The UI offers exactly the six backend-allowlisted tokens.
`compileOptions.test.ts` asserts parity **in both directions** — nothing offered that the backend
rejects, and nothing accepted that the UI hides — so a future change to either list breaks a test
rather than shipping a checkbox that always errors.

## 6. Trace format / API notes

**The trace format is untouched.** This phase changes only the Live Coding request/response envelope,
which is the tracer's contract, not SE-Viz's:

```jsonc
// request  (flags omitted entirely when empty)
{ "source": "…", "stdin": "…?", "flags": ["-Wall", "-Wextra", "-std=c11"] }
// 200
{ "trace": { /* unchanged */ }, "flags": ["-Wall","-Wextra","-std=c11"],
  "warnings": "…gcc text…",       // only when the compile warned
  "truncated": { … } }            // only when a cap hit
```

Both `flags` and `warnings` are treated as **optional on the way in** — a tracer older than its Phase
08 sends neither, and malformed values (`flags` not an array, `warnings` not a string) are dropped
rather than failing the run. Tests cover the with-and-without cases explicitly.

The UI's flag vocabulary lives in `src/live/compileOptions.ts` and mirrors the tracer's
`ALLOWED_FLAGS`. Per the Phase 08 report, the recorder image's gcc is **4.9.2 and supports all six**,
so nothing was dropped from the UI. That report also confirmed empirically that a trailing `-std=`
wins, which is what makes the `-std=gnu89` radio actually override the recorder's built-in `-std=c11`
— worth knowing if anyone later wonders why appending works.

## 7. Known issues / follow-ups

- **`warnings` is a raw gcc string**, rendered as a `<pre>`. Per-line gutter markers in the editor
  would need it parsed into `{ line, column, severity, message, flag }` — noted as a follow-up in the
  tracer's own Phase 08 report too, and still the right call to defer.
- **The warning count is a heuristic**: `countWarnings` counts lines containing `warning:`, which is
  one per gcc diagnostic in every case observed. A pathological program whose *source text* echoes in
  a caret line containing `warning:` could over-count. It only affects a headline number.
- **No component tests.** The repo's vitest environment is `node` with no DOM, so the popover's
  mechanics (Esc, click-outside, focus return, portal placement) are covered by the live verification
  in §4 rather than by automated tests. Adding jsdom would be a repo-wide decision, not this phase's.
- **`-pedantic` only, not `-Wpedantic`** — matching the backend allowlist exactly.
- **Presentation mode hides the picker** (the overlay covers the editor toolbar), so flags can only
  be changed before presenting. That seems right for a live session, but it is a behavior worth
  confirming with whoever teaches with it.

## 8. File map

```
src/live/compileOptions.ts             (new)  flag set, assembly, single-dialect rule, storage validation
src/live/compileOptions.test.ts        (new)  20 tests incl. two-way allowlist parity
src/components/live/CompileOptions.tsx (new)  trigger + portalled popover, a11y
src/live/tracerClient.ts               (mod)  flags out, flags + warnings in
src/live/tracerClient.test.ts          (mod)  +7 tests (body shape, echo, tolerance, malformed)
src/live/runState.ts                   (mod)  warnings/appliedFlags/flags + the three copy helpers
src/live/runState.test.ts              (mod)  +8 tests; 6 mechanical call-site updates
src/components/live/LiveCodingView.tsx (mod)  wiring, WarningsPanel, CompiledWith, -Werror line
reports/phase-25-compile-options.md    (new)  this report
```

Screenshots referenced in §4 were captured from the running app at `localhost:5173` against the local
tracer and live in the workspace root (`p25-*.png`), outside both repos.
