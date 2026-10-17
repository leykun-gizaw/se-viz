# Phase 35: pandas DataFrame and Series view

## Why this phase exists
DS 210 Weeks 3 to 5 (and the Maji Ndogo-style farm data assignments) are pandas-heavy. This phase
records and renders `DataFrame` and `Series` objects as tables learners can step through: which
rows a filter keeps, which column an assignment adds, how `groupby` splits and combines.

## Context to read
- `docs/PYTHON_TRACE_FORMAT.md`, `src/python/recorder.py`, the NumPy view (Phase 34) for patterns
  (caps, summaries, view links), the Python renderer and diff (Phase 30), derived explanations
  (Phase 32).

## Hard constraints
- Frontend only, TS strict; all gates pass including the bundle check. No new npm dependencies.
- Additive trace changes only; documented.
- Caps: at most 20 rows and 12 columns captured per frame (head plus a marker with the true
  shape); cell `repr` capped at 40 characters.
- Both themes, tokens only, reduced motion respected. Tables scroll inside their box; they never
  widen the page.

## What to build
1. **Recorder:** for DataFrame: shape, column names and dtypes, index labels, capped values, and the
   object id of the frame it was derived from when pandas exposes it cheaply (otherwise none). For
   Series: name, dtype, index, capped values. For `DataFrameGroupBy`: the grouping keys, group
   labels and sizes (capped at 20 groups).
2. **Renderer:** a table with a header row (column names and a dtype line), an index column, zebra
   rows, and a "showing 20 of 1,200 rows" footer when capped. Series as a two-column table. GroupBy
   as stacked mini tables per group (first rows of each) with group sizes.
3. **Diff and motion:** new column slides in; changed cells pulse; rows dropped by a filter fade
   and the kept rows close up, with a chip "kept 7 of 20 rows"; sorting animates rows to new
   positions by index label; a new DataFrame from an operation appears beside its source with a
   "from" link.
4. **Explanations:** derived text for reading (`read_csv` from a bundled sample file, `head`,
   `info`-like summaries), selection (`df["col"]`, `df[["a","b"]]`, `loc`, `iloc`), boolean
   filtering (state the condition and the kept count), new or changed columns, `sort_values`,
   `groupby(...).agg(...)` (split, apply, combine in three sentences), `merge` (keys, how, row
   counts before and after), and missing values (`isna`, `fillna`, `dropna` with counts).
5. **Sample data:** a small synthetic farm dataset (CSV, under 50 rows, made up for this repo,
   columns like region, crop, rainfall_mm, yield_kg) bundled so `read_csv` works offline in
   Pyodide's virtual filesystem. Commit recorded samples under `src/content/fixtures/python/pandas/`.

## Tests
- Recorder output on samples (caps, dtypes, index, groupby summary).
- Rendering snapshots: DataFrame, capped DataFrame, Series, GroupBy.
- Diff events: add column, filter, sort, cell change.
- Golden derived explanations.

## Acceptance criteria
1. Gates pass; additive and documented; caps enforced; wide tables scroll within their box.
2. A boolean filter step shows exactly which rows were kept and how many.
3. A groupby step reads as split, apply, combine with correct group sizes.
4. Works in Python live coding with the bundled CSV.
5. Both themes; screenshots in the report.

## When done
Write `reports/phase-35-pandas-view.md` from the template. Work on branch
`phase-35-pandas-view`. **Stop without merging** (when running under `prompts/RUNNER-ds-python.md`, follow its merge
rule instead).
