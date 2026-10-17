# Phase 37 Report — Algorithms and statistics concept views

## 1. Summary

SE-Viz has three new concept views. They play in the same player as every other trace, with the
same transport, timeline, narration, explanation panel and presentation mode:

- **`bars`** shows search and sort. The array is drawn as bars with values and indices. Each step
  marks the compared bars, the swapped or written bars, the sorted region, a search range,
  labelled pointers (`low` / `mid` / `high`, `i`, `j`, `min`, `key`) and, for merge sort, the split
  tree (one row per level). Comparison, swap and write counters sit above the bars.
- **`growth`** shows Big O. Five curves (O(1), O(log n), O(n), O(n log n), O(n²)) share one pair of
  axes. Each step doubles n and moves a marker along every curve. A table gives the counts at n,
  and a caption compares two curves.
- **`distribution`** has two modes:
  - *sampling*: a skewed population, and a histogram of sample means that builds into the bell
    shape, with the normal curve the central limit theorem predicts;
  - *hypothesis*: a permutation test with the null distribution, the observed difference (mirrored
    for a two-tailed test), the shaded tail and the p-value.

Every trace comes from a deterministic, seeded TypeScript generator in `src/engine/concept/`, and
the generator writes each step's explanation from its own state. Eleven modules are registered as
top-level fixtures: linear search, binary search (found and not found), bubble, selection,
insertion and merge sort, Big O growth, the sampling distribution, and the one- and two-tailed
hypothesis tests.

**Gates on `phase-37-concept-views`:** all pass.
- `typecheck` and `lint` pass.
- `test`: **1052 / 1052** across 61 files.
- `build` passes.
- `check-bundle --baseline 774621 --budget 25000`: the main chunk is **798,437 B**, **+23,816 B**.
  This is an honest number; see §5, item 1 for how I made sure of that.

There are no new dependencies. Nothing was merged or pushed. No stop condition was hit.

## 2. What I built

**Trace format** (`src/engine/trace/types.ts`, additive):
- `TraceView` gains `'bars' | 'growth' | 'distribution'`.
- `Step` gains `bars?`, `growth?` and `distribution?`.
- New types: `BarsStep`, `BarsPointer`, `BarsSegment`, `BarsCounters`, `GrowthStep`, `GrowthCurve`,
  `DistributionStep` and `DistributionBin`.
- Documented in `docs/TRACE_FORMAT.md`, under "Phase 37 additions".

**Validation** (`src/engine/trace/validate.ts`, `validateConceptStep` and `validateBarsCounters`):
- every step has the payload that matches its view;
- bars:
  - indices are in range, and pointers may sit at −1 or n;
  - keys are unique;
  - the range and the segments lie inside the array;
  - counters are whole numbers and never go down;
- growth: `n` is one of the `ns`, there is one count per n, the compared ids exist, and `yMax > 0`;
- distribution:
  - the bins are contiguous and their counts add up to `draws`;
  - the population's bins add up to its size;
  - sampling mode needs a population;
  - hypothesis mode needs a test whose `pValue` equals `extreme / draws`.

**Generators** (`src/engine/concept/`):
- `random.ts`: mulberry32 `seeded`, `randInt`, `shuffled` and `distinctInts`.
- `stats.ts`: `describe` (mean, SD, skewness), bins, and the shared number formatting.
- `trace.ts`:
  - `conceptStep` builds a step whose `explain.did` is the generator's text, with the narration as
    the same text in plain form;
  - `conceptModule` builds a DS 210 trace and its `ContentModule`.
- `bars.ts`:
  - `linearSearchSteps` and `binarySearchSteps` (a target that is present or absent);
  - `bubbleSortSteps` (stops early after a pass with no swaps), `selectionSortSteps`,
    `insertionSortSteps` (by adjacent swaps) and `mergeSortSteps` (split steps, one step per merge
    comparison, a "rest follows" step, and the split tree).
- `growth.ts`: `growthSteps(stepsN, pairs, yMax)`.
- `distribution.ts`: `samplingSteps` / `samplingRun`, and `testSteps` / `testRun` / `isExtreme`
  (the permutation test, in exact whole units).

**Renderers** (`src/components/concept/`):
- `BarsView.tsx`, `GrowthView.tsx` and `DistributionView.tsx` draw with SVG and React using `--se-*`
  tokens.
- `Stage.tsx` loads each one lazily, behind `Suspense`.
- Concept colours are new `--se-cv-*` custom properties in `src/index.css`. They are mixed from the
  theme tokens (§5, item 5).

**Modules** (`src/content/fixtures/concept*.ts`):

