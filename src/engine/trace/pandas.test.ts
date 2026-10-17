/**
 * pandas tables in the trace (Phase 35): the mapping's cell ids and facts, how a new table relates
 * to its source (filter, sort, columns, values), where each new table came from, the object-level
 * diff events for a column added, rows dropped (by a filter and in place), a sort and a cell change
 * — on the committed pandas traces — and the canvas's motion cues for them.
 */
import { describe, expect, it } from 'vitest';
import { advanceMotion, initialMotion, motionCues } from '../../components/python/pyMotion.ts';
import { diffObjects, invertEvents } from './objectDiff.ts';
import {
  cellAt,
  columnId,
  derivedTables,
  displayText,
  isMissing,
  isTable,
  rootName,
  rowId,
  shapeWords,
  tableRelation,
  type TableBlock,
} from './pandas.ts';
import type { Step, Trace } from './types.ts';
import { validateTrace } from './validate.ts';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/pandas/*.json', {
  eager: true,
  import: 'default',
});
const trace = (name: string) => {
  const t = TRACES[`../../content/fixtures/python/pandas/${name}.json`];
  if (!t) throw new Error(`missing ${name}`);
  return t;
};

/** The step (index) whose highlighted line is `line`. */
const stepAt = (t: Trace, line: number) => t.steps.findIndex((s) => s.highlightedLines[0] === line);

function named(step: Step, name: string): TableBlock {
  const cell = step.stack[0].variables.find((v) => v.name === name);
  const block = step.heap.find((b) => cell?.kind === 'pointer' && b.id === cell.target);
  if (!isTable(block)) throw new Error(`${name} is not a table`);
  return block;
}

/** The cues the canvas plays moving from step `k - 1` to step `k`. */
function cuesAt(t: Trace, k: number, reduce = false) {
  const motion = advanceMotion(initialMotion(t.steps[k - 1]), t.steps[k]);
  return motionCues(motion, reduce, derivedTables(t));
}

