/**
 * The Phase 29 sample recordings as SE-Viz traces (Phase 30). Each recorder fixture in `fixtures/`
 * is mapped with {@link recordingToTrace} and written to `src/content/fixtures/python/<name>.json`
 * as a file snapshot (`vitest -u` refreshes it; `CI=1` fails on drift), so the committed traces can
 * never fall out of step with the recordings or the mapping.
 */
import { describe, expect, it } from 'vitest';
import { validateTrace } from '../engine/trace/validate.ts';
import type { RunResult } from './protocol.ts';
import { SAMPLES } from './samples/index.ts';
import { NUMPY_SAMPLES } from './samples/numpy/index.ts';
import { MATPLOTLIB_SAMPLES } from './samples/matplotlib/index.ts';
import { PANDAS_SAMPLES } from './samples/pandas/index.ts';
import { recordingToTrace } from './toTrace.ts';

const RAW = import.meta.glob<string>('./fixtures/**/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function recording(name: string): RunResult {
  const text = RAW[`./fixtures/${name}.json`];
  if (text === undefined) throw new Error(`missing recorder fixture ${name}`);
  return JSON.parse(text) as RunResult;
}

/** The samples that ran (7b, the syntax error, has no steps and so no trace). */
const TRACED = SAMPLES.filter((s) => s.name !== 'syntax-error');

/** "1. Aliasing" → "Aliasing". */
const titleOf = (title: string) => title.replace(/^\d+[ab]?\.\s*/, '');

describe('Phase 29 recordings as Python traces', () => {
  it.each(TRACED.map((s) => [s.name, s] as const))(
    '%s maps to a valid trace and matches its committed file',
    async (name, sample) => {
      const trace = recordingToTrace(recording(name), sample.request.source, {
        id: `python-${name}`,
        title: titleOf(sample.title),
        file: `${name}.py`,
      });
      expect(trace.language).toBe('python');
      expect(trace.steps.length).toBeGreaterThan(0);
      expect(validateTrace(trace)).toEqual([]);
      await expect(`${JSON.stringify(trace, null, 1)}\n`).toMatchFileSnapshot(
        `../content/fixtures/python/${name}.json`,
      );
    },
  );

  it('a syntax error maps to a trace with no steps', () => {
    const trace = recordingToTrace(recording('syntax-error'), 'print(', { id: 'x', title: 'x' });
    expect(trace.steps).toEqual([]);
  });
});

describe('Phase 34 NumPy recordings as Python traces', () => {
  it.each(NUMPY_SAMPLES.map((s) => [s.name, s] as const))(
    'numpy/%s maps to a valid trace and matches its committed file',
    async (name, sample) => {
      const result = recording(`numpy/${name}`);
      expect(result.error).toBeUndefined();
      const trace = recordingToTrace(result, sample.source, {
        id: `python-numpy-${name}`,
        title: sample.title,
        file: `${name}.py`,
      });
      expect(trace.steps.length).toBeGreaterThan(0);
      expect(trace.steps.some((s) => s.heap.some((b) => b.objectKind === 'ndarray'))).toBe(true);
      expect(validateTrace(trace)).toEqual([]);
      await expect(`${JSON.stringify(trace, null, 1)}\n`).toMatchFileSnapshot(
        `../content/fixtures/python/numpy/${name}.json`,
      );
    },
  );
});

describe('Phase 35 pandas recordings as Python traces', () => {
  it.each(PANDAS_SAMPLES.map((s) => [s.name, s] as const))(
    'pandas/%s maps to a valid trace and matches its committed file',
    async (name, sample) => {
      const result = recording(`pandas/${name}`);
      expect(result.error).toBeUndefined();
      const trace = recordingToTrace(result, sample.source, {
        id: `python-pandas-${name}`,
        title: sample.title,
        file: `${name}.py`,
      });
      expect(trace.steps.length).toBeGreaterThan(0);
      expect(
        trace.steps.some((s) =>
          s.heap.some((b) => ['dataframe', 'series', 'groupby'].includes(b.objectKind ?? '')),
        ),
      ).toBe(true);
      expect(validateTrace(trace)).toEqual([]);
      await expect(`${JSON.stringify(trace, null, 1)}\n`).toMatchFileSnapshot(
        `../content/fixtures/python/pandas/${name}.json`,
      );
    },
  );
});

describe('Phase 36 matplotlib recordings as Python traces', () => {
  it.each(MATPLOTLIB_SAMPLES.map((s) => [s.name, s] as const))(
    'matplotlib/%s maps to a valid trace and matches its committed file',
    async (name, sample) => {
      const result = recording(`matplotlib/${name}`);
      expect(result.error).toBeUndefined();
      const trace = recordingToTrace(result, sample.source, {
        id: `python-matplotlib-${name}`,
        title: sample.title,
        file: `${name}.py`,
      });
      expect(trace.steps.length).toBeGreaterThan(0);
      expect(trace.figures?.length ?? 0).toBeGreaterThan(0);
      expect(validateTrace(trace)).toEqual([]);
      await expect(`${JSON.stringify(trace, null, 1)}\n`).toMatchFileSnapshot(
        `../content/fixtures/python/matplotlib/${name}.json`,
      );
    },
  );
});