| File | Order | View |
|------|-------|------|
| `conceptLinearSearch` | 50 | bars |
| `conceptBinarySearch` | 51 | bars |
| `conceptBinarySearchAbsent` | 52 | bars |
| `conceptBubbleSort` | 53 | bars |
| `conceptSelectionSort` | 54 | bars |
| `conceptInsertionSort` | 55 | bars |
| `conceptMergeSort` | 56 | bars |
| `conceptGrowth` | 60 | growth |
| `conceptSampling` | 70 | distribution |
| `conceptHypothesisTest` (one-tailed) | 71 | distribution |
| `conceptHypothesisTwoTailed` | 72 | distribution |

They appear under **Engine fixtures**, in the topics "Search and sort views", "Big O views" and
"Statistics views".

**Tests** (70 new tests):
- `src/engine/concept/bars.test.ts` (19)
- `src/engine/concept/distribution.test.ts` (17)
- `src/engine/concept/growth.test.ts` (4)
- `src/components/concept/conceptViews.test.tsx` (12, with 11 snapshots)
- `src/engine/trace/validateConcept.test.ts` (7)
- 11 golden cases added to `src/engine/explain/golden.test.ts`

## 3. Acceptance criteria — self-assessment

- [x] **1. Gates pass; no new dependency; additive and documented.**
  - All five gates pass (§1). `package.json` and the lockfile are untouched.
  - The trace change is new optional fields and new `TraceView` members only. No existing payload
    or renderer changed.
  - Documented in `docs/TRACE_FORMAT.md` (Phase 37 section) and `docs/CONTENT_AUTHORING.md`.
- [x] **2. Every generator's explanation text matches its state at every step (golden tests).**
  - **Goldens:** `src/engine/explain/golden/concept-*.md` has 11 files, one per module. Each step
    shows a one-line **state** (values, compared, swapped or written, sorted, pointers, range,
    segments and counters; or n and the counts; or draws, statistics and the test) above the panel's
    text. I read the bubble, selection, insertion, merge and binary-search goldens, and the
    statistics ones, against their state lines.
  - **Machine checks, beyond the goldens:**
    - `bars.test.ts` `checkText` parses every step of all 4 sorts over 46 inputs (distinct values,
      duplicates, sorted, reversed, length 1), and the searches over many targets. "Comparisons so
      far", "Swaps so far" and "Writes so far" must equal the counters. The values in "Compared x
      and y" must be the values at the compared or swapped indices. The `low` / `high` / `mid` text
      must equal the pointers, and `mid` must equal ⌊(low + high) / 2⌋. Every "Checked index",
      "Swapped … into index", "goes next, into index" and "Sorted: […]" must match the array.
    - `growth.test.ts` checks every quoted count and ratio against the curves.
    - `distribution.test.ts` checks every quoted mean, SD, bin, count and p-value against the
      payload and against values recomputed from the raw draws.
- [x] **3. The sampling distribution visibly approaches a bell shape; the hypothesis test's p-value
  matches a direct calculation within rounding.**
  - **Bell shape:**
    - The screenshots `phase37-sampling-early-light` (3 means), `phase37-sampling-mid-dark` (50)
      and `phase37-sampling-end-light` (1,000) show the build.
    - Tests:
      - The population's skewness is 2.01.
      - With 4,000 means per sample size, the skewness of the sample means falls strictly toward 0
        as the sample size grows: n = 1 → 2.205, 2 → 1.490, 5 → 0.787, 10 → 0.573, 30 → 0.371,
        60 → 0.233. Each value is within 0.25 of 2.01 / √n.
      - In the module (n = 30), the 1,000 means have skewness 0.25, less than a quarter of the
        population's.
      - The KS distance to the predicted N(μ, σ/√30) shrinks: 10 means > 100 means > 1,000 means,
        and it is below 0.05 at 1,000.
      - The final SD is within 10 % of σ/√n.
    - **Note:** with a fixed sample size, the *running* skewness as means accumulate is noisy (0.05
      at 250 means, 0.35 at 500, 0.25 at 1,000). It converges to ≈ 2.01 / √30 ≈ 0.37, not to 0.
      So I test the shrinking against the sample size and the KS distance, not a monotone running
      skewness. The view says "skewness 0.25 against 2.01 for the population"; it does not say 0.
  - **p-value**, checked three ways in `distribution.test.ts`, for both tails:
    1. **Direct count:** at every step, the test counts the generator's raw shuffles itself, in
       centimetres, independently of the generator's unit arithmetic. That count equals `extreme`,
       `pValue` equals count / draws exactly, and the narration quotes it to 3 decimals.
    2. **Exact permutation p-value:** the test enumerates all C(20, 10) = 184,756 splits.
       - One-tailed: exact **0.0144**, module **0.012** (12 / 1,000). The Monte Carlo SE is 0.0038,
         so the gap is 0.6 SE.
       - Two-tailed: exact **0.0288**, module **0.026** (26 / 1,000). The SE is 0.0053, so the gap
         is 0.5 SE.
       - The test requires a gap under 3 SE.
    3. **Normal approximation**, computed separately with an erf written in the test: null SD
       0.596, z = 2.18. It gives one-tailed 0.0146 and two-tailed 0.0292, and the test requires
       agreement within 0.01.
    - **Also tested:** the shaded tail bins hold exactly the extreme count at every step, and ties
      at the observed value count as extreme (with exact whole-number comparison).
