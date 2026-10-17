/**
 * Statistics generators for the `distribution` concept view (Phase 37).
 *
 * - **Sampling distribution:** a right-skewed population of wait times; each step draws more
 *   samples of a fixed size and adds their means to a histogram, which approaches the normal curve
 *   the central limit theorem predicts.
 * - **Hypothesis test (permutation test):** two groups of plants; under the null hypothesis the
 *   group labels don't matter, so each shuffle of the labels gives one difference in means. The
 *   histogram of shuffled differences is the null distribution; the p-value is the share of
 *   shuffles at least as extreme as the observed difference, counted exactly.
 *
 * Both are seeded, so the same seed always gives the same trace. Exact arithmetic where it matters:
 * the test works in whole tenths of a centimetre, so "at least as extreme" never depends on
 * floating-point rounding.
 *
 * @packageDocumentation
 */
import type { DistributionBin, DistributionStep, Step } from '../trace/types.ts';
import { seeded, shuffled, type Rng } from './random.ts';
import { binIndex, count, describe, emptyBins, fixed, mean, round } from './stats.ts';
import { conceptStep } from './trace.ts';

/** Add `xs` to a copy of `bins`. */
function addAll(
  bins: DistributionBin[],
  xs: readonly number[],
  index = (x: number) => binIndex(bins, x),
) {
  const out = bins.map((b) => ({ ...b }));
  for (const x of xs) out[index(x)].count++;
  return out;
}

/** Summary statistics are shown from this many draws on (fewer make the skewness meaningless). */
export const MIN_STATS = 10;

const binText = (b: DistributionBin, d: number) => `${fixed(b.from, d)}–${fixed(b.to, d)}`;

/* ───────────────────────────── Sampling distribution ───────────────────────────── */

/** The raw draws behind a sampling-distribution trace (exported for tests). */
export interface SamplingRun {
  population: number[];
  /** `samples[i]` holds `sampleSize` values drawn (with replacement) from the population. */
  samples: number[][];
  means: number[];
}

/** A right-skewed population: exponential wait times (mean ≈ `scale`), to 0.1 minute. */
export function skewedPopulation(rng: Rng, size: number, scale: number): number[] {
  return Array.from({ length: size }, () => round(-scale * Math.log(1 - rng()), 1));
}

export function samplingRun(
  seed: number,
  size: number,
  sampleSize: number,
  draws: number,
): SamplingRun {
  const rng = seeded(seed);
  const population = skewedPopulation(rng, size, 4);
  const samples = Array.from({ length: draws }, () =>
    Array.from({ length: sampleSize }, () => population[Math.floor(rng() * population.length)]),
  );
  return { population, samples, means: samples.map(mean) };
}

const SAMPLING_CONCEPT =
  'The central limit theorem: the means of many samples of size n pile up in a bell shape — a ' +
  'normal distribution with the population mean and standard deviation σ/√n — even when the ' +
  'population itself is skewed. Larger samples give a narrower, more normal bell.';

/**
 * The sampling-distribution steps.
 *
 * @param schedule - Cumulative sample counts per step after the first (the population alone),
 *   ascending; steps with at most 5 new samples mark them one by one.
 */
