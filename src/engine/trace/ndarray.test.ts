/**
 * NumPy arrays in the trace (Phase 34): shared memory between views, and the object-level diff
 * events for a cell change, an in-place reshape and a write through a view — on the committed NumPy
 * traces — plus the canvas's motion cues for them (shared cells, flights).
 */
import { describe, expect, it } from 'vitest';
import { advanceMotion, initialMotion, motionCues } from '../../components/python/pyMotion.ts';
import {
  bytePositions,
  isArray,
  memoryOwner,
  sharedCells,
  shapeText,
  unravel,
  writeThrough,
  type ArrayBlock,
} from './ndarray.ts';
import { diffObjects, invertEvents } from './objectDiff.ts';
import type { Step, Trace } from './types.ts';
import { validateTrace } from './validate.ts';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/numpy/*.json', {
  eager: true,
  import: 'default',
});
const trace = (name: string) => {
  const t = TRACES[`../../content/fixtures/python/numpy/${name}.json`];
  if (!t) throw new Error(`missing ${name}`);
  return t;
};

/** The step (index) whose highlighted line is `line`. */
const stepAt = (t: Trace, line: number) => t.steps.findIndex((s) => s.highlightedLines[0] === line);

function named(step: Step, name: string): ArrayBlock {
  const cell = step.stack[0].variables.find((v) => v.name === name);
  const block = step.heap.find((b) => cell?.kind === 'pointer' && b.id === cell.target);
  if (!isArray(block)) throw new Error(`${name} is not an array`);
  return block;
}

describe('ndarray helpers', () => {
  it('unravel and shapeText follow C order and Python', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => unravel(i, [2, 3]).join(','))).toEqual([
      '0,0',
      '0,1',
      '0,2',
      '1,0',
      '1,1',
      '1,2',
    ]);
    expect(unravel(7, [2, 2, 2])).toEqual([1, 1, 1]);
    expect([shapeText([3]), shapeText([2, 3]), shapeText([])]).toEqual(['(3,)', '(2, 3)', '()']);
  });

  it('a slice shares exactly its elements with its base; a copy shares none', () => {
    const t = trace('views');
    const end = t.steps[t.steps.length - 1];
    const base = named(end, 'base');
    const view = named(end, 'view');
    const copy = named(end, 'copy');
    expect(memoryOwner(end, view)).toBe(base.id);
    expect(bytePositions(view)).toEqual([4, 8, 12]);
    expect([...sharedCells(end, view, base)]).toEqual([
      [`${view.id}[0]`, `${base.id}[1]`],
      [`${view.id}[1]`, `${base.id}[2]`],
      [`${view.id}[2]`, `${base.id}[3]`],
    ]);
    expect(sharedCells(end, copy, base).size).toBe(0);
  });

  it('a transpose of a reshape view shares every element, by memory not position', () => {
    const t = trace('reshape');
    const step = t.steps[stepAt(t, 5)];
    const grid = named(step, 'grid');
    const turned = named(step, 'turned');
    const shared = sharedCells(step, turned, grid);
    expect(shared.size).toBe(6);
    // turned[0, 1] is grid[1, 0]: row i of `grid` became column i of `turned`.
    expect(shared.get(`${turned.id}[0,1]`)).toBe(`${grid.id}[1,0]`);
    expect(shared.get(`${turned.id}[2,0]`)).toBe(`${grid.id}[0,2]`);
  });

  it('every NumPy trace validates', () => {
    for (const [path, t] of Object.entries(TRACES)) expect(validateTrace(t), path).toEqual([]);
  });

  it('the validator rejects a view whose base is missing and ndarray facts on a list', () => {
    const t = structuredClone(trace('views'));
    const step = t.steps[t.steps.length - 1];
    const view = named(step, 'view');
    view.ndarray.base = 'o99';
    const list = { id: 'o98', cells: [], objectKind: 'list' as const, ndarray: view.ndarray };
    step.heap.push(list);
    const issues = validateTrace(t).map((i) => i.message);
    expect(issues.some((m) => m.includes('view of "o99"'))).toBe(true);
    expect(issues.some((m) => m.includes('"o98": ndarray facts'))).toBe(true);
  });
});

