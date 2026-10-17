/**
 * The pandas table view, server-rendered (Phase 35): snapshots of a DataFrame, a capped DataFrame
 * (rows and columns), a Series and a GroupBy, the structure each must show, the "kept N of M rows"
 * chip, the "from" link (drawn from measured boxes), and the pure layout helpers.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnchorContext, type Anchor, type AnchorRegistry } from '../../engine/anchorContext.ts';
import { derivedTables } from '../../engine/trace/pandas.ts';
import type { Step, Trace } from '../../engine/trace/types.ts';
import PythonCanvas from './PythonCanvas.tsx';
import { FromLinks } from './TableView.tsx';
import { columnWidth, DerivedContext, fromLinkPath, showingText } from './tableLayout.ts';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/pandas/*.json', {
  eager: true,
  import: 'default',
});
const trace = (name: string) => TRACES[`../../content/fixtures/python/pandas/${name}.json`];
const lastStep = (t: Trace) => t.steps[t.steps.length - 1];

/** The markup of one object box (`data-coach-anchor="oN"`), up to the next box or region end. */
function box(html: string, id: string): string {
  const start = html.indexOf(`data-coach-anchor="${id}"`);
  if (start < 0) throw new Error(`no box ${id}`);
  // The next object box (not a chip inside this one, such as a GroupBy's `o2.obj`).
  const rest = html.slice(start + 10);
  const next = rest.search(/data-coach-anchor="o\d+"/);
  return html.slice(start, next < 0 ? undefined : start + 10 + next);
}

function idOf(step: Step, name: string): string {
  const cell = step.stack[0].variables.find((v) => v.name === name);
  if (cell?.kind !== 'pointer' || cell.target === null) throw new Error(`no object ${name}`);
  return cell.target;
}

/** The index labels of a table's rows, in document order. */
const rowLabels = (html: string) =>
  [...html.matchAll(/data-pd-row="[^":]+:[^"]+"[^>]*><span[^>]*>([^<]*)</g)].map((m) => m[1]);

const render = (t: Trace, step = lastStep(t)) =>
  renderToStaticMarkup(<PythonCanvas trace={t} step={step} />);

