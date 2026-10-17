# Phase 35 Report — pandas DataFrame and Series view

## 1. Summary

pandas `DataFrame`, `Series` and `GroupBy` objects now record and render as steppable tables instead of
a summary box.

- **Recorder.** A DataFrame is recorded with its true shape, its column labels, dtypes and missing
  counts, its index labels, and the first 20 rows of its first 12 columns, each cell cut to 40
  characters. A Series is recorded the same way with one value column. A GroupBy is recorded with its
  keys, its group count, and each group's label, size and first 3 rows (at most 20 groups). A GroupBy
  also records a reference to the object it groups.
- **Renderer.** A table box has a header row (names, plus a dtype line with the missing count), an
  index column and zebra rows. When capped it shows a footer such as "showing 20 of 1,200 rows · 12 of
  15 columns". A Series is a two-column table. A GroupBy is a stack of mini tables, one per group,
  each with its size. A box is at most 34rem wide, and a wider table scrolls inside its own box. A
  table made from another table has a dashed violet "from" link to it.
- **Motion.**
  - A filtered table first shows its source's rows, with the dropped rows struck through in red and
    the kept rows in green. The dropped rows then collapse, the kept rows close up, and a chip says
    "kept 10 of 30 rows".
  - A sorted copy starts in its source's order and its rows glide to their new places. A sort with
    `inplace=True` glides the rows by index label.
  - A column added in place slides in. Changed values pulse. Values filled by `fillna` cross-fade
    from `NaN`.
  - After a jump, or with reduced motion, the final state appears at once. The chip and the green
    marks still show.
- **Explanations.** Derived text covers:
  - reading: `read_csv`, `head`, `info`, `shape`;
  - selection: `df["col"]`, `df[["a", "b"]]`, `loc`, `iloc`;
  - boolean filters: the condition, the kept count and the kept labels;
  - new and changed columns, and single values set;
  - `sort_values` and `sort_index`;
  - `groupby(...).agg(...)` as split, apply, combine;
  - `merge`: the keys, `how`, and the row counts before and after;
  - `isna().sum()`, `fillna` and `dropna`, with counts.
- **Sample data.** `src/python/data/farm.csv` is a synthetic dataset made up for this repo: 30 rows,
  with 5 values missing on purpose. The worker writes it into Pyodide's file system before every run,
  so `pd.read_csv("farm.csv")` works offline in Python live coding. The file ships only in the
  worker chunk.
- **Samples.** Ten recorded pandas samples are in `src/content/fixtures/python/pandas/`, each with a
  golden explanation file.

**Gates on `phase-35-pandas-view`:** `typecheck`, `lint`, `test` (**885/885**, 51 files) and `build`
all pass.

- `check-bundle --baseline 773158 --budget 25000` passes. The main chunk is **773,158 B**, delta
  **+0 B**: none of the pandas code reaches it. The hash changed and gzip grew by 2 B.
- Lazy chunks: `PythonCanvas` is 39,652 B (28,392 in Phase 34), the Python deriver `python-*.js` is
  86,604 B (60,032), and the worker is 74,678 B (it now includes the 1 KB CSV).

**No new dependencies.** pandas 3.0.2 comes from the pinned Pyodide 314.0.7 jsDelivr CDN. Nothing
was merged or pushed, and no stop condition was hit.

## 2. What I built

**Recorder (`src/python/recorder.py`)**
- `_pandas_kind`: finds `DataFrame` / `Series` / `DataFrameGroupBy` / `SeriesGroupBy` by class name
  and module root (subclasses included), without importing pandas.
- `_pandas`: builds the three shapes; `_cell` turns one value into text; `_columns` gives each
  column's label, dtype and missing count over the whole column; `_rows` gives the captured rows.
  - Cell text is a primitive's `repr` (a NumPy scalar's via `.item()`), else the value's `str`.
  - Cells are text only: an object inside a table is never followed as a reference.
