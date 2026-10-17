# Phase 34: NumPy array view

## Why this phase exists
DS 210 Week 3 teaches NumPy. Arrays are opaque summaries today (Phase 29/30). This phase records
and renders `numpy.ndarray` as a real, steppable view: shape, dtype, values, and the views-versus-
copies distinction that trips learners up.

## Context to read
- `docs/PYTHON_TRACE_FORMAT.md`, `src/python/recorder.py`, the Python renderer and diff (Phase 30),
  derived explanations (Phase 32), Python live coding (Phase 31).

## Hard constraints
- Frontend only, TS strict; all gates pass including the bundle check. No new npm dependencies
  (NumPy comes from Pyodide's package set at the pinned version).
- Additive trace changes only; documented in `docs/PYTHON_TRACE_FORMAT.md`.
- Caps: at most 200 elements captured per array (with an ellipsis marker), at most 3 dimensions
  rendered as grids; larger or higher-dimension arrays fall back to the summary.
- Both themes, tokens only, reduced motion respected.

## What to build
1. **Recorder:** for each ndarray: `shape`, `dtype`, `ndim`, capped flat values in C order,
   whether it owns its data, and if it is a view, the object id of its base (`arr.base`). Scalars
   from NumPy (`np.int64` etc.) display as primitives with their dtype.
2. **Renderer:** 1-D as a row of cells with indices; 2-D as a grid with row and column indices;
   3-D as a stack of 2-D slices with the first axis labeled. Header shows `ndarray`, shape and
   dtype. A view shows a dashed "view of" link to its base; writing through a view highlights the
   shared cells in both.
3. **Diff and motion:** changed cells pulse; reshape and transpose animate cells to new positions
   when the element count is unchanged; new arrays from arithmetic appear next to their operands.
4. **Explanations:** derived text for creation (`np.array`, `arange`, `zeros`, `ones`, `linspace`),
   indexing and slicing (which cells), elementwise arithmetic, broadcasting (state both shapes and
   the result shape), aggregation (`sum`, `mean`, `max`, with `axis`), reshape, transpose, boolean
   masks (which cells are `True`), and view vs copy.
5. **Samples:** commit recorded samples covering each of the above under
   `src/content/fixtures/python/numpy/`.

## Tests
- Recorder output on samples (shape, dtype, cap, base ids).
- Rendering snapshots for 1-D, 2-D, 3-D, view-of link, capped array.
- Diff events for cell change, reshape, view write-through.
- Golden derived explanations for the samples.

## Acceptance criteria
1. Gates pass; additive and documented; caps enforced.
2. View vs copy is unmistakable: modifying a slice view visibly changes the base; modifying a
   `.copy()` does not.
3. Broadcasting explanation states shapes correctly for at least three shape pairs.
4. Both themes; screenshots in the report.

## When done
Write `reports/phase-34-numpy-view.md` from the template. Work on branch
`phase-34-numpy-view`. **Stop without merging** (when running under `prompts/RUNNER-ds-python.md`, follow its merge
rule instead).
