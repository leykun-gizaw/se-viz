/**
 * The matplotlib explanations (Phase 36) beyond the goldens: the `pyplot` names an import binds,
 * and the sentences for figures without an image (each reason, and the two "too large" cases).
 */
import { describe, expect, it } from 'vitest';
import type { Trace, TraceFigure } from '../trace/types.ts';
import { figureRow, figureSentence, pyplotNames } from './matplotlib.ts';

const fig = (patch: Partial<TraceFigure>): TraceFigure => ({
  id: 'fig3',
  step: 2,
  number: 1,
  trigger: 'show',
  title: 'Rain',
  width: 6.4,
  height: 4.8,
  axes: [{ kinds: ['scatter'], title: 'Rain', xlabel: null, ylabel: null, legend: null }],
  format: 'svg',
  bytes: 1000,
  data: '<svg/>',
  ...patch,
});

describe('pyplotNames', () => {
  const traceOf = (source: string): Trace => ({
    id: 't',
    title: 't',
    language: 'python',
    source,
    steps: [],
    statements: Object.fromEntries(
      source
        .split('\n')
        .map((_, i) => [String(i + 1), { kind: 'Import', line: i + 1, end: i + 1, names: [] }]),
    ) as unknown as NonNullable<Trace['statements']>,
  });

  it('reads the names each import form binds', () => {
    expect([...pyplotNames(traceOf('import matplotlib.pyplot as plt'))]).toEqual(['plt']);
    expect([...pyplotNames(traceOf('from matplotlib import pyplot as p'))]).toEqual(['p']);
    expect([...pyplotNames(traceOf('from matplotlib import pyplot'))]).toEqual(['pyplot']);
    expect([...pyplotNames(traceOf('import matplotlib.pyplot'))]).toEqual(['matplotlib.pyplot']);
    expect([...pyplotNames(traceOf('import numpy as np, matplotlib.pyplot as mp'))]).toEqual([
      'mp',
    ]);
    expect([...pyplotNames(traceOf('import matplotlib as plt'))]).toEqual([]);
  });
});

describe('figures without an image', () => {
  it('says why, without claiming what was not measured', () => {
    expect(figureSentence(fig({ format: 'none', reason: 'cap', bytes: null }))).toContain(
      'At most 6 figures are kept per run, so it has no image.',
    );
    expect(figureSentence(fig({ format: 'none', reason: 'error', bytes: null }))).toContain(
      'Matplotlib could not draw it',
    );
    // A normal-size canvas: both an SVG and a PNG were made, and both were over the cap.
    expect(figureSentence(fig({ format: 'none', reason: 'too-large', bytes: 400_000 }))).toContain(
      'over 300 KB both as an SVG and as a PNG at 100 dpi',
    );
    // A huge canvas: no PNG was tried.
    const huge = figureSentence(
      fig({ format: 'none', reason: 'too-large', width: 40, height: 40, bytes: 400_000 }),
    );
    expect(huge).toContain('4000 × 4000 pixels at 100 dpi is too big for a PNG');
    expect(huge).not.toContain('as a PNG at 100 dpi,');
  });

  it('marks PNG figures and figures without an image in "What changed"', () => {
    expect(figureRow(fig({ format: 'png' }))).toBe('Figure 3 (scatter plot): `Rain` · PNG');
    expect(figureRow(fig({ format: 'none', reason: 'cap' }))).toBe(
      'Figure 3 (scatter plot): `Rain` · no image',
    );
    expect(figureSentence(fig({ format: 'png' }))).toContain('shown as a PNG image');
  });
});