- Caps: `TABLE_ROWS = 20`, `TABLE_COLS = 12`, `TABLE_REPR_CAP = 40`, `GROUPS_CAP = 20`,
  `GROUP_ROWS = 3`. A test checks they match `protocol.ts`.
- If the recorder can't read a table, it falls back to the summary instead of stopping the program.
- Measured cost in Pyodide: about 0.4 ms per DataFrame and 0.5 ms per GroupBy per snapshot.

**Trace contract (additive)**
- `PyObjectKind` gains `'dataframe' | 'series' | 'groupby'`.
- `HeapBlock` gains `table?: TableInfo` and `groupby?: GroupByInfo`, and there is a new
  `TableColumn` type.
- `protocol.ts` gains `PyCell`, `PyTableColumn`, `PyDataFrame`, `PySeries`, `PyGroupBy` and the caps.
- **Mapping** (`src/python/mappings/memory.ts`):
  - cells are keyed by row label and column label, `o3.loc[2, 'yield_kg']` (named `2, 'yield_kg'`);
  - a Series cell is `o4.loc['Coast']`;
  - a repeated label gets `#2`;
  - a GroupBy has an `o5.obj` reference and one `o5.groups['Coast']` cell per group (its size).
- **Validator:**
  - `table` facts go with `'dataframe'` / `'series'` of the same kind, and `groupby` facts with
    `'groupby'`;
  - row labels and keys line up;
  - a table has at most one cell per captured row and column;
  - captured plus omitted rows (and columns) equal the shape;
  - a GroupBy's `source` is an object of the step.

**Engine (`src/engine/trace/pandas.ts`, new)**
- Readers: `isTable`, `isGroupBy`, `cellAt`, `tableRows`, `isMissing`, `displayText` (strings
  without quotes, `NaN`), `shapeWords`.
- `tableRelation(source, made)` classifies how a new table relates to its source, from the recorded
  rows: `filter` (with kept, dropped, kept count and total), `sort`, `columns-added`,
  `columns-selected`, `values` (pairs each changed cell with the one it replaced) or `other`.
- `rootName` and `derivedTables(trace)` find which pandas object each new table came from, using the
  statement (see §5, item 1).

**Object diff (`objectDiff.ts`)**
- New events: `column-added` / `column-removed`, `row-added` / `row-removed` and `rows-reordered`.
  Value changes are `value-changed`, as before.
- Row and column additions and removals know about the capped window. Only rows both steps show are
  certain. A row at the window edge counts only as far as the change in the true row count needs it.
  So an in-place `dropna` reports rows 8 and 19 removed, not rows 20 and 21 "added" because they slid
  into view.
- Inverses swap the events, and the fixture-wide inverse test covers every pandas trace.

**Renderer (`src/components/python/`)**
- `TableView.tsx` (new):
  - `TableHeading`, `TableBody` (DataFrame / Series grid, GroupBy stack) and `FromLinks`;
  - the grid is CSS grid rows with `ch` column widths;
  - text columns are left-aligned and numbers right-aligned;
  - missing values are italic and faint;
  - long floats are shortened as in the NumPy view.
- `tableLayout.ts` (new, pure): `columnWidth`, `showingText`, `fromLinkPath`, `DerivedContext`.
- `pyMotion.ts`:
  - `motionCues(state, reduce, derived?)` gains `tables` entrances (filter ghost rows, sort start
    order);
  - a new column joins `entering`, filled values join `changed`, and in-place reorders join
    `restructured`.
- `PySlot.tsx`: `SlotValue` gains an optional `textClass`. The default markup is unchanged.
- `PyViews.tsx`: headings and bodies for the new kinds, and the box width cap.
- `PythonCanvas.tsx`: provides `DerivedContext`, renders `FromLinks`, adds right padding for the
  links' channels, and widens the gutter on table steps as it does on array steps.

**Explanations (`src/engine/explain/`)**
- `pandas.ts` (new): `pandasStatement(ctx, stmt)` returns `{ did, lead, concept }` for everything
  listed in §1. Any other line that makes a pandas object gets one sentence with its shape and its
  source.