- [x] **4. Both themes and presentation mode look right (screenshots in the report).** See §4 and
  the screenshots below. Every generator's module was stepped in the browser, and presentation mode
  was checked for bars, growth and hypothesis.

## 4. How to run & verify

```sh
npm ci
npm run typecheck && npm run lint && npm test && npm run build
node scripts/check-bundle.mjs --baseline 774621 --budget 25000
# → main chunk index-*.js: 798437 B; delta +23816 B; ✓
npm run dev
```

1. Pick **Engine fixtures** in the course picker.
2. Open **Search and sort views → Bubble sort** and press →. The compared pair turns amber, a swap
   turns green, and the sorted region grows teal from the right. The counters and the explanation
   agree ("Compared 15 and 9. 15 is bigger, so they swap. Swaps so far: 1.").
3. Open **Binary search** and **Binary search: not found** to see `low` / `mid` / `high` under the
   bars and the range box. Open **Merge sort** to see the split rows and the merge.
4. Open **Big O views → Big O growth**. The markers move as n doubles, and from n = 32 O(n²) leaves
   the chart, shown as an arrow with its count.
5. Open **Statistics views → Sampling distribution** and step to the end to see the bell and the
   dashed normal curve. Open **Hypothesis test: one-tailed / two-tailed** to see the shaded tails
   and the p-value.
6. Press `f` for presentation mode, and use the sun / moon button to switch themes.

**Browser check performed** (Playwright against the dev server, 1440 × 900):
- I stepped all 11 modules in light and dark. The screenshots below are the ones I looked at.
- I fixed five visual problems I found:
  - merge sort didn't mark the other head as compared;
  - insertion sort's sorted part didn't follow the key;
  - growth curves above the chart were drawn flat along the top edge, and the table took the chart's
    width;
  - the first growth curves were too dim in the dark theme;
  - compared and swapped bars had the same lightness (§5, item 5).
- **Presentation mode:** insertion sort (dark), Big O (dark) and the two-tailed test (light).
- **Reduced motion:** a bar `<g>` has `transition-duration: 0.32s`, which becomes `1e-05s` with
  `prefers-reduced-motion: reduce` emulated (the global rule in `index.css`).
- **Regression:**
  - SE 200 `factorial(n)` (C) and the Python harvest module still render and step as before.
  - Console after a fresh load and stepping: no errors and no warnings apart from the existing
    `favicon.ico` 404.
  - The `target.closest` errors seen during the session came from my own test harness dispatching
    key events on `document` and `window`, which are not elements. They are not app errors; once I
    dispatched on `body` there were none.
- I stopped the server and closed the browser. `.playwright-mcp/` is git-ignored and not committed.

## 5. Key decisions & deviations

