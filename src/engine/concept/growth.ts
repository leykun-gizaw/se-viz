/**
 * The Big O generator for the `growth` concept view (Phase 37). Five curves — 1, log₂ n, n,
 * n·log₂ n and n² — share one pair of axes. Each step doubles n, moves a marker along every curve
 * and says how each count changed, and the caption compares two curves at the current n.
 *
 * The counts are the functions themselves (an "operation" is one unit of the function), so at the
 * powers of two the steps visit every count is a whole number.
 *
 * @packageDocumentation
 */
import type { GrowthCurve, GrowthStep, Step } from '../trace/types.ts';
import { count } from './stats.ts';
import { conceptStep } from './trace.ts';

const CURVES: { id: string; label: string; f: (n: number) => number }[] = [
  { id: '1', label: 'O(1)', f: () => 1 },
  { id: 'log', label: 'O(log n)', f: (n) => Math.log2(n) },
  { id: 'n', label: 'O(n)', f: (n) => n },
  { id: 'nlog', label: 'O(n log n)', f: (n) => n * Math.log2(n) },
  { id: 'n2', label: 'O(n²)', f: (n) => n * n },
];

const CONCEPT =
  'Big O describes how the work grows as the input size n grows, ignoring constant factors. ' +
  'Here each curve counts exactly 1, log₂ n, n, n·log₂ n or n² operations.';

/** How a count changed when n doubled, in words. */
function doubling(label: string, a: number, b: number): string {
  if (a === b) return `${label} stays at ${count(b)}.`;
  if (b === 2 * a) return `${label} doubles, from ${count(a)} to ${count(b)}.`;
  if (b === 4 * a) return `${label} goes up 4 times, from ${count(a)} to ${count(b)}.`;
  if (b === a + 1) return `${label} goes up by just 1, from ${count(a)} to ${count(b)}.`;
  return `${label} goes from ${count(a)} to ${count(b)}.`;
}

/** The caption: two curves compared at n. */
function compare(a: GrowthCurve, b: GrowthCurve, k: number, n: number): string {
  const x = a.counts[k];
  const y = b.counts[k];
  const ratio = x / y;
  const times =
    x === y
      ? 'the same amount'
      : Number.isInteger(ratio)
        ? `${count(ratio)} times as many`
        : `${ratio.toFixed(1)} times as many`;
  return `At n = ${count(n)}, ${a.label} does ${count(x)} operation${x === 1 ? '' : 's'} and ${b.label} does ${count(y)}: ${times}.`;
}

/**
 * The growth trace's steps.
 *
 * @param stepsN - The n of each step, ascending powers of two (each step doubles n).
 * @param pairs - The curve ids the caption compares at each step (same length as `stepsN`).
 * @param yMax - The top of the y axis.
 */
export function growthSteps(
  stepsN: readonly number[],
  pairs: readonly [string, string][],
  yMax: number,
): Step[] {
  const top = stepsN[stepsN.length - 1];
  const ns = Array.from({ length: top }, (_, i) => i + 1);
  const curves: GrowthCurve[] = CURVES.map((c) => ({
    id: c.id,
    label: c.label,
    counts: ns.map(c.f),
  }));
  const byId = new Map(curves.map((c) => [c.id, c]));
  const steps: Step[] = [];
  let offTop = new Set<string>();

  stepsN.forEach((n, i) => {
    const k = n - 1;
    const pair = pairs[i];
    const caption = compare(byId.get(pair[0])!, byId.get(pair[1])!, k, n);
    const growth: GrowthStep = { ns, curves, n, yMax, compare: [pair[0], pair[1]], caption };
    const did: string[] = [];
    let changed: string[] | undefined;
    if (i === 0) {
      did.push(
        `Start at n = ${count(n)}: ${curves.map((c) => `${c.label} does ${count(c.counts[k])}`).join(', ')}.`,
        'Each step doubles n, so you can see how each kind of growth responds.',
      );
    } else {
      const was = stepsN[i - 1];
      did.push(`n doubled, from ${count(was)} to ${count(n)}.`);
      changed = [`n: ${count(was)} → ${count(n)}.`];
      for (const c of curves) {
        did.push(doubling(c.label, c.counts[was - 1], c.counts[k]));
        if (c.counts[was - 1] !== c.counts[k]) {
          changed.push(`${c.label}: ${count(c.counts[was - 1])} → ${count(c.counts[k])}.`);
        }
      }
    }
    did.push(caption);
    const over = curves.filter((c) => c.counts[k] > yMax);
    const fresh = over.filter((c) => !offTop.has(c.id));
    if (fresh.length > 0) {
      did.push(
        `${fresh.map((c) => c.label).join(' and ')} ${fresh.length === 1 ? 'is' : 'are'} now off the top of the chart (above ${count(yMax)}); the table shows the count.`,
      );
    }
    offTop = new Set(over.map((c) => c.id));
    steps.push(
      conceptStep(
        i,
        { did, changed, concept: i === 0 || i === stepsN.length - 1 ? CONCEPT : undefined },
        { growth },
      ),
    );
  });
  return steps;
}
