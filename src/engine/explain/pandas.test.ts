/**
 * Derived explanations for pandas (Phase 35), on the recorded samples: a boolean filter states its
 * condition and exactly which rows it kept and how many; a groupby reads as split, apply, combine
 * with the true group sizes; merge and dropna give row counts before and after; and every line that
 * makes a pandas object gets a pandas sentence (never the generic assignment text). The full text of
 * every step is in the `golden/pandas-*.md` files.
 */
import { describe, expect, it } from 'vitest';
import { PANDAS_SAMPLES } from '../../python/samples/pandas/index.ts';
import { derivePython, summarize } from './python.ts';
import { sampleTrace, stepAt } from './testTraces.ts';

const pandas = (name: string) => sampleTrace(`pandas/${name}`);
const did = (name: string, line: number, n = 1) => {
  const t = pandas(name);
  return derivePython(t, stepAt(t, line, n), 'apply').did;
};

describe('pandas explanations', () => {
  it('a boolean filter states the condition, the kept count and the kept rows', () => {
    expect(did('filter', 5)[0]).toBe(
      'Kept the rows of `farm` where `wet` is `True`: 10 of 30 rows, labelled ' +
        '`2, 4, 7, 10, 11, 15, 18, 23, 26, 27`.',
    );
    expect(did('filter', 6)[0]).toBe(
      'Kept the rows of `farm` where `(farm["rainfall_mm"] < 600) & (farm["crop"] == "maize")` ' +
        'is `True`: 2 of 30 rows, labelled `5, 16`.',
    );
    expect(did('series', 5)[0]).toBe(
      'Kept the values of `rain` where `rain > 800` is `True`: 3 of 4 values, labelled ' +
        '`Highland, Lakeside, Coast`.',
    );
  });

  it('a groupby aggregation reads as split, apply, combine, with the group sizes', () => {
    expect(did('groupby', 4)[0]).toBe(
      'Split the 30 rows of `farm` into 4 groups by `region`: `Coast` (7 rows), `Highland` (8), ' +
        '`Lakeside` (7) and `Valley` (8).',
    );
    const totals = did('groupby', 5);
    expect(totals).toEqual([
      'Split: the 30 rows of `farm` go into 4 groups by `region`: `Coast` (7 rows), ' +
        '`Highland` (8), `Lakeside` (7) and `Valley` (8).',
      'Apply: the sum of `yield_kg` within each group.',
      'Combine: the 4 results become `totals`, a new Series with one value per group, indexed by ' +
        '`region`: `Coast` `10390.0`, `Highland` `9560.0`, `Lakeside` `7380.0` and `Valley` `6790.0`.',
    ]);
    // A chained groupby: no GroupBy object was recorded, so no sizes are claimed.
    expect(did('groupby', 6)[0]).toBe(
      'Split: the 30 rows of `farm` go into 4 groups by `crop`, one per different value.',
    );
    // `size()`: the counts are the group sizes, read from the result.
    expect(did('groupby', 7)[2]).toContain(
      '`beans` `7`, `cassava` `6`, `maize` `9` and `sorghum` `8`',
    );
  });

  it('merge: the keys, how, and the row counts before and after', () => {
    expect(did('merge', 5).slice(0, 3)).toEqual([
      'Merged `farm` (30 rows) with `prices` (3 rows) on the key column `crop`, how=`left`: ' +
        '`priced` is a new DataFrame, 30 rows × 7 columns.',
      'A left merge keeps every row of `farm`: 30 rows before, 30 after.',
      'Rows with no match in `prices` got missing values in its columns: `price_per_kg` 6.',
    ]);
    expect(did('merge', 6)[1]).toBe(
      'An inner merge keeps only the rows whose `crop` appears in both: 30 rows before, 24 after.',
    );
  });

  it('missing values: counted per column, filled, and dropped, with counts', () => {
    expect(did('missing', 4)[0]).toBe(
      'Counted the missing values in each column of `farm`: `rainfall_mm` 2 and `yield_kg` 3; ' +
        'the other 4 columns have none.',
    );
    expect(did('missing', 5)[0]).toContain('Filled 3 missing values of `farm` (`yield_kg` 3)');
    expect(did('missing', 6)[0]).toBe(
      'Dropped the rows of `farm` with a missing value: 5 of 30 rows dropped, 25 kept in ' +
        '`complete`, a new DataFrame.',
    );
    expect(did('missing', 7)[0]).toBe(
      'Dropped, in place, the rows of `farm` with a missing value in `rainfall_mm`: 2 of 30 rows ' +
        'removed, 28 left.',
    );
  });

  it('new and changed columns, and a sort', () => {
    expect(did('columns', 4)[0]).toBe(
      'Added the column `yield_per_mm` to `plots`: one value per row, from ' +
        '`plots["yield_kg"] / plots["rainfall_mm"]` (dtype `float64`).',
    );
    expect(did('columns', 5)[0]).toBe(
      'Replaced the column `yield_kg` of `plots` with `plots["yield_kg"] * 2`: 5 of the 6 rows ' +
        'changed value.',
    );
    expect(did('sort', 4)[1]).toBe(
      'Each row keeps its index label, so the labels now read `4, 2, 0, 7, 3, 6, 1, 5`.',
    );
  });

  it.each(PANDAS_SAMPLES.map((s) => s.name))(
    '%s: every line that makes or changes a pandas object gets a pandas sentence',
    (name) => {
      const t = pandas(name);
      t.steps.forEach((step, k) => {
        const stmt = t.statements?.[String(step.highlightedLines[0])];
        if (step.py?.event !== 'line' || stmt?.kind !== 'Assign' || k === 0) return;
        const prev = t.steps[k - 1];
        if (prev.highlightedLines[0] === step.highlightedLines[0]) return; // a line still running
        const generic = derivePython(t, k, 'apply').did.some((s) =>
          /now refers to it|^Assigned/.test(s),
        );
        // Only the chained `.add_prefix` in `capped` falls back to the shape-and-source sentence.
        if (name === 'capped' && step.highlightedLines[0] === 5) expect(generic).toBe(true);
        else expect(generic, `${name} line ${step.highlightedLines[0]}`).toBe(false);
        expect(summarize(t, k)).not.toBeNull();
      });
    },
  );
});