export function samplingSteps(
  seed: number,
  populationSize: number,
  sampleSize: number,
  schedule: readonly number[],
): { steps: Step[]; run: SamplingRun } {
  const total = schedule[schedule.length - 1];
  const run = samplingRun(seed, populationSize, sampleSize, total);
  const pop = describe(run.population);
  const se = pop.sd / Math.sqrt(sampleSize);

  // One-minute bins from 0 past the longest wait (every value is inside its bin's [from, to)).
  const popTop = Math.floor(Math.max(...run.population)) + 1;
  const population = {
    xLabel: 'wait time (minutes)',
    bins: addAll(emptyBins(0, popTop, popTop), run.population),
    size: run.population.length,
    mean: pop.mean,
    sd: pop.sd,
    skewness: pop.skewness,
  };
  // Means' bins: 0.25 wide, covering at least 3.5 standard errors either side and every mean.
  const w = 0.25;
  const lo = Math.floor(Math.min(pop.mean - 3.5 * se, ...run.means) / w) * w;
  const hi = (Math.floor(Math.max(pop.mean + 3.5 * se, ...run.means) / w) + 1) * w;
  let bins = emptyBins(lo, hi, Math.round((hi - lo) / w));
  const normal = { mean: pop.mean, sd: se };
  const steps: Step[] = [];
  const base = { mode: 'sampling' as const, xLabel: 'sample mean (minutes)', sampleSize };

  steps.push(
    conceptStep(
      0,
      {
        did: [
          `The population: ${count(population.size)} wait times, in minutes. It is skewed to the right: most waits are short and a few are long.`,
          `Population mean ${fixed(pop.mean, 2)}, standard deviation ${fixed(pop.sd, 2)}, skewness ${fixed(pop.skewness, 2)}.`,
          `Each step draws samples of ${sampleSize} waits and adds each sample's mean to the histogram.`,
        ],
        concept: SAMPLING_CONCEPT,
      },
      { distribution: { ...base, bins, draws: 0, population } },
    ),
  );

  let done = 0;
  let curveShown = false;
  schedule.forEach((upTo, s) => {
    const added = run.means.slice(done, upTo);
    bins = addAll(bins, added);
    const draws = upTo;
    const so = run.means.slice(0, draws);
    const stats = draws >= MIN_STATS ? describe(so) : undefined;
    const one = added.length === 1;
    const did: string[] = [];
    const changed: string[] = [`Sample means: ${count(done)} → ${count(draws)}.`];
    if (one) {
      const m = added[0];
      did.push(
        `Drew sample ${draws}: ${sampleSize} waits, marked on the population.`,
        `Its mean is ${fixed(m, 2)}, so it goes in the ${binText(bins[binIndex(bins, m)], 2)} bin.`,
        `Sample means so far: ${draws}.`,
      );
      changed.push(
        `The ${binText(bins[binIndex(bins, m)], 2)} bin: ${bins[binIndex(bins, m)].count - 1} → ${bins[binIndex(bins, m)].count}.`,
      );
    } else {
      did.push(
        `Drew ${count(added.length)} more samples of ${sampleSize} (${count(draws)} so far).`,
      );
    }
    if (stats) {
      did.push(
        `The sample means so far have mean ${fixed(stats.mean, 2)}, standard deviation ${fixed(stats.sd, 2)} and skewness ${fixed(stats.skewness, 2)}.`,
      );
    }
    const showCurve = draws >= 10;
    if (showCurve && !curveShown) {
      did.push(
        `The dashed curve is the normal distribution the central limit theorem predicts: mean ${fixed(pop.mean, 2)}, standard deviation σ/√${sampleSize} = ${fixed(pop.sd, 2)}/${fixed(Math.sqrt(sampleSize), 2)} = ${fixed(se, 2)}.`,
      );
      curveShown = true;
    }
    const last = s === schedule.length - 1;
    if (last && stats) {
      did.push(
        `After ${count(draws)} samples the histogram follows the bell-shaped curve, although the population is strongly skewed: skewness ${fixed(stats.skewness, 2)} for the means against ${fixed(pop.skewness, 2)} for the population.`,
      );
    }
    const step: DistributionStep = {
      ...base,
      bins,
      draws,
      ...(added.length <= 5 ? { latest: added } : {}),
      ...(stats ? { stats } : {}),
      population: { ...population, ...(one ? { sample: run.samples[draws - 1] } : {}) },
      ...(showCurve ? { normal } : {}),
    };
    steps.push(
      conceptStep(
        s + 1,
        { did, changed, concept: last ? SAMPLING_CONCEPT : undefined },
        { distribution: step },
      ),
    );
    done = upTo;
  });
  return { steps, run };
}

/* ───────────────────────────── Hypothesis test ───────────────────────────── */

/** The data of a permutation test, in whole tenths of a centimetre. */
export interface TestData {
  /** Group labels, e.g. `["fertilizer", "control"]`. */
  labels: [string, string];
  a: number[];
  b: number[];
}

/**
 * The difference in means `mean(a) − mean(b)` in **units**: `sum(a) − sum(b)` when both groups have
 * the same size `k`, which is `k` × 10 times the difference in centimetres. Whole numbers, so ties
 * compare exactly.
 */
const units = (a: readonly number[], b: readonly number[]) =>
  a.reduce((s, x) => s + x, 0) - b.reduce((s, x) => s + x, 0);

/** The raw shuffles behind a hypothesis-test trace (exported for tests). */
export interface TestRun {
  /** The observed difference, in units. */
  observed: number;
  /** One difference per shuffle, in units. */
  shuffles: number[];
  /** Units per centimetre: group size × 10. */
  scale: number;
}

export function testRun(data: TestData, seed: number, shuffles: number): TestRun {
  if (data.a.length !== data.b.length)
    throw new Error('permutation test: groups must be the same size');
  const rng = seeded(seed);
  const all = [...data.a, ...data.b];
  const k = data.a.length;
  return {
    observed: units(data.a, data.b),
    shuffles: Array.from({ length: shuffles }, () => {
      const s = shuffled(rng, all);
      return units(s.slice(0, k), s.slice(k));
    }),
    scale: k * 10,
  };
}

/** Whether a shuffled difference is at least as extreme as the observed one (exact, in units). */
export function isExtreme(d: number, observed: number, tail: 'left' | 'right' | 'two'): boolean {
  if (tail === 'right') return d >= observed;
  if (tail === 'left') return d <= observed;
  return Math.abs(d) >= Math.abs(observed);
}

const TEST_CONCEPT =
  'The p-value is the share of results, simulated as if the null hypothesis were true, that are at ' +
  'least as extreme as the observed result. A small p-value means the observed result would be ' +
  'rare if the null hypothesis were true.';

/**
 * The hypothesis-test steps.
 *
 * @param schedule - Cumulative shuffle counts per step after the first (the data alone).
 * @param binsToObserved - How many bins fit between 0 and the observed difference; bins are closed
 *   on their outer side, so the shaded bins hold exactly the extreme shuffles.
 */