1. **Bundle budget, measured honestly.**
   - My first build showed +18.8 KB. Investigating that number, I found that Rolldown had split
     `react` (7.5 KB) and `jsx-runtime` out of `index-*.js` into separate chunks that the main
     chunk imports statically. That made the metric look 7.9 KB smaller than the real cost.
   - I traced the split, with a sourcemap attribution script, to `GrowthView` importing
     `InlineMarkdown` from `Markdown.tsx`. I removed that import; the caption is plain text anyway.
   - The real cost was then +26.3 KB, which is over budget. I brought it down:
     - **DEVIATION:** `bars` "What changed" became a panel note ("The highlighted bars, the pointers
       and the counters show what this step changed.") instead of generated rows. This follows the
       Phase 28 precedent for `pipeline`. The "What this step did" text already states every change
       ("they swap. Swaps so far: 4."). Growth and distribution still author their "What changed".
     - A shared `conceptModule()` helper replaced per-file boilerplate.
     - A pointer helper.
   - **Final: +23,816 B, with no react split** (checked: no `react-*.js` or `jsx-runtime-*.js` in
     `dist/assets`).
   - **Breakdown (sourcemap attribution):**
     - generators: about 19 KB, mostly explanation text;
     - fixture modules and catalog keys: about 4 KB;
     - `Stage`: +0.5 KB.
     - The three views are lazy chunks: `BarsView` 4.6 KB, `GrowthView` 4.4 KB and
       `DistributionView` 7.6 KB.
     - Validation lives in the lazy `LiveCodingView` chunk; it is not in main.
   - **Headroom is about 1.2 KB.** The DS 210 content phase should expect the main chunk at about
     798.4 KB.
   - **Why not lazy traces:** the catalog needs each `trace` synchronously, so the generator code is
     in main. Generating lazily would need a loader in the player and the catalog, which is out of
     scope.
2. **Trace metadata.**
   - `course: 'DS 210'` comes from the roadmap; DS 210 is not in `docs/CURRICULUM.md`. That is the
     same situation as the existing `DS 200` harvest module.
   - `language: 'python'` (the course language; there is no source code).
   - **No `file` breadcrumb.** I didn't invent file names.
   - The sidebar groups the modules under Engine fixtures, as the prompt says.
3. **Counting conventions,** stated in the generator docs and the concept text:
   - a search probe counts as one comparison;
   - insertion sort moves the key by adjacent swaps, so its swaps are comparable with bubble sort's
     (both equal the number of inversions; tested);
   - merge sort has no swaps, so it counts **writes**: one per value placed in a merge. The prompt
     says "comparison and swap counters"; for merge sort, writes are the honest equivalent.
4. **Mid-merge layout.** While a merge runs, the segment shows *merged-so-far | rest of left | rest
   of right*. The array is always a permutation with stable keys, so bars slide and no value is
   ever duplicated on screen. `i` and `j` mark the two heads.
5. **Colours.** States that must be told apart also differ in lightness.
   - The `--se-cv-*` colours are mixed toward `--se-bg` to dim and toward `--se-text` to
     strengthen, which works in both themes.
   - The bar states form four tiers: idle < sorted < compared < swapped. Only "compared" needs a
     per-theme mix (an override for the dark theme) to land between its neighbours.
   - I first had compared and swapped at the same lightness (dark L* 80 / 79). Merge sort shows
     both in one step, so I separated them.
   - Measured L* in the browser after the change:

   | Pair | Dark | Light |
   |------|------|-------|
   | idle / sorted / compared / swapped | 18 / 42 / 60 / 82 | 85 / 71 / 53 / 38 |
   | growth ramp O(1) → O(n²) | 38 / 49 / 62 / 70 / 79 | 68 / 58 / 46 / 37 / 26 |
   | histogram bars / shaded tail | 38 / 80 | 68 / 47 |

   - The growth curves also differ by dash pattern and carry direct labels.
   - The "latest draw" markers use the compared colour. They are triangles above the bars, not bar
     fills.
   - Found (in a search) uses the swapped colour, and the legend says "found".

6. **Hypothesis test design.**
   - Plant growth, 10 + 10 plants, stored in tenths of a centimetre.
   - Group sizes are equal, so a difference in means is an exact whole number of units and its
     2-decimal display is exact. Observed difference 1.30 cm; means 13.50 and 12.20.
   - The bins are closed on their outer side, with ±observed on bin edges, so the shaded bins hold
     exactly the extreme shuffles.
   - The one- and two-tailed modules share the data, the seed and the shuffles, so only the tail
     differs.
7. **Bins:** a value within float rounding of a bin edge goes into the bin it starts, as `[from, to)`
   says (`binIndex` has a 1e-9 epsilon). I found this with a test: a mean of exactly 3.75 had been
   computed as 3.7499….
8. **Golden renderer.** `renderGolden` now prints a **State** line for generated concept views, and
   skips the empty source block and line header when `source === ''`. **No existing golden changed**
   (`git diff ds-python` shows only the 11 new `concept-*.md` files).
9. **Concept-view single beat.** The new views are not in `viewSupportsBeats`, like `pipeline`, so
   there is no arrive / apply split. Tested.

**Existing snapshots, goldens or tests changed:** none. The catalog-wide tests (`catalog.test.ts`,
`stage.render.test.tsx` and the explain "every catalog module" test) now include the 11 new modules
and pass unchanged. The only edit to an existing test file is the additive golden cases and state
line in `golden.test.ts`.

## 6. Trace format / API notes

Exact shapes are in `docs/TRACE_FORMAT.md` § Phase 37 additions. In short:

```ts
TraceView += 'bars' | 'growth' | 'distribution';
Step.bars?: { values; keys?; compared?; swapped?; sorted?; range?; pointers?; found?; target?;
              segments?; counters: { comparisons; swaps?; writes? } };
Step.growth?: { ns; curves: { id; label; counts }[]; n; yMax; compare?; caption? };
Step.distribution?: { mode: 'sampling' | 'hypothesis'; xLabel; bins; draws; latest?; stats?;
              population?; sampleSize?; normal?; groups?;
              test?: { observed; tail; center; extreme; pValue; alpha } };
// generators (src/engine/concept): linearSearchSteps, binarySearchSteps, bubbleSortSteps,
// selectionSortSteps, insertionSortSteps, mergeSortSteps, growthSteps, samplingSteps / samplingRun,
// testSteps / testRun / isExtreme; conceptModule(meta, steps) for registration.
```

## 7. Known issues / follow-ups

- **Bundle headroom is only about 1.2 KB.** More generated modules will mostly add metadata (about
  0.4 KB each). More generator text will need a lazy-trace mechanism, or trimming.
- **Binary search's compare step shows the old range,** with the decision ("`low` becomes 5") in the
  text. The new range appears on the next step. This is deliberate, so the probe is visible inside
  the range it was chosen from.
- **Histogram y axes rescale every step** so the shape reads early on. As a result, bar heights are
  not comparable across steps; the counts and the chips are.
- **`DistributionView` dot strips:** a mean label can overlap a nearby dot. The scale caption is
  "10 – 16 cm" rather than a full axis.
- **Explanation-panel chips** show "no line" for concept views; this is existing behaviour, the same
  as `pipeline`.
- **Sentences I am least sure read well** (both are true for their state):
  - Big O "O(n log n) goes from 8 to 24": the factor is not a round multiple, so no "times" is
    claimed;
  - "That is not at least as extreme as the observed 1.30 cm" is a little clumsy.

## 8. File map

```
src/engine/trace/types.ts            (changed — Phase 37 views and payload types)
src/engine/trace/validate.ts         (changed — validateConceptStep, validateBarsCounters)
src/engine/trace/explain.ts          (changed — 'bars' view note)
src/engine/trace/validateConcept.test.ts            (new)
src/engine/concept/{random,stats,trace,bars,growth,distribution}.ts        (new)
src/engine/concept/{bars,growth,distribution}.test.ts                      (new)
src/engine/explain/golden.test.ts    (changed — concept cases + state line)
src/engine/explain/golden/concept-*.md              (new, 11)
src/components/Stage.tsx             (changed — lazy BarsView / GrowthView / DistributionView)
src/components/concept/{BarsView,GrowthView,DistributionView}.tsx          (new)
src/components/concept/conceptViews.test.tsx + __snapshots__/              (new)
src/content/fixtures/concept*.ts     (new, 11 modules)
src/index.css                        (changed — --se-cv-* colours, .se-cv-move)
docs/TRACE_FORMAT.md, docs/CONTENT_AUTHORING.md     (changed)
reports/phase-37-concept-views.md, reports/assets/phase37-*.png
```

### Screenshots

Search and sort:

![Bubble sort, light](assets/phase37-bubble-light.png)
![Bubble sort, dark](assets/phase37-bubble-dark.png)
![Selection sort, dark](assets/phase37-selection-dark.png)
![Insertion sort, dark](assets/phase37-insertion-dark.png)
![Merge sort, light](assets/phase37-merge-light.png)
![Merge sort, dark](assets/phase37-merge-dark.png)
![Linear search, light](assets/phase37-linear-light.png)
![Binary search, light](assets/phase37-binary-light.png)
![Binary search not found, light](assets/phase37-binary-absent-light.png)

Big O:

![Growth, light](assets/phase37-growth-light.png)
![Growth, dark](assets/phase37-growth-dark.png)

Statistics:

![Sampling, 3 means, light](assets/phase37-sampling-early-light.png)
![Sampling, 50 means, dark](assets/phase37-sampling-mid-dark.png)
![Sampling, 1,000 means, light](assets/phase37-sampling-end-light.png)
![One-tailed test, dark](assets/phase37-hypothesis-one-dark.png)
![Two-tailed test, light](assets/phase37-hypothesis-two-light.png)

Presentation mode:

![Presentation, insertion, dark](assets/phase37-present-insertion-dark.png)
![Presentation, growth, dark](assets/phase37-present-growth-dark.png)
![Presentation, two-tailed, light](assets/phase37-present-hypothesis-light.png)

Regression (existing modules):

![C factorial, light](assets/phase37-regression-c-factorial-light.png)
![Python harvest, light](assets/phase37-regression-python-harvest-light.png)