- `python.ts`:
  - the library reading is now pandas first, then NumPy;
  - "What changed" gives:
    - a new table's shape and source, for example "New DataFrame `rainy`, 10 rows × 6 columns, from
      `farm` (kept 10 of 30 rows)";
    - rows for columns and rows added or removed, and the new row order;
    - more than 6 changed values of one table as one row.
- `pyState.ts`: `slotPath` names table values `farm.loc[2, 'yield_kg']`.
- `glossary.ts`: 24 pandas entries (`pd-read` … `pd-series-math`).

**Sample data, samples and fixtures**
- `src/python/data/farm.csv` and `index.ts` (`installSampleFiles`).
- `src/python/worker.ts` writes the sample files before every run.
- Live editor: a small "+ farm.csv" hint by `MAIN.PY`, with a tooltip.
- `src/python/samples/pandas/*.py` (10 programs): `read`, `select`, `series`, `filter`, `columns`,
  `sort`, `groupby`, `merge`, `missing`, `capped`.
- `scripts/record-python-packages-fixture.mjs` (`npm run py:record-packages`) now:
  - records the pandas samples too, with the CSV written into the file system;
  - imports NumPy and pandas first, untraced, as the worker does;
  - accepts an optional `SE_VIZ_PYODIDE_CACHE` package cache directory.
- Offline programs (`testPrograms.ts`), re-recorded by `recorder.test.ts` on every `npm test`:
  - `extra-pandas-standin`: stand-in pandas classes that exercise the recorder's pandas path: a
    22 × 13 frame, a 50-character string, `None` and NaN values, and 21 groups;
  - `extra-sample-data`: checks the CSV is in the working directory.

**Tests (+76; 809 → 885)**
- `src/python/pandasRecorder.test.ts` (19):
  - the caps match, and every captured table respects them;
  - dtypes, missing counts and index labels from `read_csv`;
  - `loc` versus `iloc` slices, filter labels;
  - the GroupBy summary, with sizes 7 / 8 / 7 / 8 and the first rows;
  - the 1,200-row and 15-column caps, and the 40-character cut;
  - the stand-in, and the bundled file.
- `src/engine/trace/pandas.test.ts` (11):
  - cell ids, `tableRelation`, `derivedTables`;
  - diff events for an added column, a cell change, a filter (and its entrance), rows dropped in
    place (window-aware), and an in-place sort, each with its inverse;
  - motion cues: column slide, fill cross-fade, sort start order, reduced motion.
- `src/components/python/TableView.test.tsx` (9): snapshots of a DataFrame, a capped DataFrame, a
  Series and a GroupBy; the kept chip; the from link; the layout helpers.
- `src/engine/explain/pandas.test.ts` (15): filter, groupby, merge, missing values, columns and sort
  text. One test per sample checks that every finished assignment gets a pandas sentence.
- `golden.test.ts`: 10 new goldens, `golden/pandas-*.md`. `toTrace.test.ts`: 10 new mapped traces.

## 3. Acceptance criteria — self-assessment

- [x] **1. Gates pass; additive and documented; caps enforced; wide tables scroll within their box.**
  - The gates pass (§1).
  - The changes are additive: new kinds, fields and events only.
  - Every existing golden, every C, NumPy and Phase 29–32 trace, and every pre-existing snapshot is
    byte-identical.
  - Two existing files changed; both are listed in §5.
  - Documented in `docs/PYTHON_TRACE_FORMAT.md` ("pandas tables (Phase 35)") and
    `docs/TRACE_FORMAT.md` ("Phase 35 additions").
  - Caps are tested on real recordings and on the offline stand-in (`pandasRecorder.test.ts`).
  - **Wide tables:** each table sits in `max-w-full overflow-x-auto` inside a box capped at 34rem
    (`TableView.test.tsx`).
  - In the browser at 1680 and 1920 px, `document.documentElement.scrollWidth` equaled the window
    width on every sample and in live coding. The 15-column frame and the 7-column farm frame scroll
    inside their boxes (screenshots).