export function testSteps(
  data: TestData,
  tail: 'right' | 'two',
  seed: number,
  schedule: readonly number[],
  binsToObserved: number,
  alpha = 0.05,
): { steps: Step[]; run: TestRun } {
  const total = schedule[schedule.length - 1];
  const run = testRun(data, seed, total);
  const { observed: D, scale } = run;
  const cm = (u: number) => u / scale;
  // Bin k holds [k·W, (k+1)·W) for positive values and (k·W, (k+1)·W] for negative ones (the
  // outer side is closed), with W = |D| / binsToObserved, so ±D sit on bin edges.
  const K = binsToObserved;
  const D0 = Math.abs(D);
  const kOf = (u: number) => (u >= 0 ? Math.floor((u * K) / D0) : Math.ceil((u * K) / D0) - 1);
  const reach = Math.max(D0, ...run.shuffles.map(Math.abs));
  const L = Math.floor((reach * K) / D0) + 1;
  const binsBase: DistributionBin[] = Array.from({ length: 2 * L }, (_, i) => ({
    from: round(cm(((i - L) * D0) / K), 6),
    to: round(cm(((i - L + 1) * D0) / K), 6),
    count: 0,
  }));
  const index = (u: number) => kOf(u) + L;

  const mA = mean(data.a) / 10;
  const mB = mean(data.b) / 10;
  const obs = fixed(cm(D), 2);
  const [la, lb] = data.labels;
  const groups = [
    { label: la, values: data.a.map((x) => x / 10), mean: mA },
    { label: lb, values: data.b.map((x) => x / 10), mean: mB },
  ];
  const extremeWords =
    tail === 'right'
      ? `a difference of at least ${obs} cm`
      : `a difference at least ${obs} cm away from 0, in either direction`;
  const n = data.a.length + data.b.length;
  const test = (extreme: number, draws: number) => ({
    observed: cm(D),
    tail,
    center: 0,
    extreme,
    pValue: draws === 0 ? 0 : extreme / draws,
    alpha,
  });
  const base = {
    mode: 'hypothesis' as const,
    xLabel: `difference in means, ${la} − ${lb} (cm)`,
    groups,
  };
  const steps: Step[] = [
    conceptStep(
      0,
      {
        did: [
          `Plants with ${la} grew ${fixed(mA, 2)} cm on average; ${lb} plants grew ${fixed(mB, 2)} cm. The observed difference in means is ${obs} cm.`,
          `Null hypothesis: the ${la} makes no difference. Then the group labels don't matter, and shuffling them shows how big a difference chance alone makes.`,
          `${tail === 'right' ? 'One-tailed' : 'Two-tailed'} test: a shuffle counts as at least as extreme when it gives ${extremeWords}.`,
        ],
        concept: TEST_CONCEPT,
      },
      { distribution: { ...base, bins: binsBase, draws: 0, test: test(0, 0) } },
    ),
  ];

  let bins = binsBase;
  let done = 0;
  let extreme = 0;
  schedule.forEach((upTo, s) => {
    const added = run.shuffles.slice(done, upTo);
    bins = addAll(bins, added, index);
    const before = extreme;
    extreme += added.filter((d) => isExtreme(d, D, tail)).length;
    const draws = upTo;
    const p = extreme / draws;
    const did: string[] = [];
    const changed = [`Shuffles: ${count(done)} → ${count(draws)}.`];
    if (extreme !== before)
      changed.push(`At least as extreme: ${count(before)} → ${count(extreme)}.`);
    if (added.length === 1) {
      const d = added[0];
      did.push(
        `Shuffle ${draws}: mixed all ${n} plants and dealt them into two new groups of ${data.a.length}.`,
        `Difference in means: ${fixed(cm(d), 2)} cm. ${isExtreme(d, D, tail) ? 'That is' : 'That is not'} at least as extreme as the observed ${obs} cm.`,
      );
    } else {
      did.push(`Ran ${count(added.length)} more shuffles (${count(draws)} so far).`);
    }
    did.push(
      `${count(extreme)} of ${count(draws)} shuffles are at least as extreme: ${count(extreme)} / ${count(draws)} = ${fixed(p, 3)}.`,
    );
    const last = s === schedule.length - 1;
    if (last) {
      did.push(
        `p-value = ${fixed(p, 3)}. ` +
          (p < alpha
            ? `That is below ${alpha}: a difference this large would be rare if the ${la} did nothing, so the data are evidence against the null hypothesis.`
            : `That is not below ${alpha}: chance alone often gives a difference this large, so the data are not strong evidence against the null hypothesis.`),
      );
    }
    const stats = draws >= MIN_STATS ? describe(run.shuffles.slice(0, draws).map(cm)) : undefined;
    const step: DistributionStep = {
      ...base,
      bins,
      draws,
      ...(added.length <= 5 ? { latest: added.map(cm) } : {}),
      ...(stats ? { stats } : {}),
      test: test(extreme, draws),
    };
    steps.push(
      conceptStep(
        s + 1,
        { did, changed, concept: last ? TEST_CONCEPT : undefined },
        { distribution: step },
      ),
    );
    done = upTo;
  });
  return { steps, run };
}