describe('object diff on NumPy steps', () => {
  it('a cell change is one value-changed event on the element', () => {
    const t = trace('views');
    const k = stepAt(t, 7); // copy[1] = -1
    const copy = named(t.steps[k], 'copy');
    expect(diffObjects(t.steps[k - 1], t.steps[k])).toEqual([
      {
        kind: 'value-changed',
        ownerId: copy.id,
        cellId: `${copy.id}[1]`,
        from: expect.objectContaining({ value: '100' }),
        to: expect.objectContaining({ value: '-1' }),
      },
    ]);
  });

  it('a write through a view changes the view and the base in one step', () => {
    const t = trace('views');
    const k = stepAt(t, 5); // view[0] = 100
    const step = t.steps[k];
    const events = diffObjects(t.steps[k - 1], step);
    const changed = events.flatMap((e) => (e.kind === 'value-changed' ? [e.cellId] : []));
    const base = named(step, 'base');
    const view = named(step, 'view');
    expect(changed.sort()).toEqual([`${base.id}[1]`, `${view.id}[0]`].sort());
    expect(writeThrough(step, new Set(changed))).toEqual(
      expect.arrayContaining([[`${view.id}[0]`, `${base.id}[1]`]]),
    );
  });

  it('an in-place reshape is one array-reshaped event (no cells added or removed), invertible', () => {
    const t = trace('reshape');
    const k = stepAt(t, 6); // flat.shape = (3, 2)
    const flat = named(t.steps[k], 'flat');
    const events = diffObjects(t.steps[k - 1], t.steps[k]);
    expect(events).toEqual([{ kind: 'array-reshaped', objectId: flat.id, from: [6], to: [3, 2] }]);
    expect(diffObjects(t.steps[k], t.steps[k - 1])).toEqual(invertEvents(events));
  });

  it('a reshape that makes a view is a new object, not a change to the old one', () => {
    const t = trace('reshape');
    const k = stepAt(t, 4); // grid = flat.reshape(2, 3)
    const events = diffObjects(t.steps[k - 1], t.steps[k]);
    const grid = named(t.steps[k], 'grid');
    expect(events).toEqual(
      expect.arrayContaining([
        { kind: 'object-created', objectId: grid.id },
        { kind: 'name-bound', frameId: 'f1', cellId: 'f1.grid' },
      ]),
    );
    expect(events.some((e) => e.kind === 'value-changed')).toBe(false);
  });
});

describe('motion cues for NumPy', () => {
  const cuesAt = (t: Trace, k: number, reduce = false) =>
    motionCues(advanceMotion(initialMotion(t.steps[k - 1]), t.steps[k]), reduce);

  it('a write through a view marks the written cell and the shared one in the base', () => {
    const t = trace('views');
    const k = stepAt(t, 5);
    const base = named(t.steps[k], 'base');
    const view = named(t.steps[k], 'view');
    const cues = cuesAt(t, k);
    expect([...cues.shared].sort()).toEqual([`${base.id}[1]`, `${view.id}[0]`].sort());
    // Reduced motion still marks it (statically).
    expect(cuesAt(t, k, true).shared.size).toBe(2);
    // A write into the copy shares nothing.
    expect(cuesAt(t, stepAt(t, 7)).shared.size).toBe(0);
  });

  it('a new view flies in from the cells it shares; a transpose from the array it was taken of', () => {
    const t = trace('reshape');
    const k = stepAt(t, 5); // turned = grid.T
    const grid = named(t.steps[k], 'grid');
    const turned = named(t.steps[k], 'turned');
    const flights = cuesAt(t, k).flights;
    expect(flights.size).toBe(6);
    expect(flights.get(`${turned.id}[0,1]`)).toBe(`${grid.id}[1,0]`);
  });

  it('a copy does not fly; an in-place reshape restructures its array', () => {
    const t = trace('reshape');
    expect(cuesAt(t, stepAt(t, 7)).flights.size).toBe(0); // back = turned.copy()
    const k = stepAt(t, 6);
    expect([...cuesAt(t, k).restructured]).toEqual([named(t.steps[k], 'flat').id]);
  });
});