- [x] **2. A boolean filter step shows exactly which rows were kept and how many.**
  - **Canvas:** the new table shows exactly the kept rows with their original index labels, and
    the chip "kept 10 of 30 rows". On the step itself, the source's rows appear first, the dropped
    ones struck through, then collapse.
  - **Derived text** (`golden/pandas-filter.md`, step 4, `rainy = farm[wet]`):
    > Kept the rows of `farm` where `wet` is `True`: 10 of 30 rows, labelled
    > `2, 4, 7, 10, 11, 15, 18, 23, 26, 27`.
    > `wet` is a Series of `True` / `False` values, one per row of `farm`.
    > `rainy` is a new DataFrame, 10 rows × 6 columns; the kept rows keep their index labels.
    > `farm` itself still has all 30 rows.
  - With an inline condition (step 5):
    > Kept the rows of `farm` where `(farm["rainfall_mm"] < 600) & (farm["crop"] == "maize")` is
    > `True`: 2 of 30 rows, labelled `5, 16`.
  - I checked the labels and counts by hand against `farm.csv`.
- [x] **3. A groupby step reads as split, apply, combine with correct group sizes.**
  `golden/pandas-groupby.md`, step 4, `totals = by_region["yield_kg"].sum()`:
  > 1. Split: the 30 rows of `farm` go into 4 groups by `region`: `Coast` (7 rows), `Highland` (8),
  >    `Lakeside` (7) and `Valley` (8).
  > 2. Apply: the sum of `yield_kg` within each group.
  > 3. Combine: the 4 results become `totals`, a new Series with one value per group, indexed by
  >    `region`: `Coast` `10390.0`, `Highland` `9560.0`, `Lakeside` `7380.0` and `Valley` `6790.0`.
  - The group sizes come from the recorded GroupBy (`gb.indices`). I checked them and the Coast sum
    by hand.
  - On a chained `farm.groupby("crop").agg(...)` no GroupBy object exists in the trace, so the text
    gives the group count but claims no sizes (§7).
- [x] **4. Works in Python live coding with the bundled CSV.**
  - In Chrome (Playwright, dev server) I ran a program in Python live coding that reads
    `farm.csv`, filters it, groups it, adds a column, sorts and prints. pandas loaded from the pinned
    CDN, and the run gave 8 steps.
  - The filter step showed the kept table with its chip, and the text quoted above for this
    program's condition. `print(top)` matched pandas' output.
  - Screenshots `phase35-live-*.png`.
  - `npm test` checks offline that the file is in the working directory (`extra-sample-data`).
- [x] **5. Both themes; screenshots in the report.** See below. Tokens only:
  - `changed` green for kept rows and the chip;
  - `danger` red for dropped rows;
  - `active` amber for missing counts;
  - `static` violet for the "from" links;
  - `heap` teal for group labels.

## 4. How to run & verify

```sh
npm ci
npm run typecheck && npm run lint && npm test && npm run build
node scripts/check-bundle.mjs --baseline 773158 --budget 25000
# → main chunk index-*.js: 773158 B; delta +0 B; ✓
npm run py:record-packages   # optional, network (pinned Pyodide CDN): re-records NumPy + pandas samples
npm run dev
```

1. **Dev preview:** `/?python-preview&trace=pandas/filter`. The other samples are `pandas/read`,
   `select`, `series`, `columns`, `sort`, `groupby`, `merge`, `missing` and `capped`. Step with →
   (two-beat).
   - On `rainy = farm[wet]`, the dropped rows strike through and collapse in about 1.1 s.
   - In `pandas/sort`, `ranked` glides from source order, and the in-place sort glides `plots`.
   - On `plots["yield_per_mm"] = …` (`pandas/columns`), the new column slides in.
2. **Live coding · Python:** run any program with `pd.read_csv("farm.csv")`. The first run downloads
   pandas from the pinned CDN, which took about 40–50 s here.
3. **Regenerate after a recorder change**, in this order:
   1. `npm run py:record-packages`;
   2. `npx vitest run src/python/recorder.test.ts -u`;
   3. `npx vitest run src/python/toTrace.test.ts -u`;
   4. `npx vitest run src/engine/explain/golden.test.ts -u`.

