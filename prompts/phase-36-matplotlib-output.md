# Phase 36: matplotlib figure output

## Why this phase exists
DS 210 Week 4 is visualisation. When learner code calls matplotlib, the figure should appear as
step output in the player, at the step that produced it.

## Context to read
- `src/python/recorder.py`, `worker.ts`, Python live coding (Phase 31), the console panel
  (`src/components/ConsolePanel.tsx`), `docs/PYTHON_TRACE_FORMAT.md`.

## Hard constraints
- Frontend only, TS strict; all gates pass including the bundle check. No new npm dependencies
  (matplotlib from Pyodide's package set).
- Additive trace changes only; documented. Use the non-interactive `Agg` backend.
- Size caps: at most 6 figures per run; each rendered as SVG if under 300 KB, otherwise PNG at
  100 dpi; anything larger is replaced by a "figure too large" note.
- SVG output must be sanitized before display (no scripts, no external references, no
  `foreignObject`); insert via `DOMParser` into a container, never `dangerouslySetInnerHTML`.

## What to build
1. **Capture:** patch `plt.show()` in the recorder to snapshot all open figures, then close them;
   also snapshot open figures at the end of the run. Each figure is attached to the step where it
   was produced, with an id, title (if set), and format.
2. **Display:** an output area in the console panel listing figures for the current step and all
   earlier steps (cumulative like stdout), as thumbnails that open a larger view in the stage.
   Stepping back hides figures produced later.
3. **Theme note:** figures keep matplotlib's own colors; place them on a neutral surface so they
   read in both themes.
4. **Explanations:** derived text naming the chart type from the calls made (`plot`, `scatter`,
   `bar`, `hist`, `pie`, `boxplot`) and the labels set.
5. **Samples:** line, scatter, bar, histogram, and a figure with two subplots, under
   `src/content/fixtures/python/matplotlib/`.

## Tests
- Sanitizer: rejects scripts, event handlers, external hrefs, `foreignObject`.
- Capture on samples: figure count, step attachment, format selection by size.
- Stepping back hides later figures (pure selector test).

## Acceptance criteria
1. Gates pass; additive and documented; sanitizer in place; no `dangerouslySetInnerHTML`.
2. All five samples show the right figures at the right steps in live coding.
3. Caps enforced; the app stays responsive with 6 figures.
4. Screenshots in both themes in the report.

## When done
Write `reports/phase-36-matplotlib-output.md` from the template. Work on branch
`phase-36-matplotlib-output`. **Stop without merging** (when running under `prompts/RUNNER-ds-python.md`, follow its merge
rule instead).
