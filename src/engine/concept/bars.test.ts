/**
 * The search and sort generators (Phase 37): deterministic for a seed, correct results, counters
 * that match an independent count, and explanation text that matches the state at every step.
 */
import { describe, expect, it } from 'vitest';
import type { Step } from '../trace/types.ts';
import { validateTrace } from '../trace/validate.ts';
import {
  binarySearchSteps,
  bubbleSortSteps,
  insertionSortSteps,
  linearSearchSteps,
  mergeSortSteps,
  selectionSortSteps,
} from './bars.ts';
import { distinctInts, randInt, seeded } from './random.ts';
import { conceptModule } from './trace.ts';

const SORTS = {
  bubble: bubbleSortSteps,
  selection: selectionSortSteps,
  insertion: insertionSortSteps,
  merge: mergeSortSteps,
};

const last = (steps: Step[]) => steps[steps.length - 1].bars!;
const sortedCopy = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);
/** Arrays to try: distinct values, duplicates, sorted, reversed, tiny. */
function inputs(): number[][] {
  const out: number[][] = [[], [5], [2, 1], [1, 2, 3, 4], [4, 3, 2, 1], [3, 3, 1, 3, 2, 2]];
  for (let seed = 1; seed <= 40; seed++) {
    const rng = seeded(seed);
    const n = randInt(rng, 2, 10);
    out.push(
      seed % 2 ? distinctInts(rng, n, 1, 30) : Array.from({ length: n }, () => randInt(rng, 1, 6)),
    );
  }
  return out.filter((xs) => xs.length > 0);
}

/** Inversions: pairs i < j with a[i] > a[j] (bubble and insertion sort make exactly this many swaps). */
function inversions(xs: readonly number[]): number {
  let n = 0;
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++) if (xs[i] > xs[j]) n++;
  return n;
}

/** An independent top-down merge sort that counts comparisons (left ≤ right takes the left). */
function mergeComparisons(xs: readonly number[]): number {
  let count = 0;
  const sort = (a: number[]): number[] => {
    if (a.length <= 1) return a;
    const mid = Math.floor((a.length - 1) / 2) + 1;
    const l = sort(a.slice(0, mid));
    const r = sort(a.slice(mid));
    const out: number[] = [];
    while (l.length && r.length) {
      count++;
      out.push(l[0] <= r[0] ? l.shift()! : r.shift()!);
    }
    return [...out, ...l, ...r];
  };
  sort([...xs]);
  return count;
}

/** Selection sort's swaps, counted independently (a swap only when the minimum isn't in place). */
function selectionSwaps(xs: readonly number[]): number {
  const a = [...xs];
  let swaps = 0;
  for (let i = 0; i < a.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j;
    if (m !== i) {
      [a[i], a[m]] = [a[m], a[i]];
      swaps++;
    }
  }
  return swaps;
}

/** Numbers after a phrase, e.g. `Swaps so far: 4.` → 4. */
const after = (text: string, phrase: string) => {
  const m = new RegExp(`${phrase} (\\d+)`).exec(text);
  return m ? Number(m[1]) : undefined;
};