**Browser check (Playwright MCP, Chrome, dev server, 1600–1920 px, both themes):**
- Every pandas sample was stepped in the preview.
- **Motion**, checked by sampling the DOM every 100 ms:
  - **Filter:** 23 rows (20 source rows plus 3 kept rows past the capped window) with 13 struck
    through, held for 0.7 s, then collapsing to 10 rows by 1.2 s.
  - **Sorted copy:** source order for 0.4 s, then the rows' `translateY` eased from 58 / 15 / −29 px
    to 0.
  - **In-place sort:** rows glide from 43 / 57 / −14 px to 0 in about 0.3 s.
  - **Reduced motion** (emulated): no ghost rows, the final 10 rows at once, and the chip present.
- No app console errors.
  - The only error is the existing `favicon.ico` 404.
  - framer-motion logs a warning about reduced motion.
  - Some `target.closest` errors came from my own synthetic key events dispatched on `window`. They
    are not app errors (Phase 34 noted the same).
- The dev server is stopped and the browser closed. `.playwright-mcp/` is not committed.

## 5. Key decisions & deviations

1. **DEVIATION: the "derived from" link is read from the statement, not from pandas.**
   - The prompt asks the recorder for "the object id of the frame it was derived from when pandas
     exposes it cheaply (otherwise none)".
   - pandas 3.0.2 uses copy-on-write and exposes no parent: `_cacher` and `_is_copy` are gone. I
     checked this in Pyodide. So the recorder records none for DataFrames and Series.
   - A GroupBy's `gb.obj` is exposed and is recorded (`source`).
   - The "from" link and the motion still need the source. `derivedTables` reads it from the
     statement that made the table: the name the expression starts from, looked up in the step
     before (`farm[…]`, `farm.sort_values(…)`, `pd.merge(farm, …)`, `by_region[…].sum()`).
   - It then checks how the two tables relate from their recorded rows and values. It is documented
     as inferred, not recorded.
2. **DEVIATION (layout): a derived table sits in its own row, not to the right of its source.**
   - I first placed derived tables beside their source, as Phase 34 does for arrays.
   - In the browser, every reference arrow to them then ran straight through the source table: a
     20-row table is level with the frames' chips.
   - A derived table now keeps its own row (first-appearance order, usually just below). The "from"
     link joins it to its source.
   - "Appears beside its source" is therefore met as "next to it, linked", not side by side.
3. **The filter entrance with a capped source.** The source shows only 20 rows. The entrance shows
   those rows with the dropped ones marked, followed by any kept rows past the window. The chip's
   counts are the true totals ("kept 10 of 30").
4. **Window-aware row events** (§2, Object diff). Without them, an in-place `dropna` on a 30-row
   frame reported rows 20 and 21 as "added", which is false. I found this in the golden review.
5. **Table boxes are capped at 34rem, not NumPy's 44rem,** so the farm frame fits beside the frames
   in the default layout and wider tables scroll inside their box. At narrow canvases (both side
   panels open at 1680 px) the canvas still scrolls sideways slightly, as it does for NumPy.
6. **Extra programs and a script option:**
   - the offline stand-in `extra-pandas-standin` and the file check `extra-sample-data`;
   - the opt-in `SE_VIZ_PYODIDE_CACHE` package cache for the record script (it reuses downloads;
     still the pinned CDN only).
7. **No catalog module,** as in Phase 34. The prompt asks for committed samples. pandas is reached
   through Python live coding (production) and the dev preview.
8. **Glossary, and pandas first.** There are 24 pandas glossary entries. The pandas reading runs
   before the NumPy one, and returns null for any line not about a pandas object, so every NumPy
   golden is unchanged.

**Existing fixtures and tests that changed:**
- `src/python/fixtures/packages-numpy-pandas.json`: re-recorded by `npm run py:record-packages`, as
  the brief asks. Its DataFrame and Series are now tables instead of summaries. Nothing else changed.
  The NumPy fixtures re-recorded byte-identical.
