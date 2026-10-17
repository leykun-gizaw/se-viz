/**
 * The recorder's NumPy output (Phase 34), on the committed recordings of the NumPy samples (real
 * NumPy, recorded by `npm run py:record-packages`) and on the offline stand-in program
 * (`extra-ndarray-standin`, re-recorded by `recorder.test.ts` on every run). Checks shape, dtype,
 * ndim, the 200-value cap, `owndata`, base ids, memory layout, and NumPy scalars as primitives.
 */
import { describe, expect, it } from 'vitest';
import recorderSource from './recorder.py?raw';
import {
  NDARRAY_CAP,
  type PyNdarray,
  type PyObject,
  type PySnapshot,
  type PyValue,
  type RunResult,
} from './protocol.ts';
import { NUMPY_SAMPLES } from './samples/numpy/index.ts';

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

/** What a global name refers to at the end of a run. */
function global(r: RunResult, name: string): PyValue {
  const v = last(r).frames[0].vars.find((x) => x.name === name);
  if (!v) throw new Error(`no global ${name}`);
  return v.value;
}

function arrayOf(r: RunResult, name: string): PyNdarray & { id: string } {
  const v = global(r, name);
  if (v.kind !== 'ref') throw new Error(`${name} is not a reference`);
  const o: PyObject | undefined = last(r).objects[v.id];
  if (o?.kind !== 'ndarray') throw new Error(`${name} is not an ndarray`);
  return { ...o, id: v.id };
}

