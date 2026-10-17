/**
 * The Phase 37 concept views, server-rendered: a snapshot per view and mode, plus the structure each
 * must show (state attributes, pointers, the shaded tail, the overlaid normal curve).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { binarySearchAbsentTrace } from '../../content/fixtures/conceptBinarySearchAbsent.ts';
import { binarySearchTrace } from '../../content/fixtures/conceptBinarySearch.ts';
import { bubbleSortTrace } from '../../content/fixtures/conceptBubbleSort.ts';
import { growthTrace } from '../../content/fixtures/conceptGrowth.ts';
import { hypothesisOneTailedTrace } from '../../content/fixtures/conceptHypothesisTest.ts';
import { hypothesisTwoTailedTrace } from '../../content/fixtures/conceptHypothesisTwoTailed.ts';
import { mergeSortTrace } from '../../content/fixtures/conceptMergeSort.ts';
import { samplingTrace } from '../../content/fixtures/conceptSampling.ts';
import { viewSupportsBeats } from '../../engine/trace/beats.ts';
import type { Step, Trace } from '../../engine/trace/types.ts';
import { useTrace } from '../../engine/trace/useTrace.ts';
import { Stage } from '../Stage.tsx';
import { BarsView } from './BarsView.tsx';
import { DistributionView } from './DistributionView.tsx';
import { GrowthView } from './GrowthView.tsx';

const at = (t: Trace, i: number): Step => t.steps[i < 0 ? t.steps.length + i : i];
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('BarsView', () => {
  it('sort mode: a swap step marks the two bars, the sorted region and the counters', () => {
    const step = bubbleSortTrace.steps.find((s) => s.bars!.swapped && s.bars!.sorted?.length)!;
    const html = renderToStaticMarkup(<BarsView step={step} />);
    for (const i of step.bars!.swapped!)
      expect(html).toContain(`data-bar="${i}" data-state="swapped"`);
    expect(count(html, 'data-state="sorted"')).toBe(
      step.bars!.sorted!.filter((i) => !step.bars!.swapped!.includes(i)).length,
    );
    expect(html).toContain(`>${step.bars!.counters.swaps}</span>`);
    expect(html).toMatchSnapshot();
  });

  it('search mode: low, mid and high under their bars, the range, and the target', () => {
    const step = at(binarySearchTrace, 1);
    const html = renderToStaticMarkup(<BarsView step={step} />);
    for (const label of ['low', 'mid', 'high']) expect(html).toContain(`data-pointer="${label}"`);
    expect(html).toContain('stroke-dasharray="4 3"'); // the range box
    expect(html).toContain('>Target</span>');
    expect(html).toMatchSnapshot();
  });

  it('search mode, not found: pointers past each other and no range', () => {
    const html = renderToStaticMarkup(<BarsView step={at(binarySearchAbsentTrace, -1)} />);
    expect(html).not.toContain('stroke-dasharray="4 3"');
    expect(html).toMatchSnapshot();
  });

  it('merge mode: one row per split level, the active merge highlighted', () => {
    const step = mergeSortTrace.steps.find((s) =>
      s.bars!.segments!.some((g) => g.state === 'active'),
    )!;
    const html = renderToStaticMarkup(<BarsView step={step} />);
    expect(count(html, 'data-segment=')).toBe(2 * 8 - 1);
    expect(html).toContain('data-state="active"');
    expect(html).toContain('>Writes</span>');
    expect(html).toMatchSnapshot();
  });
});

describe('GrowthView', () => {
  it('a curve, a marker and a table cell per complexity; clipped curves get an arrow with the count', () => {
    const html = renderToStaticMarkup(<GrowthView step={at(growthTrace, -1)} />);
    expect(count(html, 'data-curve=')).toBe(5);
    expect(count(html, 'data-marker=')).toBe(5);
    expect(html).toContain('O(n²) = 4,096');
    expect(html).toContain('data-caption');
    expect(html).toMatchSnapshot();
  });

  it('the first step', () => {
    expect(renderToStaticMarkup(<GrowthView step={at(growthTrace, 0)} />)).toMatchSnapshot();
  });
});

describe('DistributionView', () => {
  it('sampling mode, one sample: the sample on the population and its mean marked', () => {
    const html = renderToStaticMarkup(<DistributionView step={at(samplingTrace, 1)} />);
    expect(html).toContain('data-mode="sampling"');
    expect(count(html, 'data-sample')).toBe(30);
    expect(count(html, 'data-mark=')).toBe(1);
    expect(html).not.toContain('data-normal');
    expect(html).toMatchSnapshot();
  });

  it('sampling mode, the end: the normal curve overlaid', () => {
    const html = renderToStaticMarkup(<DistributionView step={at(samplingTrace, -1)} />);
    expect(html).toContain('data-normal');
    expect(html).toContain('>Skewness</span>');
    expect(html).toMatchSnapshot();
  });

  it('hypothesis mode, one-tailed: the observed marker and the right tail shaded', () => {
    const step = at(hypothesisOneTailedTrace, -1);
    const html = renderToStaticMarkup(<DistributionView step={step} />);
    expect(html).toContain('data-observed="observed"');
    expect(html).not.toContain('data-observed="mirror"');
    expect(html).toContain('data-tail="true"');
    expect(html).toContain(`>${step.distribution!.test!.pValue.toFixed(3)}</span>`);
    expect(html).toMatchSnapshot();
  });

  it('hypothesis mode, two-tailed: the mirrored marker and both tails shaded', () => {
    const html = renderToStaticMarkup(<DistributionView step={at(hypothesisTwoTailedTrace, -1)} />);
    expect(html).toContain('data-observed="mirror"');
    expect(count(html, 'data-tail-band=')).toBe(2);
    expect(html).toMatchSnapshot();
  });

  it('hypothesis mode, before any shuffle: no p-value yet', () => {
    const html = renderToStaticMarkup(<DistributionView step={at(hypothesisTwoTailedTrace, 0)} />);
    expect(html).toContain('>—</span>');
  });
});

describe('in the Stage', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function Host({ trace }: { trace: Trace }) {
    return <Stage player={useTrace(trace)} />;
  }

  it('the new views are single-beat and load lazily (a fallback until the chunk arrives)', () => {
    for (const view of ['bars', 'growth', 'distribution'])
      expect(viewSupportsBeats(view)).toBe(false);
    const html = renderToStaticMarkup(<Host trace={bubbleSortTrace} />);
    expect(html).toContain('Loading…');
    expect(html).toContain('aria-label="Timeline: jump to a step"');
  });
});