/** Every sentence that quotes a value or a count agrees with the step's state. */
function checkText(steps: Step[]): void {
  steps.forEach((step, i) => {
    const b = step.bars!;
    const text = (step.explain?.did ?? []).join(' ');
    expect(step.narration, `step ${i}`).toBe(text.replace(/`/g, ''));
    const c = after(text, 'Comparisons so far:');
    if (c !== undefined) expect(c, `step ${i}: ${text}`).toBe(b.counters.comparisons);
    const s = after(text, 'Swaps so far:');
    if (s !== undefined) expect(s, `step ${i}: ${text}`).toBe(b.counters.swaps);
    const w = after(text, 'Writes so far:');
    if (w !== undefined) expect(w, `step ${i}: ${text}`).toBe(b.counters.writes);
    // "Compared x and y": the two values the step looked at, read from the previous array.
    const cmp = /Compared (\d+)(?: \(index (\d+)\))? (?:and|with the smallest so far,) (\d+)/.exec(
      text,
    );
    if (cmp && i > 0) {
      const prev = steps[i - 1].bars!.values;
      const looked = [...(b.compared ?? []), ...(b.swapped ?? [])];
      const before = new Set([...looked.map((k) => prev[k]), ...looked.map((k) => b.values[k])]);
      expect(before.has(Number(cmp[1])), `step ${i}: ${text}`).toBe(true);
      expect(before.has(Number(cmp[3])), `step ${i}: ${text}`).toBe(true);
    }
    // Binary search: the pointers the text names.
    const lh = /`low` = (\d+) and `high` = (\d+), so `mid` = \(\d+ \+ \d+\) \/\/ 2 = (\d+)/.exec(
      text,
    );
    if (lh) {
      const p = new Map(b.pointers!.map((x) => [x.label, x.index]));
      expect([p.get('low'), p.get('high'), p.get('mid')]).toEqual(lh.slice(1).map(Number));
      expect(Number(lh[3])).toBe(Math.floor((Number(lh[1]) + Number(lh[2])) / 2));
      const v = /Compared (\d+) with (\d+), the value at index (\d+)/.exec(text)!;
      expect(b.values[Number(v[3])]).toBe(Number(v[2]));
      expect(Number(v[1])).toBe(b.target);
    }
    const checked = /Checked index (\d+): (\d+) is/.exec(text);
    if (checked) expect(b.values[Number(checked[1])]).toBe(Number(checked[2]));
    const sortedList = /Sorted: `\[([\d, ]+)\]`/.exec(text);
    if (sortedList) expect(sortedList[1].split(', ').map(Number)).toEqual(b.values);
    const swapped = /Swapped (\d+) into index (\d+)/.exec(text);
    if (swapped) expect(b.values[Number(swapped[2])]).toBe(Number(swapped[1]));
    const into = /(\d+) is smaller, so it goes next, into index (\d+)/.exec(text);
    if (into) expect(b.values[Number(into[2])]).toBe(Number(into[1]));
  });
}

describe('sort generators', () => {
  for (const [name, gen] of Object.entries(SORTS)) {
    describe(name, () => {
      it('sorts every input, keeps the multiset, and the last step marks everything sorted', () => {
        for (const xs of inputs()) {
          const steps = gen(xs);
          expect(last(steps).values).toEqual(sortedCopy(xs));
          expect(last(steps).sorted).toEqual(xs.map((_, i) => i));
          for (const s of steps) expect(sortedCopy(s.bars!.values)).toEqual(sortedCopy(xs));
        }
      });

      it('is deterministic: the same input gives the same steps', () => {
        const xs = distinctInts(seeded(99), 8, 1, 20);
        expect(gen(xs)).toEqual(gen([...xs]));
        expect(distinctInts(seeded(99), 8, 1, 20)).toEqual(xs);
      });

      it('explanation text matches the state at every step, and the trace validates', () => {
        for (const xs of inputs()) {
          const steps = gen(xs);
          checkText(steps);
          const { trace } = conceptModule(
            { id: 't', title: 't', topic: 't', view: 'bars', summary: 's', order: 0 },
            steps,
          );
          expect(validateTrace(trace)).toEqual([]);
        }
      });
    });
  }

  it('bubble and insertion sort make exactly one swap per inversion', () => {
    for (const xs of inputs()) {
      expect(last(bubbleSortSteps(xs)).counters.swaps).toBe(inversions(xs));
      expect(last(insertionSortSteps(xs)).counters.swaps).toBe(inversions(xs));
    }
  });

  it('comparison counts match independent counts', () => {
    for (const xs of inputs()) {
      const n = xs.length;
      // Selection sort always compares n(n-1)/2 times.
      expect(last(selectionSortSteps(xs)).counters.comparisons).toBe((n * (n - 1)) / 2);
      expect(last(selectionSortSteps(xs)).counters.swaps).toBe(selectionSwaps(xs));
      expect(last(mergeSortSteps(xs)).counters.comparisons).toBe(mergeComparisons(xs));
      // Merge sort writes every value once per level it is merged at.
      const writes = last(mergeSortSteps(xs)).counters.writes!;
      expect(writes).toBeGreaterThanOrEqual(n === 1 ? 0 : n);
      // Insertion sort: one comparison per swap, plus one stop per key that didn't reach the front.
      const ins = insertionSortSteps(xs);
      const stops = ins.filter((s) =>
        / is not bigger, so \d+ stays at index/.test(s.narration),
      ).length;
      expect(last(ins).counters.comparisons).toBe(inversions(xs) + stops);
    }
  });

  it('bubble sort stops after a pass with no swaps', () => {
    const steps = bubbleSortSteps([1, 2, 3, 4, 5]);
    expect(last(steps).counters).toEqual({ comparisons: 4, swaps: 0 });
    expect(steps.some((s) => s.narration.includes('made no swaps'))).toBe(true);
  });

  it('merge sort records every node of the split tree, all merged at the end', () => {
    const steps = mergeSortSteps([5, 2, 8, 1, 9, 3, 7]);
    const segs = last(steps).segments!;
    expect(segs).toHaveLength(2 * 7 - 1);
    expect(segs.every((s) => s.state === 'merged')).toBe(true);
    expect(steps[0].bars!.segments!.every((s) => s.state === 'idle')).toBe(true);
  });
});

describe('search generators', () => {
  it('binary search finds every present target, at its index', () => {
    const values = sortedCopy(distinctInts(seeded(5), 12, 1, 60));
    values.forEach((target, index) => {
      const steps = binarySearchSteps(values, target);
      expect(last(steps).found).toBe(index);
      // At most floor(log2 n) + 1 probes.
      expect(last(steps).counters.comparisons).toBeLessThanOrEqual(Math.floor(Math.log2(12)) + 1);
      checkText(steps);
    });
  });

  it('binary search reports absent targets (below, between and above the values)', () => {
    const values = [3, 8, 15, 21, 30];
    for (const target of [1, 9, 22, 31]) {
      const steps = binarySearchSteps(values, target);
      const end = last(steps);
      expect(end.found).toBeUndefined();
      expect(end.range).toBeUndefined();
      const p = new Map(end.pointers!.map((x) => [x.label, x.index]));
      expect(p.get('low')).toBe(p.get('high')! + 1);
      // low lands on the insertion point.
      expect(p.get('low')).toBe(values.filter((v) => v < target).length);
      expect(end.counters.comparisons).toBeLessThanOrEqual(3);
      expect(steps[steps.length - 1].narration).toContain(`${target} is not in the array`);
      checkText(steps);
    }
  });

  it('linear search: one comparison per value checked, present and absent', () => {
    const values = [4, 9, 2, 7];
    values.forEach((t, i) => {
      const steps = linearSearchSteps(values, t);
      expect(last(steps).found).toBe(i);
      expect(last(steps).counters.comparisons).toBe(i + 1);
      checkText(steps);
    });
    const missing = linearSearchSteps(values, 5);
    expect(last(missing).found).toBeUndefined();
    expect(last(missing).counters.comparisons).toBe(4);
    checkText(missing);
  });
});