describe('NumPy recordings (Phase 34)', () => {
  it('the cap in recorder.py is the one the TypeScript side documents', () => {
    expect(recorderSource).toContain(`NDARRAY_CAP = ${NDARRAY_CAP}`);
  });

  it.each(NUMPY_SAMPLES.map((s) => s.name))(
    '%s: ran cleanly; every array keeps the cap',
    (name) => {
      const r = recording(`numpy/${name}`);
      expect(r.error).toBeUndefined();
      expect(r.truncated).toBeUndefined();
      for (const snap of r.steps) {
        for (const o of Object.values(snap.objects)) {
          if (o.kind !== 'ndarray') continue;
          const size = o.shape.reduce((n, d) => n * d, 1);
          expect(o.ndim).toBe(o.shape.length);
          expect(o.values).toHaveLength(Math.min(size, NDARRAY_CAP));
          expect(o.omitted ?? 0).toBe(Math.max(0, size - NDARRAY_CAP));
          expect(o.values.every((v) => v.kind === 'prim')).toBe(true);
          expect(o.layout?.itemsize).toBeGreaterThan(0);
        }
      }
    },
  );

  it('create: shape, dtype and ndim of 1-D, 2-D and 3-D arrays', () => {
    const r = recording('numpy/create');
    const facts = (n: string) => {
      const a = arrayOf(r, n);
      return [a.shape, a.dtype, a.ndim, a.owndata];
    };
    // Pyodide is 32-bit WebAssembly: NumPy's default integer there is int32.
    expect(facts('a')).toEqual([[5], 'int32', 1, true]);
    expect(facts('z')).toEqual([[2, 3], 'float64', 2, true]);
    expect(facts('o')).toEqual([[4], 'float64', 1, true]);
    expect(facts('m')).toEqual([[2, 3], 'int32', 2, true]);
    expect(facts('cube')).toEqual([[3, 2, 2], 'int32', 3, true]);
    expect(arrayOf(r, 'a').values.map((v) => (v.kind === 'prim' ? v.repr : ''))).toEqual([
      '3',
      '1',
      '4',
      '1',
      '5',
    ]);
    expect(arrayOf(r, 't').values.map((v) => (v.kind === 'prim' ? v.repr : ''))).toEqual([
      '0.0',
      '0.25',
      '0.5',
      '0.75',
      '1.0',
    ]);
  });

  it('views: a slice and a reshape name their base; a copy owns its data', () => {
    const r = recording('numpy/views');
    const base = arrayOf(r, 'base');
    const view = arrayOf(r, 'view');
    const copy = arrayOf(r, 'copy');
    const grid = arrayOf(r, 'grid');
    expect(base.owndata).toBe(true);
    expect(base.base).toBeUndefined();
    expect(view).toMatchObject({ owndata: false, base: { kind: 'ref', id: base.id } });
    // `base[1:4]` starts one int32 (4 bytes) into `base`'s memory.
    expect(view.layout).toEqual({ offset: 4, strides: [4], itemsize: 4 });
    expect(grid).toMatchObject({
      owndata: false,
      base: { kind: 'ref', id: base.id },
      shape: [2, 3],
    });
    expect(copy.owndata).toBe(true);
    expect(copy.base).toBeUndefined();
    // The write through the view shows in the base; the write into the copy does not.
    const values = (a: PyNdarray) => a.values.map((v) => (v.kind === 'prim' ? v.repr : ''));
    expect(values(base)).toEqual(['0', '100', '2', '3', '4', '7']);
    expect(values(copy)).toEqual(['0', '-1', '2', '3', '4', '5']);
  });

  it('reshape: a transpose of a view names the owner as its base, with its strides', () => {
    const r = recording('numpy/reshape');
    const flat = arrayOf(r, 'flat');
    const turned = arrayOf(r, 'turned');
    expect(flat.shape).toEqual([3, 2]); // `flat.shape = (3, 2)` changed it in place
    expect(turned.base).toEqual({ kind: 'ref', id: flat.id });
    expect(turned.layout).toEqual({ offset: 0, strides: [4, 12], itemsize: 4 });
  });

  it('capped: 500 values keep the first 200 and count the rest; 4-D arrays are recorded', () => {
    const r = recording('numpy/capped');
    const big = arrayOf(r, 'big');
    expect(big.values).toHaveLength(200);
    expect(big.omitted).toBe(300);
    expect(big.values[0]).toEqual({ kind: 'prim', type: 'int', repr: '-1' });
    expect(arrayOf(r, 'grid')).toMatchObject({
      shape: [20, 25],
      omitted: 300,
      base: { id: big.id },
    });
    expect(arrayOf(r, 'hyper')).toMatchObject({ shape: [2, 2, 2, 2], ndim: 4, dtype: 'float64' });
  });

  it('NumPy scalars are primitives with their dtype', () => {
    const r = recording('numpy/index-slice');
    expect(global(r, 'x')).toEqual({ kind: 'prim', type: 'int', repr: '20', dtype: 'int32' });
    expect(global(r, 'v')).toEqual({ kind: 'prim', type: 'int', repr: '3', dtype: 'int32' });
    expect(global(recording('numpy/aggregate'), 'total')).toMatchObject({
      repr: '21',
      dtype: 'int32',
    });
    expect(global(recording('packages-numpy-pandas'), 'best')).toEqual({
      kind: 'prim',
      type: 'float',
      repr: '5.5',
      dtype: 'float64',
    });
  });

  it('statement facts keep slices, tuple indices and keyword values', () => {
    const facts = recording('numpy/index-slice').steps.flatMap((s) => (s.stmt ? [s.stmt] : []));
    const col = facts.find((s) => s.line === 10);
    expect(col).toMatchObject({
      kind: 'Assign',
      value: {
        type: 'subscript',
        index: {
          type: 'display',
          of: 'tuple',
          items: [{ type: 'slice' }, { type: 'const', repr: '1' }],
        },
      },
    });
    const part = facts.find((s) => s.line === 6);
    expect(part).toMatchObject({
      value: { index: { type: 'slice', lower: { repr: '1' }, upper: { repr: '4' } } },
    });
    const sums = recording('numpy/aggregate').steps.flatMap((s) => (s.stmt ? [s.stmt] : []));
    expect(sums.find((s) => s.line === 5)).toMatchObject({
      value: { kwargs: [{ name: 'axis', value: { type: 'const', repr: '0' } }] },
    });
  });
});

describe('offline stand-in (recorded by recorder.test.ts)', () => {
  it('caps at 200 values, links the view to its base, and reads a NumPy scalar', () => {
    const r = recording('extra-ndarray-standin');
    expect(r.error).toBeUndefined();
    const big = arrayOf(r, 'big');
    const part = arrayOf(r, 'part');
    expect(big).toMatchObject({
      shape: [250],
      dtype: 'int64',
      ndim: 1,
      omitted: 50,
      owndata: true,
    });
    expect(big.values).toHaveLength(200);
    expect(part).toMatchObject({
      owndata: false,
      base: { kind: 'ref', id: big.id },
      layout: { offset: 8, strides: [8], itemsize: 8 },
    });
    expect(global(r, 'seven')).toEqual({ kind: 'prim', type: 'int', repr: '7', dtype: 'int64' });
  });
});
