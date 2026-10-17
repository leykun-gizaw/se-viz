# ds-python unattended run — summary

- Date: 2026-10-17
- Starting `main` commit: `688555a` (Merge static-libraries-code-examples …)
- Integration branch: `ds-python` (first commit `aa8aa37`: roadmap, phase 28–37 prompts, runner)
- Baseline main chunk on `ds-python` after setup: `index-*.js` = **717739 B** (`npm run build`)

| Phase | Branch | Result | Gates | Main chunk (bytes) | Deviations / notes |
|-------|--------|--------|-------|--------------------|--------------------|
| 28 Studio shell | `phase-28-studio-shell` | MERGED to ds-python | typecheck/lint/test (435)/build/bundle ✓ on branch and ds-python | 742443 (+24704 vs 717739; ~300 B under budget) | No design canvas available, layout follows the prompt text. Worked around a react-resizable-panels 4.11.2 crash when panels unmount (group remounts between player and non-player views). Top-bar scrub replaced by the timeline. No "authored beats" markers (no such field). Memory canvas narrower at default widths. See report §5. |
| 29 Pyodide tracer spike | `phase-29-pyodide-tracer-spike` | MERGED to ds-python | typecheck/lint/test (510)/build/bundle ✓ on branch and ds-python | 742443 (+0; Python code is dev-only) | Candidate **A (reuse the C model)** chosen: passes all 6 criteria (B fails #4, C loses tie-break). `pyodide@314.0.7` (published 2026-09-14) is the only new dep. check-bundle gained an additive "no Pyodide in main chunk" check. Added caps the prompt does not name (maxContainerItems 100, maxObjects 300, user-frame depth 200). Deep recursion makes ~4.3 MB of JSON; a bare `except:` can swallow the recorder stop (only the wall-clock kill ends it). See report §5/§7. |
| 30 Python renderer | `phase-30-python-renderer` | MERGED to ds-python | typecheck/lint/test (610)/build/bundle ✓ on branch and ds-python | 764255 (+21812; ~17.5 KB is harvest trace data; renderer is a lazy `PythonCanvas-*` chunk) | Followed PYTHON_TRACE_FORMAT.md on data shapes, but built a dedicated lazy Python canvas (the doc said A needs "no new renderer"; the prompt asks for per-kind bodies + motion). Motion diffs against the previously *displayed* step. Dev-only `/?python-preview` page for non-catalog samples. Harvest module filed under Engine fixtures with a "DS 200" breadcrumb. Possible pre-existing C pulse suppression by `AnimatePresence initial={false}` noted, not touched. |
| 31 Python live coding | `phase-31-python-live-coding` | MERGED to ds-python | typecheck/lint/test (682)/build/bundle ✓ on branch and ds-python | 765413 (+1158; Pyodide worker + lang-python are lazy) | `@codemirror/lang-python@6.2.1` (2025-05-14) only new dep, single copy of @codemirror/state/view. Packages loaded via allow-listed `find_imports` + `loadPackage` instead of `loadPackagesFromImports` (which would load any import). Added `maxTraceChars` (8M) size cap and 100-frame live recursion cap. Steps stream from the worker so stopped/killed runs keep them. Production check needed an empty `envDir` because the local `.env.local` sets `VITE_TRACER_URL`. Bare `except:` can still swallow the recorder stop (run is killed, steps kept). |
| 32 Derived explanations | `phase-32-derived-explanations` | MERGED to ds-python | typecheck/lint/test (741)/build/bundle ✓ on branch and ds-python | 772840 (+7427; Python deriver is a lazy `python-*` chunk, 40 KB) | Design canvas unavailable: the prompt's `harvest[crop] += 10` example is matched by a new `extra-augassign` sample. Recorder fixtures re-recorded (orchestrator verified: identical apart from the new keys). `recorder.test.ts` size-budget **input** raised 50k→60k (bound 55k→66k) because snapshots grew; assertions unchanged — reviewed and accepted. Recorder fix: module-level comprehensions hid globals (3.12+). Python narration + condition chips are now derived at mapping time (beyond the prompt). `packages-numpy-pandas.json` not re-recorded (needs network). |
| 34 NumPy view | `phase-34-numpy-view` | MERGED to ds-python | typecheck/lint/test (809)/build/bundle ✓ on branch and ds-python | 773158 (+318; NumPy code lives in the lazy Python chunks) | Arrays over 200 values / >3-D show a summary with a 24-value preview (not a partial grid). Recorder adds `layout` (offset/strides/itemsize) to locate view-shared cells. Statement facts keep slice/tuple indices (regenerated `extra-dict-keys.json`). `packages-numpy-pandas.json` re-recorded. Pyodide NumPy default int is `int32`. No catalog NumPy module (trace data would blow the budget); reached via live coding + dev preview. Agent suspects Phase 30 list-insert motion may never play (same AnimatePresence pattern) — unverified. |
| 35 pandas view | `phase-35-pandas-view` | MERGED to ds-python | typecheck/lint/test (885)/build/bundle ✓ on branch and ds-python | 773158 (+0; pandas code + farm.csv live in lazy chunks) | pandas 3.0.2 has no cheap derived-from link, so "from" comes from the statement + row comparison (GroupBy uses `gb.obj`). Derived tables sit on their own row with a dashed "from" link (side-by-side made arrows cross tables). Table boxes capped at 34rem. Synthetic `src/python/data/farm.csv` (30 rows). `packages-numpy-pandas.json` re-recorded (tables instead of summaries). Fixtures add ~2.4 MB to the repo (none shipped). Chained `groupby().agg()` gets group count but not sizes. |
| 36 matplotlib output | `phase-36-matplotlib-output` | MERGED to ds-python | typecheck/lint/test (960)/build/bundle ✓ on branch and ds-python | 774621 (+1463; figure display + sanitizer are a lazy `FigureOutput-*` chunk) | Hand-written two-layer SVG sanitizer (strict XML parse + allow-list rewrite, then DOMParser + DOM re-check, `replaceChildren`); no `dangerouslySetInnerHTML`/`innerHTML` in code (orchestrator grep). matplotlib 3.10.8 from the pinned CDN. Figures stored once per trace (`Trace.figures` with `step`). Extra guard: no PNG attempted past 3000×3000 px. Figures past 6 listed as "not kept" notes. matplotlib `<style>` dropped, stroke rule reapplied with scoped CSS. A stopped/killed run captures no end-of-run figures. Axes repr shows as a noisy "What changed" row when a title is set. |
| 37 Concept views | `phase-37-concept-views` | MERGED to ds-python | typecheck/lint/test (1052)/build/bundle ✓ on branch and ds-python | 798437 (+23816; ~1.2 KB under budget; renderers are lazy chunks) | Seeded TS generators for search/sort, Big O growth, sampling distribution and a permutation test; 11 modules under Engine fixtures (`course: 'DS 210'`). The bars view's "What changed" shows a note (Phase 28 `pipeline` precedent, needed for the budget); "What this step did" states every change. Merge sort counts writes, not swaps. p-value = exact count over its own shuffles; within 0.6 Monte Carlo SE of the exact permutation p. Orchestrator checked that the main chunk's only static import (1,216 B runtime helper) is identical on ds-python, so the size is like-for-like. |

## For the reviewer

**State:** all nine in-scope phases (28–32, 34–37) are merged into `ds-python` and pushed, each with its own branch and report. `main` was not touched (still `688555a`, local and origin). Phases 33 and 38 were not started (out of scope). For every phase, the orchestrator re-ran all five gates on the phase branch and again on `ds-python` after the merge, and read the test diffs. Tests went from 315 to 1052. The main chunk went from 717,739 B to 798,437 B (+80.7 KB in total, each phase within its 25 KB budget).

**Look at first**
1. **Phase 28 Studio shell:** this is what SE 200 / SE 201 classes will see first. Built without the Direction A design canvas (the link was never available), so compare the screenshots with the canvas. Known costs:
   - the memory canvas is about 480 px wide at default widths (was about 730 px), so linked-list arrows can route awkwardly;
   - the top-bar scrub was replaced by the timeline;
   - the panel group remounts between player and non-player views to work around a `react-resizable-panels` 4.11.2 crash.
2. **Phase 29 `docs/PYTHON_TRACE_FORMAT.md`** (candidate A) is the contract every later phase builds on.
3. **Phase 31 live coding ships to production** with no env flag. It loads Pyodide 314.0.7 and its packages from jsDelivr (cold load about 9 s; pandas about 40–50 s on a cold cache).
4. **Phase 36 SVG sanitizer** (`src/components/python/figure/sanitizeSvg.ts`) is hand-written security code, so give it a careful read.

**Known risks and open items**
- **Bundle headroom is nearly gone:** Phase 37 ended about 1.2 KB under its budget, and Phase 28 about 300 B under. Phases 33 and 38 (course content) will need lazily loaded traces or a new budget decision.
- **Recorder stop:** a bare `except:` in student code can swallow the recorder's stop. The wall-clock kill still ends the run and keeps its steps, but the swallow isn't prevented.
- **Possible motion bugs (unverified):**
  - Phase 34 suspects that Phase 30's list-insert motion may never play (the same `AnimatePresence initial={false}` pattern it had to fix for reshape);
  - Phase 30 suspects the same pattern for the C value pulse.
  - Neither was checked or fixed, because no prompt in this run covered it.
- **Early stops:** a stopped or killed Python run captures no end-of-run matplotlib figures.
- **Content placement:**
  - The new Python, NumPy, pandas and concept modules sit under "Engine fixtures" with "DS 200" / "DS 210" labels that `CURRICULUM.md` doesn't define yet.
  - NumPy, pandas and matplotlib have no catalog modules (budget); they're reachable through Python live coding and the dev-only `/?python-preview&trace=…` page.
- **Repo size:** recorded fixtures added several MB to the repo (pandas alone about 2.4 MB). None of it ships in the bundle.
- **Local env:** `.env.local` here sets `VITE_TRACER_URL`. Phase 31's no-env-vars production check used an empty `envDir`.

**Test edits worth a glance** (judged not to weaken anything):
- Phase 32 raised the size-budget **input** in `recorder.test.ts` (50k → 60k, bound 55k → 66k) because snapshots grew; the assertions are unchanged.
- Phases 30, 34 and 35 updated the expected rows in `candidates.test.ts` as summaries became real types. The assertions were extended, not loosened.

**Unsure of**
- **Explanation goldens** (`src/engine/explain/golden/*.md`): every sentence there should be read once by a human. The agents flagged a few as true but clumsy (for example "Got `None` back from …", lambdas labelled `lambda(0)`).
- **Phase 32 deviation:** Python narration and condition chips are now derived when a run is mapped to a trace. That goes slightly beyond the prompt.
