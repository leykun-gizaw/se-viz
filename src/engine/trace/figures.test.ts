/**
 * Which figures a step shows (Phase 36): cumulative like printed output, so stepping back past the
 * step that produced a figure hides it. Pure selector, on the recorded histogram sample (two
 * figures, shown at two different steps) and the live-run ending step.
 */
import { describe, expect, it } from 'vitest';
import histogram from '../../content/fixtures/python/matplotlib/histogram.json';
import { figuresAt, figuresMadeAt } from './figures.ts';
import type { Trace, TraceFigure } from './types.ts';

const trace = histogram as unknown as Trace;
const ids = (figs: readonly TraceFigure[]) => figs.map((f) => f.id);

describe('figuresAt', () => {
  const [first, second] = trace.figures!;

  it('the sample has two figures at two different steps', () => {
    expect(trace.figures).toHaveLength(2);
    expect(first.step).toBeLessThan(second.step);
  });

  it('shows nothing before the first figure, then each figure from its own step on', () => {
    expect(ids(figuresAt(trace.figures, 0))).toEqual([]);
    expect(ids(figuresAt(trace.figures, first.step - 1))).toEqual([]);
    expect(ids(figuresAt(trace.figures, first.step))).toEqual(['fig1']);
    expect(ids(figuresAt(trace.figures, second.step - 1))).toEqual(['fig1']);
    expect(ids(figuresAt(trace.figures, second.step))).toEqual(['fig1', 'fig2']);
    expect(ids(figuresAt(trace.figures, trace.steps.length - 1))).toEqual(['fig1', 'fig2']);
  });

  it('stepping back hides the figures produced later', () => {
    const forward = trace.steps.map((_, k) => ids(figuresAt(trace.figures, k)));
    const backward = [...trace.steps.keys()].reverse().map((k) => ids(figuresAt(trace.figures, k)));
    expect(backward).toEqual([...forward].reverse());
    // Back from the second figure's step: it is gone, the first stays.
    expect(ids(figuresAt(trace.figures, second.step - 1))).not.toContain('fig2');
  });

  it('a step after the last one (a live run’s ending step) still shows every figure', () => {
    expect(ids(figuresAt(trace.figures, trace.steps.length))).toEqual(['fig1', 'fig2']);
  });

  it('traces without figures show none', () => {
    expect(figuresAt(undefined, 3)).toEqual([]);
    expect(figuresAt([], 3)).toEqual([]);
  });

  it('figuresMadeAt is the step’s own figures only', () => {
    expect(ids(figuresMadeAt(trace, first.step))).toEqual(['fig1']);
    expect(ids(figuresMadeAt(trace, first.step + 1))).toEqual([]);
  });
});
