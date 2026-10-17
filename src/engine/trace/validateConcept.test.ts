/** Validation of the Phase 37 concept-view payloads (bars, growth, distribution). */
import { describe, expect, it } from 'vitest';
import { bubbleSortTrace } from '../../content/fixtures/conceptBubbleSort.ts';
import { growthTrace } from '../../content/fixtures/conceptGrowth.ts';
import { hypothesisOneTailedTrace } from '../../content/fixtures/conceptHypothesisTest.ts';
import { samplingTrace } from '../../content/fixtures/conceptSampling.ts';
import type { Step, Trace } from './types.ts';
import { validateTrace } from './validate.ts';

/** A copy of `trace` with step `i` changed by `edit`. */
function withStep(trace: Trace, i: number, edit: (s: Step) => void): Trace {
  const copy = structuredClone(trace);
  edit(copy.steps[i]);
  return copy;
}
const messages = (t: Trace) => validateTrace(t).map((x) => x.message);

describe('Phase 37 payload validation', () => {
  it('accepts the generated traces', () => {
    for (const t of [bubbleSortTrace, growthTrace, samplingTrace, hypothesisOneTailedTrace]) {
      expect(validateTrace(t)).toEqual([]);
    }
  });

  it('requires the payload matching the view', () => {
    const t = withStep(bubbleSortTrace, 2, (s) => delete s.bars);
    expect(messages(t)).toContain("view 'bars' step is missing its `bars` payload");
  });

  it('bars: indices, keys, range, pointers and counters', () => {
    const t = withStep(bubbleSortTrace, 3, (s) => {
      const b = s.bars!;
      b.compared = [8];
      b.keys = b.keys!.slice(1);
      b.range = { from: 5, to: 2 };
      b.pointers = [{ label: 'j', index: 9 }];
      b.counters.comparisons = 0;
    });
    const m = messages(t);
    expect(m).toContain('bars: compared index 8 is outside 0..7');
    expect(m).toContain('bars: keys must be unique and one per value');
    expect(m).toContain('bars: range 5..2 is not inside the array');
    expect(m).toContain('bars: pointer j at 9 is outside -1..8');
    expect(m.some((x) => x.startsWith('bars: counter comparisons went down'))).toBe(true);
  });

  it('bars: a pointer just past either end is allowed (binary search, not found)', () => {
    const t = withStep(bubbleSortTrace, 3, (s) => {
      s.bars!.pointers = [
        { label: 'high', index: -1 },
        { label: 'low', index: 8 },
      ];
    });
    expect(validateTrace(t)).toEqual([]);
  });

  it('growth: n among the ns, one count per n, compared curves exist', () => {
    const t = withStep(growthTrace, 2, (s) => {
      const g = structuredClone(s.growth!);
      g.n = 3.5;
      g.curves[0].counts = g.curves[0].counts.slice(1);
      g.compare = ['n', 'n3'];
      s.growth = g;
    });
    const m = messages(t);
    expect(m).toContain('growth: n = 3.5 is not one of the ns');
    expect(m).toContain('growth: curve 1 needs one count per n');
    expect(m).toContain('growth: compared curve n3 does not exist');
  });

  it('distribution: bins add up to draws, contiguous; a sampling step needs its population', () => {
    const t = withStep(samplingTrace, 4, (s) => {
      const d = s.distribution!;
      d.bins[0].count += 1;
      d.bins[2].from += 0.01;
      delete d.population;
    });
    const m = messages(t);
    expect(m.some((x) => x.startsWith('distribution: bin counts add up to'))).toBe(true);
    expect(m).toContain('distribution bin 2 does not start where bin 1 ends');
    expect(m).toContain('distribution: sampling mode needs a population');
  });

  it('distribution: the p-value must be extreme / draws', () => {
    const t = withStep(hypothesisOneTailedTrace, 5, (s) => {
      s.distribution!.test!.pValue = 0.5;
    });
    expect(
      messages(t).some((x) => x.startsWith('distribution: pValue 0.5 is not extreme / draws')),
    ).toBe(true);
    const u = withStep(hypothesisOneTailedTrace, 5, (s) => {
      s.distribution!.test!.extreme = s.distribution!.draws + 1;
    });
    expect(messages(u).some((x) => x.includes('is not in 0..draws'))).toBe(true);
  });
});
