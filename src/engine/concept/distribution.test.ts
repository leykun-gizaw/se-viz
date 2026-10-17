/**
 * The statistics generators (Phase 37).
 *
 * - **p-values** are checked three ways: against an independent count over the generator's own
 *   shuffles, against the exact permutation p-value (all C(20, 10) splits, enumerated here) within
 *   Monte Carlo error, and against a normal approximation computed separately from the shuffles.
 * - **"Approaches a bell shape"**: the skewness of sample means shrinks toward 0 as the sample size
 *   grows (≈ population skewness / √n), the 1,000 means are far less skewed than the population,
 *   and the histogram's distance from the predicted normal curve shrinks as samples accumulate.
 */
import { describe, expect, it } from 'vitest';
import {
  PLANTS,
  TEST_BINS,
  TEST_SCHEDULE,
  TEST_SEED,
} from '../../content/fixtures/conceptHypothesisTest.ts';
import { SAMPLING_ARGS, SAMPLING_SCHEDULE } from '../../content/fixtures/conceptSampling.ts';
import type { DistributionStep, Step } from '../trace/types.ts';
import { samplingRun, samplingSteps, testRun, testSteps } from './distribution.ts';
import { describe as stats, fixed, mean } from './stats.ts';

const dist = (s: Step) => s.distribution!;
const lastOf = (steps: Step[]) => dist(steps[steps.length - 1]);

/** Standard normal CDF (Abramowitz and Stegun 7.1.26 via erf), written here independently. */
function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Exact permutation p-values: every way to choose the first group. */
function exactPermutation(a: number[], b: number[]): { right: number; two: number } {
  const all = [...a, ...b];
  const total = all.reduce((s, x) => s + x, 0);
  const obs = 2 * a.reduce((s, x) => s + x, 0) - total;
  let right = 0;
  let two = 0;
  let count = 0;
  const pick = (start: number, left: number, sum: number) => {
    if (left === 0) {
      const d = 2 * sum - total;
      count++;
      if (d >= obs) right++;
      if (Math.abs(d) >= Math.abs(obs)) two++;
      return;
    }
    for (let i = start; i <= all.length - left; i++) pick(i + 1, left - 1, sum + all[i]);
  };
  pick(0, a.length, 0);
  return { right: right / count, two: two / count };
}

describe('hypothesis test (permutation)', () => {
  const run = testRun(PLANTS, TEST_SEED, TEST_SCHEDULE[TEST_SCHEDULE.length - 1]);
  const exact = exactPermutation(PLANTS.a, PLANTS.b);

  for (const tail of ['right', 'two'] as const) {
    describe(`${tail === 'right' ? 'one' : 'two'}-tailed`, () => {
      const { steps } = testSteps(PLANTS, tail, TEST_SEED, TEST_SCHEDULE, TEST_BINS);
      // Independent direct count, in centimetres (rounded to the data's precision).
      const obsCm = Math.round(mean(PLANTS.a) - mean(PLANTS.b)) / 10;
      const extremeAt = (k: number) =>
        run.shuffles
          .slice(0, k)
          .map((u) => Math.round((u / run.scale) * 1000) / 1000)
          .filter((d) => (tail === 'right' ? d >= obsCm - 1e-9 : Math.abs(d) >= obsCm - 1e-9))
          .length;

      it('the p-value at every step equals a direct count over the shuffles drawn so far', () => {
        expect(obsCm).toBe(1.3);
        for (const s of steps.slice(1)) {
          const d = dist(s);
          expect(d.test!.extreme).toBe(extremeAt(d.draws));
          expect(d.test!.pValue).toBe(extremeAt(d.draws) / d.draws);
          // The text quotes the same p-value, rounded to 3 places.
          expect(s.narration).toContain(`= ${fixed(extremeAt(d.draws) / d.draws, 3)}.`);
        }
      });

      it('the final p-value is within Monte Carlo error of the exact permutation p-value', () => {
        const p = lastOf(steps).test!.pValue;
        const truth = tail === 'right' ? exact.right : exact.two;
        const se = Math.sqrt((truth * (1 - truth)) / run.shuffles.length);
        expect(Math.abs(p - truth)).toBeLessThan(3 * se);
        // The numbers this module shows (documented in the Phase 37 report).
        expect({ p, truth: Number(truth.toFixed(4)) }).toEqual(
          tail === 'right' ? { p: 0.012, truth: 0.0144 } : { p: 0.026, truth: 0.0288 },
        );
      });

      it('agrees with a normal approximation of the shuffled differences', () => {
        const xs = run.shuffles.map((u) => u / run.scale);
        const { mean: m, sd } = stats(xs);
        const z = (obsCm - m) / sd;
        const pNormal = tail === 'right' ? 1 - phi(z) : 2 * (1 - phi(Math.abs(z)));
        expect(Math.abs(lastOf(steps).test!.pValue - pNormal)).toBeLessThan(0.01);
      });

      it('the shaded bins hold exactly the extreme shuffles', () => {
        for (const s of steps) {
          const d = dist(s);
          const t = d.test!;
          const shaded = d.bins
            .filter((b) =>
              tail === 'right'
                ? b.from >= t.observed - 1e-9
                : b.from >= t.observed - 1e-9 || b.to <= -t.observed + 1e-9,
            )
            .reduce((n, b) => n + b.count, 0);
          expect(shaded).toBe(t.extreme);
          expect(d.bins.reduce((n, b) => n + b.count, 0)).toBe(d.draws);
        }
      });

      it('is deterministic for a seed', () => {
        expect(testSteps(PLANTS, tail, TEST_SEED, TEST_SCHEDULE, TEST_BINS).steps).toEqual(steps);
        expect(testRun(PLANTS, TEST_SEED + 1, 50).shuffles).not.toEqual(run.shuffles.slice(0, 50));
      });
    });
  }

  it('one- and two-tailed tests see the same shuffles; the two-tailed p is the larger', () => {
    const one = testSteps(PLANTS, 'right', TEST_SEED, TEST_SCHEDULE, TEST_BINS).steps;
    const two = testSteps(PLANTS, 'two', TEST_SEED, TEST_SCHEDULE, TEST_BINS).steps;
    one.forEach((s, i) => expect(dist(s).bins).toEqual(dist(two[i]).bins));
    expect(lastOf(two).test!.pValue).toBeGreaterThanOrEqual(lastOf(one).test!.pValue);
  });

  it('counts ties at the observed value as extreme (exact whole-number comparison)', () => {
    // a and b are mirror images, so some shuffles reproduce the observed split exactly.
    const tiny = { labels: ['x', 'y'] as [string, string], a: [12, 11], b: [10, 9] };
    const r = testRun(tiny, 1, 200);
    const ties = r.shuffles.filter((u) => u === r.observed).length;
    expect(ties).toBeGreaterThan(0);
    const { steps } = testSteps(tiny, 'right', 1, [200], 2);
    expect(lastOf(steps).test!.extreme).toBe(r.shuffles.filter((u) => u >= r.observed).length);
  });
});

