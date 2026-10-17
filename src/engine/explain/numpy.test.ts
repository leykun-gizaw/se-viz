/**
 * Derived NumPy explanations (Phase 34): the broadcasting sentence states both shapes and the
 * result's for several shape pairs, and the view / copy sentences on the recorded samples say what
 * the recorded states show. The full text of every step is in `golden/numpy-*.md`.
 */
import { describe, expect, it } from 'vitest';
import { explainBeat } from '../trace/explain.ts';
import type { Trace } from '../trace/types.ts';
import { NUMPY_SAMPLES } from '../../python/samples/numpy/index.ts';
import { broadcastSentence } from './numpy.ts';
import './python.ts';
import { sampleTrace } from './testTraces.ts';

const t = (s: string) => `\`${s}\``;

describe('broadcastSentence', () => {
  it.each([
    [[2, 3], [3], [2, 3], '`a` is repeated along axis 0'],
    [[3, 1], [3], [3, 3], '`m` is repeated along axis 1 and `a` is repeated along axis 0'],
    [[3, 1], [1, 4], [3, 4], '`m` is repeated along axis 1 and `a` is repeated along axis 0'],
    [
      [2, 1, 3],
      [4, 1],
      [2, 4, 3],
      '`m` is repeated along axis 1 and `a` is repeated along axes 0 and 2',
    ],
  ])('%j with %j gives %j', (left, right, result, how) => {
    const s = broadcastSentence(
      { text: t('m'), shape: left },
      { text: t('a'), shape: right },
      result,
    );
    const shape = (x: number[]) => t(x.length === 1 ? `(${x[0]},)` : `(${x.join(', ')})`);
    expect(s).toBe(
      `Broadcasting: \`m\` has shape ${shape(left)} and \`a\` has shape ${shape(right)}, so the result has ` +
        `shape ${shape(result)}: lined up from the right, ${how}.`,
    );
  });

  it('a single value has shape () and is used for every element', () => {
    expect(broadcastSentence({ text: t('a'), shape: [3] }, { text: t('2'), shape: [] }, [3])).toBe(
      'Broadcasting: `a` has shape `(3,)` and `2` is a single value (shape `()`), so the result has shape `(3,)`: `2` is used for every element.',
    );
  });

  it('says nothing when no shape differs', () => {
    expect(
      broadcastSentence({ text: t('a'), shape: [3] }, { text: t('b'), shape: [3] }, [3]),
    ).toBeNull();
  });
});

/** "What this step did" for the step that ran `line`. */
function did(trace: Trace, line: number): string[] {
  const k = trace.steps.findIndex((s) => s.highlightedLines[0] === line);
  return explainBeat(trace, k, 'apply', 'two-beat').did?.items ?? [];
}

describe('NumPy steps on the recorded samples', () => {
  it('broadcasting is explained with both shapes and the result for three shape pairs', () => {
    const tr = sampleTrace('numpy/arithmetic');
    expect(did(tr, 8)).toContain(
      'Broadcasting: `m` has shape `(2, 3)` and `a` has shape `(3,)`, so the result has shape `(2, 3)`: lined up from the right, `a` is repeated along axis 0.',
    );
    expect(did(tr, 10)).toContain(
      'Broadcasting: `col` has shape `(3, 1)` and `a` has shape `(3,)`, so the result has shape `(3, 3)`: lined up from the right, `col` is repeated along axis 1 and `a` is repeated along axis 0.',
    );
    expect(did(tr, 12)).toContain(
      'Broadcasting: `col` has shape `(3, 1)` and `row` has shape `(1, 2)`, so the result has shape `(3, 2)`: lined up from the right, `col` is repeated along axis 1 and `row` is repeated along axis 0.',
    );
  });

  it('a write through a slice view changes the base, and the text says so', () => {
    const tr = sampleTrace('numpy/views');
    expect(did(tr, 5)).toEqual([
      'Stored `100` in `view[0]`: index 0 of `view` (`1` → `100`).',
      '`view` is a view of `base`, so `base[1]` changed too: the two arrays share that element.',
    ]);
  });

  it('a write into a copy changes nothing else, and the text says so', () => {
    const tr = sampleTrace('numpy/views');
    expect(did(tr, 7)).toEqual([
      'Stored `-1` in `copy[1]`: index 1 of `copy` (`100` → `-1`).',
      'No other array shares these elements (`copy` owns its data), so only `copy` changed.',
    ]);
  });

  it('slices name the cells they take; masks name the True cells', () => {
    expect(did(sampleTrace('numpy/index-slice'), 10)[0]).toBe(
      '`m[:, 1]` picks column 1 of `m`, as a new array `col` of shape `(2,)`.',
    );
    const masks = sampleTrace('numpy/masks');
    expect(did(masks, 4)).toContain('`passed` is `True` at indices 1, 2 and 4 (3 of 5).');
    expect(did(masks, 5)[0]).toBe(
      'Kept the elements of `scores` where `passed` is `True` (indices 1, 2 and 4): `good` is a new ndarray of shape `(3,)`.',
    );
  });

  it('aggregation with axis states the shapes and the per-row / per-column result', () => {
    const tr = sampleTrace('numpy/aggregate');
    expect(did(tr, 5)).toEqual([
      'Summed `m` along axis 0, down each column: one result per column, so shape `(2, 3)` becomes `(3,)`.',
      '`col_sums` now refers to the result, a new ndarray: `[5, 7, 9]`.',
    ]);
    expect(did(tr, 4)[0]).toBe('Summed all 6 elements of `m`: `21`.');
  });

  it('a chained call that makes a view of an unnamed array says so; a 3-D slice is named', () => {
    const tr = sampleTrace('numpy/mixed');
    expect(did(tr, 3)).toEqual([
      '`np.arange(12).reshape(3, 4)` made a new 2-D ndarray of shape `(3, 4)`, dtype `int32`: `grid` now refers to it.',
      'It is a view of ndarray o2, an array NumPy made along the way that no name refers to.',
    ]);
    expect(did(tr, 13)[0]).toBe('Stored `7` in the slice `[1, :, :]` of `cube`.');
  });

  it('every NumPy step of every sample has a derived "What this step did"', () => {
    for (const name of NUMPY_SAMPLES.map((x) => x.name)) {
      const tr = sampleTrace(`numpy/${name}`);
      tr.steps.forEach((_, k) => {
        const d = explainBeat(tr, k, 'apply', 'two-beat').did;
        expect(d?.markdown, `${name} step ${k + 1}`).toBe(true);
        for (const s of d?.items ?? []) expect(s).not.toMatch(/undefined|null|NaN|\[object/);
      });
    }
  });
});
