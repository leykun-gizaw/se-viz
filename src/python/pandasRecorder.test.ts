/**
 * The recorder's pandas output (Phase 35), on the committed recordings of the pandas samples (real
 * pandas 3.0.2, recorded by `npm run py:record-packages`) and on the offline stand-in program
 * (`extra-pandas-standin`, re-recorded by `recorder.test.ts` on every run): shapes, column dtypes,
 * index labels, the row / column / cell caps, missing counts, and the GroupBy summary.
 */
import { describe, expect, it } from 'vitest';
import farmCsv from './data/farm.csv?raw';
import recorderSource from './recorder.py?raw';
import {
  GROUP_ROWS,
  GROUPS_CAP,
  TABLE_COLS,
  TABLE_REPR_CAP,
  TABLE_ROWS,
  type PyDataFrame,
  type PyGroupBy,
  type PyObject,
  type PySeries,
  type PySnapshot,
  type PyValue,
  type RunResult,
} from './protocol.ts';
import { PANDAS_SAMPLES } from './samples/pandas/index.ts';

const RAW = import.meta.glob<string>('./fixtures/**/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function recording(name: string): RunResult {
  const text = RAW[`./fixtures/${name}.json`];
  if (text === undefined) throw new Error(`missing recording ${name}`);
  return JSON.parse(text) as RunResult;
}

const last = (r: RunResult): PySnapshot => r.steps[r.steps.length - 1];

function global(r: RunResult, name: string, snap = last(r)): PyValue {
  const v = snap.frames[0].vars.find((x) => x.name === name);
  if (!v) throw new Error(`no global ${name}`);
  return v.value;
}

function objectOf<K extends PyObject['kind']>(
  r: RunResult,
  name: string,
  kind: K,
  snap = last(r),
): Extract<PyObject, { kind: K }> & { id: string } {
  const v = global(r, name, snap);
  if (v.kind !== 'ref') throw new Error(`${name} is not a reference`);
  const o = snap.objects[v.id];
  if (o?.kind !== kind) throw new Error(`${name} is ${o?.kind ?? 'missing'}, not ${kind}`);
  return { ...(o as Extract<PyObject, { kind: K }>), id: v.id };
}

const texts = (cells: { repr: string }[]) => cells.map((c) => c.repr);
const frame = (r: RunResult, n: string) => objectOf(r, n, 'dataframe') as PyDataFrame;
const series = (r: RunResult, n: string) => objectOf(r, n, 'series') as PySeries;