describe('TableView', () => {
  it('DataFrame: header row with names and dtypes, an index column, zebra rows, capped footer', () => {
    const read = trace('read');
    const end = lastStep(read);
    const farm = box(render(read), idOf(end, 'farm'));
    expect(farm).toContain('>DataFrame</span>');
    expect(farm).toContain('>30 × 6</span>');
    for (const name of ['plot_id', 'region', 'crop', 'rainfall_mm', 'yield_kg', 'fertilized'])
      expect(farm).toContain(`>${name}</span>`);
    expect(farm).toContain('float64');
    expect(farm).toContain(' · 2 NaN');
    expect(rowLabels(farm)).toEqual(Array.from({ length: 20 }, (_, i) => String(i)));
    expect(farm).toContain('bg-surface-2'); // zebra
    expect(farm).toContain('showing 20 of 30 rows');
    // A missing value shows as NaN, faint and italic; strings without their quotes.
    expect(farm).toMatch(/italic text-ink-faint">NaN</);
    expect(farm).toContain('>Highland<');
    // Wide tables scroll inside the box, which is at most 44rem wide.
    expect(farm).toContain('max-w-[44rem]');
    expect(farm).toContain('max-w-full overflow-x-auto');
    expect(farm).toMatchSnapshot();
  });

  it('capped DataFrame: "showing 20 of 1,200 rows" and "12 of 15 columns"', () => {
    const capped = trace('capped');
    const end = lastStep(capped);
    const html = render(capped);
    const days = box(html, idOf(end, 'days'));
    expect(days).toContain('showing 20 of 1,200 rows');
    expect(rowLabels(days)).toHaveLength(20);
    const wide = box(html, idOf(end, 'wide'));
    expect(wide).toContain('showing 12 of 15 columns');
    expect(wide).toContain('>3 × 15</span>');
    expect(wide).toContain('>plot_11</span>');
    expect(wide).not.toContain('>plot_12</span>');
    expect(wide).toMatchSnapshot();
    // A long text value is cut to 40 characters, ending in …
    expect(box(html, idOf(end, 'notes'))).toContain('dry soil, late planting, weeded twice …');
  });

  it('Series: a two-column table, index and values, with its name and dtype', () => {
    const series = trace('series');
    const end = lastStep(series);
    const rain = box(render(series), idOf(end, 'rain'));
    expect(rain).toContain('>Series</span>');
    expect(rain).toContain('>4 values</span>');
    expect(rain).toContain('>rainfall_mm</span>');
    expect(rowLabels(rain)).toEqual(['Highland', 'Lakeside', 'Valley', 'Coast']);
    expect(rain).toContain('>600<'); // rain["Valley"] = 600
    expect(rain).toMatchSnapshot();
  });

  it('GroupBy: the keys and group count, then each group with its size and first rows', () => {
    const g = trace('groupby');
    const end = lastStep(g);
    const html = render(g);
    const by = box(html, idOf(end, 'by_region'));
    expect(by).toContain('>DataFrameGroupBy</span>');
    expect(by).toContain('by region · 4 groups');
    expect(by).toContain('30 rows split by region');
    for (const [label, size, more] of [
      ['Coast', 7, 4],
      ['Highland', 8, 5],
      ['Lakeside', 7, 4],
      ['Valley', 8, 5],
    ] as const) {
      expect(by).toContain(`region = ${label}`);
      expect(by).toContain(`>${size} rows<`);
      expect(by).toContain(`… ${more} more rows`);
    }
    // Its reference to the grouped frame is a chip (the arrow leaves from it).
    expect(by).toContain(`data-coach-anchor="${idOf(end, 'by_region')}.obj"`);
    expect(by).toMatchSnapshot();
  });

  it('a filtered table says how many rows it kept, and keeps their index labels', () => {
    const f = trace('filter');
    const end = lastStep(f);
    const html = render(f);
    const rainy = box(html, idOf(end, 'rainy'));
    expect(rainy).toContain('kept 10 of 30 rows');
    expect(rowLabels(rainy)).toEqual(['2', '4', '7', '10', '11', '15', '18', '23', '26', '27']);
    expect(box(html, idOf(end, 'farm'))).not.toContain('kept');
  });

  it('a "from" link joins a derived table to its source, unless a GroupBy refers to it', () => {
    const g = trace('groupby');
    const step = lastStep(g);
    const rects: Record<string, Anchor> = {
      [idOf(step, 'farm')]: { x: 300, y: 40, width: 400, height: 300 },
      [idOf(step, 'by_region')]: { x: 300, y: 400, width: 400, height: 300 },
      [idOf(step, 'totals')]: { x: 300, y: 760, width: 150, height: 100 },
    };
    const registry: AnchorRegistry = {
      setCanvas: () => {},
      anchorRef: () => () => {},
      getAnchor: (id) => rects[id] ?? null,
      version: 1,
      pulse: () => {},
    };
    const svg = renderToStaticMarkup(
      <AnchorContext.Provider value={registry}>
        <DerivedContext.Provider value={derivedTables(g)}>
          <FromLinks step={step} />
        </DerivedContext.Provider>
      </AnchorContext.Provider>,
    );
    // `totals` comes from `by_region`; `by_region`'s own reference arrow says where it comes from.
    expect(svg.match(/>from</g)).toHaveLength(1);
    expect(svg).toContain(
      `d="${fromLinkPath(rects[idOf(step, 'totals')], rects[idOf(step, 'by_region')], 0).d}"`,
    );
    expect(svg).toContain('var(--se-static)');
  });
});

describe('tableLayout', () => {
  it('column widths fit the widest text, 3 to 40 characters plus padding', () => {
    expect(columnWidth(['a'])).toBe(5);
    expect(columnWidth(['rainfall_mm', '820.0'])).toBe(13);
    expect(columnWidth(['x'.repeat(60)])).toBe(42);
  });

  it('the footer names what is not shown', () => {
    expect(showingText(20, 1200, 2, 2)).toBe('showing 20 of 1,200 rows');
    expect(showingText(3, 3, 12, 15)).toBe('showing 12 of 15 columns');
    expect(showingText(20, 30, 12, 15)).toBe('showing 20 of 30 rows · 12 of 15 columns');
    expect(showingText(4, 4, null, null, 'values')).toBeNull();
  });

  it('a "from" link beside its source crosses the gap; elsewhere it runs down a channel', () => {
    const source = { x: 0, y: 0, width: 100, height: 50 };
    expect(fromLinkPath({ x: 160, y: 0, width: 80, height: 40 }, source, 1).d).toBe(
      'M 160 13 L 130 13 L 130 13 L 102 13',
    );
    expect(fromLinkPath({ x: 0, y: 100, width: 80, height: 40 }, source, 0).d).toBe(
      'M 80 113 L 114 113 L 114 13 L 102 13',
    );
  });
});