/** Largest gap between the empirical CDF of `xs` and a normal CDF. */
function ksDistance(xs: number[], m: number, sd: number): number {
  const s = [...xs].sort((a, b) => a - b);
  let worst = 0;
  s.forEach((x, i) => {
    const f = phi((x - m) / sd);
    worst = Math.max(worst, Math.abs((i + 1) / s.length - f), Math.abs(i / s.length - f));
  });
  return worst;
}

describe('sampling distribution', () => {
  const [seed, size, n] = SAMPLING_ARGS;
  const { steps, run } = samplingSteps(seed, size, n, SAMPLING_SCHEDULE);
  const pop = stats(run.population);

  it('the population is strongly right-skewed', () => {
    expect(pop.skewness).toBeGreaterThan(1.5);
  });

  it('skewness of the sample means shrinks toward 0 as the sample size grows (≈ skew / √n)', () => {
    const skews = [1, 2, 5, 10, 30, 60].map(
      (k) => stats(samplingRun(seed, size, k, 4000).means).skewness,
    );
    for (let i = 1; i < skews.length; i++) expect(skews[i]).toBeLessThan(skews[i - 1]);
    expect(skews[skews.length - 1]).toBeLessThan(0.4);
    [1, 2, 5, 10, 30, 60].forEach((k, i) =>
      expect(Math.abs(skews[i] - pop.skewness / Math.sqrt(k))).toBeLessThan(0.25),
    );
  });

  it('the module ends close to the bell: low skewness, and the KS distance to the predicted normal shrinks', () => {
    const end = lastOf(steps);
    expect(Math.abs(end.stats!.skewness)).toBeLessThan(pop.skewness / 4);
    const se = pop.sd / Math.sqrt(n);
    const ks = (k: number) => ksDistance(run.means.slice(0, k), pop.mean, se);
    expect(ks(1000)).toBeLessThan(ks(100));
    expect(ks(100)).toBeLessThan(ks(10));
    expect(ks(1000)).toBeLessThan(0.05);
    // The overlaid curve is that normal.
    expect(end.normal).toEqual({ mean: pop.mean, sd: se });
    // The histogram's standard deviation matches σ/√n.
    expect(Math.abs(end.stats!.sd - se) / se).toBeLessThan(0.1);
  });

  it('every step: bins hold exactly the means drawn so far; the text quotes the state', () => {
    let previous: DistributionStep | null = null;
    for (const s of steps) {
      const d = dist(s);
      expect(d.bins.reduce((k, b) => k + b.count, 0)).toBe(d.draws);
      const means = run.means.slice(0, d.draws);
      for (const b of d.bins) {
        // [from, to), with a value on an edge (to float rounding) counted in the bin it starts.
        expect(b.count).toBe(means.filter((m) => m >= b.from - 1e-9 && m < b.to - 1e-9).length);
      }
      if (d.stats) {
        expect(s.narration).toContain(
          `mean ${fixed(d.stats.mean, 2)}, standard deviation ${fixed(d.stats.sd, 2)}`,
        );
        expect(d.stats).toEqual(stats(means));
      }
      const one = /Its mean is ([\d.]+), so it goes in the ([\d.]+)–([\d.]+) bin/.exec(s.narration);
      if (one) {
        const m = d.latest![0];
        expect(fixed(m, 2)).toBe(one[1]);
        expect(m).toBeGreaterThanOrEqual(Number(one[2]) - 1e-9);
        expect(m).toBeLessThan(Number(one[3]) - 1e-9);
        expect(mean(d.population!.sample!)).toBe(m);
      }
      if (previous) expect(d.draws).toBeGreaterThan(previous.draws);
      previous = d;
    }
    expect(steps[0].narration).toContain(`skewness ${fixed(pop.skewness, 2)}`);
  });

  it('is deterministic for a seed', () => {
    expect(samplingSteps(seed, size, n, SAMPLING_SCHEDULE).steps).toEqual(steps);
  });
});