describe('pandas tables in the trace', () => {
  it('every pandas trace validates; cells are keyed by index label and column label', () => {
    for (const t of Object.values(TRACES)) expect(validateTrace(t)).toEqual([]);
    const read = trace('read');
    const farm = named(read.steps[read.steps.length - 1], 'farm');
    expect(shapeWords(farm)).toBe('30 rows × 6 columns');
    expect(farm.table.rowKeys.slice(0, 3)).toEqual(['0', '1', '2']);
    expect(farm.table.columns.map((c) => c.name)).toEqual([
      'plot_id',
      'region',
      'crop',
      'rainfall_mm',
      'yield_kg',
      'fertilized',
    ]);
    expect(cellAt(farm, '5', "'yield_kg'")).toMatchObject({
      id: `${farm.id}.loc[5, 'yield_kg']`,
      name: "5, 'yield_kg'",
      value: 'nan',
    });
    expect(isMissing(cellAt(farm, '5', "'yield_kg'"))).toBe(true);
    expect(isMissing(cellAt(farm, '0', "'crop'"))).toBe(false);
    expect(displayText("'Coast'")).toBe('Coast');
    expect(displayText('nan')).toBe('NaN');
  });

  it('filter: the kept rows, the dropped ones among those shown, and the true counts', () => {
    const t = trace('filter');
    const end = t.steps[t.steps.length - 1];
    const r = tableRelation(named(end, 'farm'), named(end, 'coast'));
    expect(r).toMatchObject({
      kind: 'filter',
      kept: ['4', '7', '11', '15', '19', '23', '27'],
      keptCount: 7,
      of: 30,
    });
    // Within the 20 rows of `farm` that are shown, everything not kept up to the last kept one.
    expect(r.kind === 'filter' && r.dropped).toEqual([
      '0',
      '1',
      '2',
      '3',
      '5',
      '6',
      '8',
      '9',
      '10',
      '12',
      '13',
      '14',
      '16',
      '17',
      '18',
    ]);
  });

  it('derivedTables: each new table, Series and GroupBy knows the pandas object it came from', () => {
    const f = trace('filter');
    const end = f.steps[f.steps.length - 1];
    const farm = named(end, 'farm').id;
    const d = derivedTables(f);
    for (const n of ['wet', 'rainy', 'dry_maize', 'coast']) {
      expect(d.get(named(end, n).id)?.source).toBe(farm);
    }
    const g = trace('groupby');
    const gend = g.steps[g.steps.length - 1];
    const gd = derivedTables(g);
    const byRegion = gend.stack[0].variables.find((v) => v.name === 'by_region');
    expect(byRegion?.kind === 'pointer' && gd.get(byRegion.target!)?.source).toBe(
      named(gend, 'farm').id,
    );
    // `by_region["yield_kg"].sum()` comes from the GroupBy; a chained groupby from `farm`.
    expect(gd.get(named(gend, 'totals').id)?.source).toBe(
      byRegion?.kind === 'pointer' ? byRegion.target : '',
    );
    expect(gd.get(named(gend, 'crop_stats').id)?.source).toBe(named(gend, 'farm').id);
    // `pd.merge(farm, prices, …)` comes from its first argument; `read_csv` from nothing.
    const m = trace('merge');
    const mend = m.steps[m.steps.length - 1];
    expect(derivedTables(m).get(named(mend, 'priced').id)?.source).toBe(named(mend, 'farm').id);
    expect(derivedTables(m).has(named(mend, 'farm').id)).toBe(false);
    const stmt = m.statements?.['5'];
    expect(stmt?.kind === 'Assign' && rootName(mend, stmt.value)).toBe('farm');
  });

  it('sort and columns: a sorted copy is a sort; assign adds a column; a column is selected', () => {
    const s = trace('sort');
    const send = s.steps[s.steps.length - 1];
    expect(derivedTables(s).get(named(send, 'ranked').id)?.relation).toMatchObject({
      kind: 'sort',
      to: ['4', '2', '0', '7', '3', '6', '1', '5'],
    });
    const c = trace('columns');
    const cend = c.steps[c.steps.length - 1];
    expect(derivedTables(c).get(named(cend, 'tons').id)?.relation).toEqual({
      kind: 'columns-added',
      added: ["'yield_t'"],
    });
    const sel = trace('select');
    const selEnd = sel.steps[sel.steps.length - 1];
    expect(derivedTables(sel).get(named(selEnd, 'crops').id)?.relation).toEqual({
      kind: 'columns-selected',
      columns: ["'crop'"],
    });
  });

  it('fillna: the same rows and columns, the filled values paired with the missing ones', () => {
    const t = trace('missing');
    const k = stepAt(t, 5);
    const filled = named(t.steps[k], 'filled');
    const r = derivedTables(t).get(filled.id)?.relation;
    expect(r?.kind).toBe('values');
    // P06 and P15 are among the 20 rows shown (P23, row 22, is not).
    expect(r?.kind === 'values' && r.changed.map(([m]) => m)).toEqual([
      `${filled.id}.loc[5, 'yield_kg']`,
      `${filled.id}.loc[14, 'yield_kg']`,
    ]);
  });
});

