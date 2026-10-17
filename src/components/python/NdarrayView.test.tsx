/**
 * The NumPy array view, server-rendered (Phase 34): snapshots of a 1-D, a 2-D and a 3-D array, a
 * view (its "view of" link, drawn from measured boxes), and a capped array (the summary), plus the
 * structure each must show.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnchorContext, type Anchor, type AnchorRegistry } from '../../engine/anchorContext.ts';
import type { Step, Trace } from '../../engine/trace/types.ts';
import { ViewLinks } from './NdarrayView.tsx';
import { cellText, gridPlan, viewLinkPath } from './ndLayout.ts';
import PythonCanvas from './PythonCanvas.tsx';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/numpy/*.json', {
  eager: true,
  import: 'default',
});
const trace = (name: string) => TRACES[`../../content/fixtures/python/numpy/${name}.json`];
const lastStep = (t: Trace) => t.steps[t.steps.length - 1];

/** The markup of one object box (`data-coach-anchor="oN"`), up to the next box or region end. */
function box(html: string, id: string): string {
  const start = html.indexOf(`data-coach-anchor="${id}"`);
  if (start < 0) throw new Error(`no box ${id}`);
  const next = html.indexOf('data-coach-anchor="o', start + 10);
  return html.slice(start, next < 0 ? undefined : next);
}

function idOf(step: Step, name: string): string {
  const cell = step.stack[0].variables.find((v) => v.name === name);
  if (cell?.kind !== 'pointer' || cell.target === null) throw new Error(`no array ${name}`);
  return cell.target;
}

/** Cell values in document order. */
const values = (html: string) =>
  [...html.matchAll(/data-np-cell="[^"]+"[^>]*>(?:<[^>]+>)*([^<]+)</g)].map((m) => m[1]);

describe('NdarrayView', () => {
  const create = trace('create');
  const end = lastStep(create);
  const html = renderToStaticMarkup(<PythonCanvas trace={create} step={end} />);

  it('1-D: a row of cells with their indices, shape and dtype in the header', () => {
    const a = box(html, idOf(end, 'a'));
    expect(a).toContain('>ndarray</span>');
    expect(a).toContain('>(5,)</span>');
    expect(a).toContain('>int32</span>');
    expect(values(a)).toEqual(['3', '1', '4', '1', '5']);
    expect(a).toContain('grid-column:5');
    expect(a).toMatchSnapshot();
  });

  it('2-D: a grid with row and column indices', () => {
    const m = box(html, idOf(end, 'm'));
    expect(m).toContain('>(2, 3)</span>');
    expect(values(m)).toEqual(['1', '2', '3', '4', '5', '6']);
    // Element [1, 2] sits on grid row 3 (after the column indices), column 4 (after the row index).
    expect(m).toContain('style="grid-row:3;grid-column:4"');
    expect(m).toMatchSnapshot();
  });

  it('3-D: a stack of 2-D slices, each labelled by its first-axis index', () => {
    const cube = box(html, idOf(end, 'cube'));
    expect(cube).toContain('>(3, 2, 2)</span>');
    for (const k of [0, 1, 2]) expect(cube).toContain(`>[${k}, :, :]</span>`);
    expect(values(cube)).toHaveLength(12);
    expect(cube).toMatchSnapshot();
  });

  it('a view says whose memory it uses; its dashed link joins the two boxes', () => {
    const views = trace('views');
    const step = lastStep(views);
    const out = renderToStaticMarkup(<PythonCanvas trace={views} step={step} />);
    const view = box(out, idOf(step, 'view'));
    expect(view).toContain('tracking-wide text-ink-faint">view</span>');
    expect(view).toContain(`view of ${idOf(step, 'base')}: shares its memory, no copy`);
    expect(box(out, idOf(step, 'copy'))).not.toContain('view of');

    // The link itself needs measured boxes: give it two.
    const rects: Record<string, Anchor> = {
      [idOf(step, 'base')]: { x: 300, y: 40, width: 260, height: 80 },
      [idOf(step, 'view')]: { x: 300, y: 160, width: 200, height: 80 },
      [idOf(step, 'grid')]: { x: 300, y: 400, width: 200, height: 90 },
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
        <ViewLinks step={step} />
      </AnchorContext.Provider>,
    );
    expect(svg).toContain('stroke-dasharray="5 4"');
    expect(svg.match(/>view of</g)).toHaveLength(2); // `view` and `grid` are views of `base`
    expect(svg).toContain(
      `d="${viewLinkPath(rects[idOf(step, 'view')], rects[idOf(step, 'base')], 0).d}"`,
    );
    expect(svg).toMatchSnapshot();
  });

  it('a capped array (500 values) falls back to the summary with a flat preview', () => {
    const capped = trace('capped');
    const step = lastStep(capped);
    const out = renderToStaticMarkup(<PythonCanvas trace={capped} step={step} />);
    const big = box(out, idOf(step, 'big'));
    expect(big).toContain('500 values · 1-D · flat, in C order');
    expect(big).toContain('… 476 more');
    expect(big).toContain('summary: more than 200 values: only the first 200 are recorded');
    expect(values(big)).toHaveLength(24);
    expect(big).toMatchSnapshot();
    const hyper = box(out, idOf(step, 'hyper'));
    expect(hyper).toContain('4-D: only arrays of up to 3 dimensions are drawn as grids');
    // A small view of the big array is a grid again.
    expect(values(box(out, idOf(step, 'first')))).toEqual(['-1', '1', '2', '3', '4']);
  });
});

describe('ndLayout', () => {
  it('long floats are shortened, marked with …; others are left alone', () => {
    expect(cellText('0.30000000000000004')).toBe('0.3…');
    expect(cellText('0.3333333333333333')).toBe('0.333333…');
    expect(cellText('2.5')).toBe('2.5');
    expect(cellText('1234567890')).toBe('1234567890');
    expect(cellText("'banana split'")).toBe("'banana split'");
  });

  it('grid plans place elements after the index labels', () => {
    expect(gridPlan([4]).place([2])).toEqual({ row: 2, col: 3 });
    expect(gridPlan([2, 3]).place([1, 0])).toEqual({ row: 3, col: 2 });
    // 3-D (2, 2, 3): slice 1 starts at row 2 + 1·(2 + 1) = 5 (its label); its row 0 is grid row 6.
    expect(gridPlan([2, 2, 3]).place([1, 0, 2])).toEqual({ row: 6, col: 4 });
    expect(
      gridPlan([2, 2, 3])
        .labels.filter((l) => l.kind === 'slice')
        .map((l) => l.row),
    ).toEqual([2, 5]);
  });
});
