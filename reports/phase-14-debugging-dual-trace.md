# Phase 14 Report — Debugging: Dual Trace (SE 200)

## 1. Summary
This phase delivers the SE 200 · Debugging curriculum content as a `view: 'dual-trace'` concept
module: a single max-of-array program run two ways (buggy `a[i] < max` vs fixed `a[i] > max`) over
`a[] = {3, 7, 2, 9}`. The two columns step in lockstep through an 8-step trace; the first row whose
behaviour differs (the `i = 1` comparison) is flagged with `diverged: true` and stays flagged
through to the end. Data-only against the Phase 11 dual-trace contract — no engine, renderer, or
trace-format edits. All four gates (typecheck, lint, test, build) pass.

## 2. What I built
- `src/content/se200/debugging/maxArray.ts` — `ContentModule` (default export) with a
  `dual-trace` `Trace` (`id: 'se200-debugging-max-array'`, `file: 'maxarray.c'`,
  `course: 'SE 200'`, `topic: 'Debugging'`, `order: 20`). `leftSource` = buggy program,
  `rightSource` = fixed program; 8 lockstep steps, each with a `dualTrace` payload of `left`/`right`
  columns (rows `i`, `a[i]`, `max`; `changed` pulses on `max`; cumulative `stdout` on the print
  step). Auto-discovered by folder; no shared-file edits.

## 3. Acceptance criteria — self-assessment

CURRICULUM row covered: SE 200, week 2, Block **Debugging**, Project **C - Debugging**
(`Visualize? Yes (show buggy vs fixed traces)`). Trace `topic` set to `'Debugging'` to match the
Block string and the Phase 11 `dualTrace.ts` fixture.

- [x] **A correct `dual-trace` module: two synchronized runs of one program (buggy vs fixed), equal
  step counts, the first divergence correctly identified and flagged; both final results correct.**
  — `maxArray.ts`: one steps array drives both columns (equal counts by construction, 8 each);
  `diverged: true` from step index 1 (`i1-test`) onward; buggy prints 2, fixed prints 9.
- [x] **Auto-discovered + passes `validateTrace` (incl. equal-length columns / divergence checks);
  SE 200 metadata; no engine/renderer/format edits.** — File sits under
  `src/content/se200/debugging/`; `npm run test` (which runs `validateTrace` over the whole catalog)
  passes 69/69; metadata is `SE 200` / `Debugging`. Only one new file added.
- [x] **Verify both runs' values by hand + throwaway calc.** — Hand-trace in §4 (throwaway node
  calc was sandbox-blocked; values are deterministic integer comparisons and hand-verified).
- [x] **Narration localizes the bug at the first divergence.** — Step `i1-test` narration names the
  flipped operator on line 3 as the bug and states everything below is downstream of it.

## 4. How to run & verify
```
cd /private/tmp/seviz-phase14
npm run typecheck && npm run lint && npm run test && npm run build
```
In the app, open the **SE 200 → Debugging → Max of array** module; scan the two columns top-to-bottom
to the first flagged divergence.

Gate results:
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (6 files, 69 tests; includes catalog-wide `validateTrace`)
- `npm run build` — PASS

### Hand-verification of both runs (`a[] = {3, 7, 2, 9}`, `max = a[0] = 3`)

FIXED (`a[i] > max`):
- i=1: a[1]=7, 7 > 3 TRUE  → max = 7
- i=2: a[2]=2, 2 > 7 FALSE → max = 7
- i=3: a[3]=9, 9 > 7 TRUE  → max = 9
- print → **9** (correct maximum)

BUGGY (`a[i] < max`):
- i=1: a[1]=7, 7 < 3 FALSE → max = 3
- i=2: a[2]=2, 2 < 3 TRUE  → max = 2
- i=3: a[3]=9, 9 < 2 FALSE → max = 2
- print → **2** (a value from the array, but the wrong one)

**Exact first-divergence step:** index 1, id `i1-test` — the `i = 1` comparison. Both columns hold
`i=1, a[i]=7, max=3`, but the buggy test `7 < 3` is false while the fixed test `7 > 3` is true, so
the two runs take opposite branches. `diverged: true` is set from this step through the final
`print` step. The `max` values first visibly differ one step later (`i1-act`: buggy 3 vs fixed 7),
which is the downstream consequence of the divergent branch.

Throwaway calc note: I attempted a `node -e` cross-check but the Bash sandbox denied it; the program
is pure integer comparison with no UB or platform dependence, so the hand-trace above is exhaustive
and definitive.

## 5. Key decisions & deviations
- **Step granularity:** split each loop iteration into a `*-test` step (evaluate the `if`) and a
  `*-act` step (take/skip the branch), per the CONTENT_AUTHORING "one statement per step in loops"
  guidance, so the divergent branch decision and its effect on `max` are each visible.
- **Divergence flagged at the comparison, not the first differing value.** Consistent with the
  Phase 11 `dualTrace.ts` fixture (which flags the control-flow split before the visible state
  diverges) and with the prompt's "diverges at the first comparison (i = 1)".
- **Single module.** A second classic bug was optional ("welcome"); I authored only the
  max-of-array dual-trace to keep correctness surface minimal. No deviation from required scope.
- **`topic: 'Debugging'`** chosen to match the CURRICULUM Block string and the existing fixture's
  topic (so the module groups with the concept-view debugging content).
- No other deviations.

## 6. Trace format / API notes
No trace-format change — used the Phase 11 `dual-trace` view (`Trace.leftSource`/`rightSource`,
per-step `Step.dualTrace = { left, right, diverged? }`, `DualColumn = { label, line?, rows, stdout? }`).
Authored data only against the existing contract; no engine/renderer/types/docs edits.

## 7. Known issues / follow-ups
- None. The pre-existing build "chunks larger than 500 kB" warning is unrelated to this phase.

## 8. File map
Added:
- `src/content/se200/debugging/maxArray.ts`
- `reports/phase-14-debugging-dual-trace.md`