describe('pandas recordings (Phase 35)', () => {
  it('the caps in recorder.py are the ones the TypeScript side documents', () => {
    for (const [name, value] of Object.entries({
      TABLE_ROWS,
      TABLE_COLS,
      TABLE_REPR_CAP,
      GROUPS_CAP,
      GROUP_ROWS,
    })) {
      expect(recorderSource).toContain(`${name} = ${value}`);
    }
  });

  it('the bundled farm.csv is small and synthetic: 30 plots, 6 columns, a few gaps', () => {
    const lines = farmCsv.trim().split('\n');
    expect(lines[0]).toBe('plot_id,region,crop,rainfall_mm,yield_kg,fertilized');
    expect(lines.length - 1).toBe(30);
    expect(lines.length).toBeLessThan(50);
    expect(lines.filter((l) => l.includes(',,')).length).toBe(5);
  });

  it.each(PANDAS_SAMPLES.map((s) => s.name))(
    '%s: ran cleanly; every table keeps the caps',
    (name) => {
      const r = recording(`pandas/${name}`);
      expect(r.error).toBeUndefined();
      expect(r.truncated).toBeUndefined();
      for (const snap of r.steps) {
        for (const o of Object.values(snap.objects)) {
          if (o.kind === 'dataframe') {
            const [rows, cols] = o.shape;
            expect(o.index).toHaveLength(Math.min(rows, TABLE_ROWS));
            expect(o.rows).toHaveLength(Math.min(rows, TABLE_ROWS));
            expect(o.columns).toHaveLength(Math.min(cols, TABLE_COLS));
            expect(o.rowsOmitted ?? 0).toBe(Math.max(0, rows - TABLE_ROWS));
            expect(o.columnsOmitted ?? 0).toBe(Math.max(0, cols - TABLE_COLS));
            for (const row of o.rows) {
              expect(row).toHaveLength(o.columns.length);
              for (const c of row) expect(c.repr.length).toBeLessThanOrEqual(TABLE_REPR_CAP);
            }
          } else if (o.kind === 'series') {
            expect(o.values).toHaveLength(Math.min(o.length, TABLE_ROWS));
            expect(o.index).toHaveLength(o.values.length);
            expect(o.omitted ?? 0).toBe(Math.max(0, o.length - TABLE_ROWS));
          } else if (o.kind === 'groupby') {
            expect(o.groups).toHaveLength(Math.min(o.ngroups, GROUPS_CAP));
            for (const g of o.groups) {
              expect(g.rows).toHaveLength(Math.min(g.size, GROUP_ROWS));
              expect(g.index).toHaveLength(g.rows.length);
            }
          }
        }
      }
    },
  );

  it('read: read_csv gives the true shape, column dtypes, index labels and missing counts', () => {
    const r = recording('pandas/read');
    const farm = frame(r, 'farm');
    expect(farm.shape).toEqual([30, 6]);
    expect(farm.columns.map((c) => [c.label.repr, c.dtype, c.missing])).toEqual([
      ["'plot_id'", 'str', 0],
      ["'region'", 'str', 0],
      ["'crop'", 'str', 0],
      ["'rainfall_mm'", 'float64', 2],
      ["'yield_kg'", 'float64', 3],
      ["'fertilized'", 'bool', 0],
    ]);
    expect(farm.rowsOmitted).toBe(10);
    expect(texts(farm.index)).toEqual(Array.from({ length: 20 }, (_, i) => String(i)));
    expect(texts(farm.rows[0])).toEqual([
      "'P01'",
      "'Highland'",
      "'maize'",
      '820.0',
      '1450.0',
      'True',
    ]);
    // A missing value reads `nan` (P06 has no yield).
    expect(farm.rows[5][4]).toEqual({ repr: 'nan', type: 'float' });
    expect(frame(r, 'first').shape).toEqual([5, 6]);
    expect(r.stdout).toContain('RangeIndex: 30 entries, 0 to 29');
  });

  it('select: a column is a Series named after it; a row by loc keeps its labels', () => {
    const r = recording('pandas/select');
    const crops = series(r, 'crops');
    expect(crops).toMatchObject({
      length: 30,
      dtype: 'str',
      name: { repr: "'crop'" },
      omitted: 10,
    });
    const third = series(r, 'third');
    expect(third.name).toEqual({ repr: '2', type: 'int' });
    expect(texts(third.index)).toEqual([
      "'plot_id'",
      "'region'",
      "'crop'",
      "'rainfall_mm'",
      "'yield_kg'",
      "'fertilized'",
    ]);
    const block = frame(r, 'block');
    expect(block.shape).toEqual([4, 2]); // loc slices include their end label
    expect(texts(block.index)).toEqual(['0', '1', '2', '3']);
    expect(frame(r, 'corner').shape).toEqual([2, 3]); // iloc slices don't
    expect(global(r, 'value')).toEqual({
      kind: 'prim',
      type: 'float',
      repr: '2300.0',
      dtype: 'float64',
    });
  });

  it('filter: the kept rows keep their index labels', () => {
    const r = recording('pandas/filter');
    const rainy = frame(r, 'rainy');
    expect(rainy.shape).toEqual([10, 6]);
    expect(texts(rainy.index)).toEqual(['2', '4', '7', '10', '11', '15', '18', '23', '26', '27']);
    expect(series(r, 'wet')).toMatchObject({ length: 30, dtype: 'bool' });
  });

  it('groupby: the keys, every group label and size, and each group’s first rows', () => {
    const r = recording('pandas/groupby');
    const g = objectOf(r, 'by_region', 'groupby') as PyGroupBy;
    expect(g).toMatchObject({
      type: 'DataFrameGroupBy',
      keys: ['region'],
      ngroups: 4,
      rowsTotal: 30,
    });
    expect(g.source).toEqual(global(r, 'farm'));
    expect(g.groups.map((x) => [x.label.repr, x.size])).toEqual([
      ["'Coast'", 7],
      ["'Highland'", 8],
      ["'Lakeside'", 7],
      ["'Valley'", 8],
    ]);
    expect(texts(g.groups[0].index)).toEqual(['4', '7', '11']);
    expect(g.groups[0].rows[0][1]).toEqual({ repr: "'Coast'", type: 'str' });
    const totals = series(r, 'totals');
    expect(totals).toMatchObject({
      length: 4,
      indexName: "'region'",
      name: { repr: "'yield_kg'" },
    });
  });

  it('capped: 1,200 rows keep 20; 15 columns keep 12; long text is cut to 40 characters', () => {
    const r = recording('pandas/capped');
    expect(frame(r, 'days')).toMatchObject({ shape: [1200, 2], rowsOmitted: 1180 });
    expect(frame(r, 'wide')).toMatchObject({ shape: [3, 15], columnsOmitted: 3 });
    const note = series(r, 'notes').values[0];
    expect(note.truncated).toBe(true);
    expect(note.repr).toHaveLength(TABLE_REPR_CAP);
    expect(note.repr.endsWith('…')).toBe(true);
  });
});

describe('offline stand-in (recorded by recorder.test.ts)', () => {
  it('caps rows, columns, cell text and groups, and counts missing values', () => {
    const r = recording('extra-pandas-standin');
    expect(r.error).toBeUndefined();
    const wide = frame(r, 'wide');
    expect(wide).toMatchObject({ shape: [22, 13], rowsOmitted: 2, columnsOmitted: 1 });
    expect(wide.columns).toHaveLength(12);
    expect(wide.columns[0]).toEqual({
      label: { repr: "'note'", type: 'str' },
      dtype: 'object',
      missing: 21,
    });
    expect(wide.rows[0][0]).toMatchObject({ type: 'str', truncated: true });
    expect(wide.rows[0][0].repr).toHaveLength(TABLE_REPR_CAP);
    expect(wide.rows[1][0]).toEqual({ repr: 'None', type: 'NoneType' });
    expect(texts(wide.index.slice(0, 3))).toEqual(['100', '101', '102']);
    const rain = series(r, 'rain');
    expect(rain).toMatchObject({ length: 22, missing: 1, omitted: 2, indexName: "'plot'" });
    expect(rain.values[1]).toEqual({ repr: 'nan', type: 'float' });
    const groups = objectOf(r, 'groups', 'groupby') as PyGroupBy;
    expect(groups).toMatchObject({ ngroups: 21, groupsOmitted: 1, keys: ['k'], rowsTotal: 22 });
    expect(groups.groups).toHaveLength(GROUPS_CAP);
    expect(groups.groups[0]).toMatchObject({ label: { repr: '0' }, size: 2 });
    expect(texts(groups.groups[0].index)).toEqual(['100', '101']);
  });

  it('the bundled sample file is in the working directory', () => {
    const r = recording('extra-sample-data');
    expect(global(r, 'header')).toMatchObject({
      repr: "'plot_id,region,crop,rainfall_mm,yield_kg,fertilized'",
    });
    expect(global(r, 'rows')).toMatchObject({ repr: '30' });
  });
});