describe('pandas diff events', () => {
  it('a column added in place is one event; its values are not listed separately', () => {
    const t = trace('columns');
    const k = stepAt(t, 4);
    const events = diffObjects(t.steps[k - 1], t.steps[k]);
    const plots = named(t.steps[k], 'plots');
    expect(events).toEqual([
      { kind: 'column-added', objectId: plots.id, key: "'yield_per_mm'", index: 6 },
    ]);
    expect(invertEvents(events)).toEqual(diffObjects(t.steps[k], t.steps[k - 1]));
  });

  it('a cell change is a value change of that cell; a replaced column changes each value', () => {
    const t = trace('columns');
    const k = stepAt(t, 6);
    const plots = named(t.steps[k], 'plots');
    expect(diffObjects(t.steps[k - 1], t.steps[k])).toEqual([
      expect.objectContaining({
        kind: 'value-changed',
        cellId: `${plots.id}.loc[1, 'crop']`,
        from: expect.objectContaining({ value: "'beans'" }),
        to: expect.objectContaining({ value: "'millet'" }),
      }),
    ]);
    const j = stepAt(t, 5);
    const changed = diffObjects(t.steps[j - 1], t.steps[j]);
    expect(changed.map((e) => e.kind)).toEqual(Array(5).fill('value-changed'));
  });

  it('a filter makes a new table (the source is unchanged); its entrance shows the dropped rows', () => {
    const t = trace('filter');
    const k = stepAt(t, 5);
    const rainy = named(t.steps[k], 'rainy');
    expect(diffObjects(t.steps[k - 1], t.steps[k])).toEqual([
      { kind: 'name-bound', frameId: 'f1', cellId: 'f1.rainy' },
      { kind: 'object-created', objectId: rainy.id },
    ]);
    const cues = cuesAt(t, k);
    const entrance = cues.tables.get(rainy.id);
    expect(entrance?.kind).toBe('filter');
    if (entrance?.kind !== 'filter') return;
    // The 20 rows of `farm` shown, 7 of them kept, then the 3 kept rows past them (23, 26, 27).
    expect(entrance.rows).toHaveLength(23);
    expect(entrance.rows.filter((r) => !r.kept).map((r) => r.key)).toEqual([
      '0',
      '1',
      '3',
      '5',
      '6',
      '8',
      '9',
      '12',
      '13',
      '14',
      '16',
      '17',
      '19',
    ]);
    expect(entrance.rows.slice(-3).map((r) => r.key)).toEqual(['23', '26', '27']);
    // Stepping back plays no entrance; reduced motion still derives it, but nothing animates.
    const back = motionCues(
      advanceMotion(initialMotion(t.steps[k]), t.steps[k - 1]),
      false,
      derivedTables(t),
    );
    expect(back.tables.size).toBe(0);
    expect(cuesAt(t, k, true).animate).toBe(false);
  });

  it('rows dropped in place: only the rows really removed, not the ones sliding into view', () => {
    const t = trace('missing');
    const k = stepAt(t, 7); // farm.dropna(subset=["rainfall_mm"], inplace=True)
    const farm = named(t.steps[k], 'farm');
    const events = diffObjects(t.steps[k - 1], t.steps[k]);
    expect(events).toEqual([
      { kind: 'row-removed', objectId: farm.id, key: '8', index: 8 },
      { kind: 'row-removed', objectId: farm.id, key: '19', index: 19 },
    ]);
    expect(new Set(diffObjects(t.steps[k], t.steps[k - 1]).map((e) => JSON.stringify(e)))).toEqual(
      new Set(invertEvents(events).map((e) => JSON.stringify(e))),
    );
  });

  it('a sort in place reorders the rows by index label; a sorted copy starts in source order', () => {
    const t = trace('sort');
    const k = stepAt(t, 5);
    const plots = named(t.steps[k], 'plots');
    const events = diffObjects(t.steps[k - 1], t.steps[k]);
    expect(events).toEqual([
      {
        kind: 'rows-reordered',
        objectId: plots.id,
        from: ['0', '1', '2', '3', '4', '5', '6', '7'],
        to: ['3', '5', '1', '0', '6', '2', '7', '4'],
      },
    ]);
    expect(invertEvents(events)).toEqual(diffObjects(t.steps[k], t.steps[k - 1]));
    expect(cuesAt(t, k).restructured.has(plots.id)).toBe(true);
    const j = stepAt(t, 4);
    const ranked = named(t.steps[j], 'ranked');
    expect(cuesAt(t, j).tables.get(ranked.id)).toEqual({
      kind: 'sort',
      start: ['0', '1', '2', '3', '4', '5', '6', '7'],
    });
  });

  it('motion cues: a new column slides in; filled values cross-fade from the missing ones', () => {
    const c = trace('columns');
    const k = stepAt(c, 4);
    const plots = named(c.steps[k], 'plots');
    expect(cuesAt(c, k).entering.has(columnId(plots.id, "'yield_per_mm'"))).toBe(true);
    const j = stepAt(c, 7);
    const tons = named(c.steps[j], 'tons');
    expect(cuesAt(c, j).entering.has(columnId(tons.id, "'yield_t'"))).toBe(true);
    const m = trace('missing');
    const f = stepAt(m, 5);
    const filled = named(m.steps[f], 'filled');
    const was = cuesAt(m, f).changed.get(`${filled.id}.loc[5, 'yield_kg']`);
    expect(was).toMatchObject({ value: 'nan' });
    expect(rowId('o1', '3')).toBe('o1.index[3]');
  });
});