- `src/python/mappings/candidates.test.ts`, test "A: real NumPy and pandas objects …":
  - the expected pandas rows changed from `summary` to `dataframe` / `series` with their cells;
  - it now also asserts the table facts (shape, row keys, column names and dtypes, Series name).
- `src/python/recorder.test.ts`: `beforeAll` now installs the sample files, as the worker does.
- `src/components/live/pythonLive.markup.test.tsx`: one added assertion (`+ farm.csv`).
- `src/python/toTrace.test.ts` and `golden.test.ts`: new pandas blocks only.
- No existing snapshot, golden, or C / NumPy / Phase 29–32 trace changed.

## 6. Trace format / API notes

See `docs/PYTHON_TRACE_FORMAT.md` → "pandas tables (Phase 35)" and `docs/TRACE_FORMAT.md` → "Phase 35
additions". In short:

```ts
type PyObjectKind = … | 'dataframe' | 'series' | 'groupby';
interface TableInfo { kind: 'dataframe' | 'series'; shape: number[]; columns: TableColumn[];
  columnsOmitted: number; rowLabels: string[]; rowKeys: string[]; rowsOmitted: number;
  indexName: string | null; name: string | null }
interface GroupByInfo { keys: string[]; ngroups: number; rowsTotal: number; source: BlockId | null;
  columns: TableColumn[]; columnsOmitted: number;
  groups: { label; key; size; rowLabels: string[]; rows: string[][] }[]; groupsOmitted: number }
// HeapBlock.table? / HeapBlock.groupby?; cells o3.loc[2, 'yield_kg'], o4.loc['Coast'], o5.obj, o5.groups['Coast']
// PyEvent: + column-added | column-removed | row-added | row-removed { objectId, key, index }
//          + rows-reordered { objectId, from: string[], to: string[] }
// pandas.ts: derivedTables(trace) → Map<id, { source, step, relation: TableRelation }>; tableRelation(src, made)
// pandas.ts (explain): pandasStatement(ctx, stmt) → { did, lead, concept } | null
// raw: PyDataFrame / PySeries / PyGroupBy / PyCell; TABLE_ROWS 20, TABLE_COLS 12, TABLE_REPR_CAP 40,
//      GROUPS_CAP 20, GROUP_ROWS 3
```

## 7. Known issues / follow-ups

- **Chained groupby has no group sizes.** In `farm.groupby("crop").agg(...)`, the GroupBy is never
  bound to a name, so the recorder never sees it. The Split sentence gives the group count (the
  result's length) and "one per different value", but no sizes. Binding the GroupBy (`g =
  farm.groupby(...)`) gives the sizes.
- **Inferred sources can miss.** A source is found only when the expression starts from a name bound
  to a pandas object in the step before. For example, `pd.read_csv(...).head(6)` has no source (it
  gets its own sentence), and `wet.sort_values(...).head(3)` gets the generic "made a new DataFrame
  … from `wet`" text. Chains of several methods get that generic sentence.
- **The motion knows only the captured rows.** A sort or filter whose rows are mostly beyond the
  20-row window animates less: the sort entrance is skipped if any row isn't in the source's window.
- **"Changed" counts for a capped table** say "of the 20 rows shown" rather than claiming the total.
- **Wording I am least sure of:**
  - "Each row of the result is a row of `farm` with the matching row of `prices` beside it" (merge);
  - the `head` / `loc` slice chip "kept 4 of 30 rows" (it is a row selection, not a boolean filter).
- **Fixture size.** Raw recordings are 724 KB, mapped traces 1.2 MB, and the stand-in 508 KB. None
  of it is in the bundle.
- **ArrowOverlay limits remain** (Phase 30 / 34): with many tables, the rails to lower tables are
  long vertical runs at the left of the objects area.

## 8. File map

```
src/python/recorder.py, protocol.ts, testPrograms.ts, worker.ts                 (changed)
src/python/data/farm.csv, index.ts                                              (new)
src/python/samples/pandas/{10 programs}.py, index.ts                           (new)
src/python/fixtures/pandas/*.json (10), extra-pandas-standin.json, extra-sample-data.json (new, recorded)
src/python/fixtures/packages-numpy-pandas.json                                  (re-recorded, §5)
src/python/mappings/memory.ts, candidates.test.ts                               (changed)
src/python/pandasRecorder.test.ts                                               (new)
src/python/recorder.test.ts, toTrace.test.ts, debug/PythonSketch.tsx           (changed)
src/content/fixtures/python/pandas/*.json (10)                                  (new, generated)
src/engine/trace/types.ts, validate.ts, objectDiff.ts                           (changed)
src/engine/trace/pandas.ts, pandas.test.ts                                      (new)
src/engine/explain/pandas.ts, pandas.test.ts, golden/pandas-*.md (10)           (new)
src/engine/explain/python.ts, pyState.ts, glossary.ts, golden.test.ts          (changed)
src/components/python/TableView.tsx, tableLayout.ts, TableView.test.tsx (+ snap) (new)
src/components/python/PyViews.tsx, PySlot.tsx, PythonCanvas.tsx, pyMotion.ts, pyLayout.ts (changed)
src/components/live/PythonLiveView.tsx, pythonLive.markup.test.tsx             (changed: farm.csv hint)
scripts/record-python-packages-fixture.mjs                                      (records pandas samples)
docs/PYTHON_TRACE_FORMAT.md, docs/TRACE_FORMAT.md                               (changed)
reports/phase-35-pandas-view.md, reports/assets/phase35-*.png (22)              (new)
```

### Screenshots

A DataFrame from `read_csv`: header row with dtypes and missing counts, index column, zebra rows,
"showing 20 of 30 rows"; `info()` in the panel.

![DataFrame, light](assets/phase35-dataframe-light.png)
![DataFrame, dark](assets/phase35-dataframe-dark.png)

Capped: 1,200 rows ("showing 20 of 1,200 rows"), 15 columns scrolling inside their box ("showing 12
of 15 columns"), a 40-character cell.

![Capped, light](assets/phase35-capped-light.png)
![Capped, dark](assets/phase35-capped-dark.png)

A Series, a Series made from it (`rain * 2`), and a filtered Series with its chip; `rain["Valley"] =
600` in the panel.

![Series, light](assets/phase35-series-light.png)
![Series, dark](assets/phase35-series-dark.png)

GroupBy: stacked mini tables per group with sizes; the panel reads split, apply, combine.

![GroupBy, light](assets/phase35-groupby-light.png)
![GroupBy, dark](assets/phase35-groupby-dark.png)

Boolean filter: the kept rows with their labels and the "kept 10 of 30 rows" chip, and the
entrance's first beat (dropped rows struck through, kept rows green) before they collapse.

![Filter, light](assets/phase35-filter-light.png)
![Filter, dark](assets/phase35-filter-dark.png)
![Filter motion, light](assets/phase35-filter-motion-light.png)
![Filter motion, dark](assets/phase35-filter-motion-dark.png)

Sort: `plots` sorted in place (row order in the panel), `ranked` a sorted copy.

![Sort, light](assets/phase35-sort-light.png)
![Sort, dark](assets/phase35-sort-dark.png)

New and changed columns, and one value set with `loc`.

![Columns, light](assets/phase35-columns-light.png)
![Columns, dark](assets/phase35-columns-dark.png)

Merge (left): keys, how, rows before and after.

![Merge, light](assets/phase35-merge-light.png)
![Merge, dark](assets/phase35-merge-dark.png)

Missing values: `isna().sum()` per column, `fillna` (0.0 where NaN was), `dropna` with counts.

![Missing, light](assets/phase35-missing-light.png)
![Missing, dark](assets/phase35-missing-dark.png)

Python live coding reading the bundled `farm.csv` (note "+ farm.csv" by `MAIN.PY`).

![Live, light](assets/phase35-live-light.png)
![Live, dark](assets/phase35-live-dark.png)
