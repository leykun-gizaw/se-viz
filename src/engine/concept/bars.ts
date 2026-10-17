/**
 * Search and sort generators for the `bars` concept view (Phase 37). Each one runs the algorithm on
 * an array and records a step per comparison (or swap, split, merge), with counters and an
 * explanation written from the generator's own state: what it compared, what it decided and the
 * counts so far. ("What changed" is the highlighted bars and the counters: the explanation panel
 * points at them, as it does for the pipeline view.)
 *
 * Conventions: indices are 0-based; a search probe counts as **one** comparison; insertion sort
 * moves the value left by swapping neighbours; merge sort counts a **write** for every value placed
 * in a merge (it has no swaps).
 *
 * @packageDocumentation
 */
import type { BarsCounters, BarsPointer, BarsSegment, BarsStep, Step } from '../trace/types.ts';
import { conceptStep, list, span } from './trace.ts';

interface Item {
  v: number;
  k: string;
}

/** What a step looked at (everything in {@link BarsStep} besides the array and the counters). */
type Look = Omit<BarsStep, 'values' | 'keys' | 'counters' | 'target'>;

/** Records the snapshots of one run. */
class Recorder {
  readonly steps: Step[] = [];
  readonly a: Item[];
  readonly c: BarsCounters;
  private readonly target: number | undefined;

  constructor(values: readonly number[], counters: BarsCounters, target?: number) {
    this.a = values.map((v, i) => ({ v, k: `e${i}` }));
    this.c = counters;
    this.target = target;
  }

  get values(): number[] {
    return this.a.map((x) => x.v);
  }

  swap(i: number, j: number): void {
    [this.a[i], this.a[j]] = [this.a[j], this.a[i]];
  }

  snap(did: string[], look: Look = {}, concept?: string): void {
    const bars: BarsStep = {
      values: this.values,
      keys: this.a.map((x) => x.k),
      ...look,
      counters: { ...this.c },
      ...(this.target === undefined ? {} : { target: this.target }),
    };
    this.steps.push(conceptStep(this.steps.length, { did, concept }, { bars }));
  }
}

/** A labelled pointer. */
const pt = (label: string, index: number): BarsPointer => ({ label, index });

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/* ───────────────────────────── Searches ───────────────────────────── */

const LINEAR_CONCEPT =
  'Linear search checks the values one by one. In the worst case (the target is last, or missing) ' +
  'it makes one comparison per value: **O(n)**.';

/** Linear search for `target`, from index 0 up. */
export function linearSearchSteps(values: readonly number[], target: number): Step[] {
  const r = new Recorder(values, { comparisons: 0 }, target);
  const n = values.length;
  r.snap(
    [
      `Looking for ${target} in ${list(values)}.`,
      'Linear search checks each value in turn, starting at index 0.',
    ],
    {},
    LINEAR_CONCEPT,
  );
  for (let i = 0; i < n; i++) {
    r.c.comparisons++;
    const v = values[i];
    if (v === target) {
      r.snap(
        [
          `Checked index ${i}: ${v} is the target.`,
          `Found ${target} at index ${i} after ${r.c.comparisons} comparison${r.c.comparisons === 1 ? '' : 's'}.`,
        ],
        { compared: [i], found: i, pointers: [pt('i', i)] },
        LINEAR_CONCEPT,
      );
      return r.steps;
    }
    r.snap(
      [`Checked index ${i}: ${v} is not ${target}.`, `Comparisons so far: ${r.c.comparisons}.`],
      { compared: [i], pointers: [pt('i', i)] },
    );
  }
  r.snap(
    [
      `Checked all ${n} values and none is ${target}, so ${target} is not in the array.`,
      `That took ${r.c.comparisons} comparisons: one per value.`,
    ],
    {},
    LINEAR_CONCEPT,
  );
  return r.steps;
}

const BINARY_CONCEPT =
  'Binary search needs a sorted array. Each comparison with the middle value rules out half of the ' +
  'range that is left, so it takes about log₂ n comparisons: **O(log n)**.';

/** Binary search for `target` in sorted `values`. */
export function binarySearchSteps(values: readonly number[], target: number): Step[] {
  const r = new Recorder(values, { comparisons: 0 }, target);
  let low = 0;
  let high = values.length - 1;
  r.snap(
    [
      `Looking for ${target} in the sorted array ${list(values)}.`,
      `Binary search keeps a range, \`low\` to \`high\`, where the target could be. It starts as the whole array: ${span(low, high)}.`,
    ],
    { range: { from: low, to: high }, pointers: [pt('low', low), pt('high', high)] },
    BINARY_CONCEPT,
  );
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const v = values[mid];
    r.c.comparisons++;
    const did = [
      `\`low\` = ${low} and \`high\` = ${high}, so \`mid\` = (${low} + ${high}) // 2 = ${mid}.`,
      `Compared ${target} with ${v}, the value at index ${mid}.`,
    ];
    const look: Look = {
      range: { from: low, to: high },
      compared: [mid],
      pointers: [pt('low', low), pt('mid', mid), pt('high', high)],
    };
    if (v === target) {
      did.push(
        `They are equal: found ${target} at index ${mid} after ${r.c.comparisons} comparisons.`,
      );
      r.snap(did, { ...look, found: mid }, BINARY_CONCEPT);
      return r.steps;
    }
    if (target > v) {
      did.push(`${target} is bigger, so it can only be to the right: \`low\` becomes ${mid + 1}.`);
      low = mid + 1;
    } else {
      did.push(`${target} is smaller, so it can only be to the left: \`high\` becomes ${mid - 1}.`);
      high = mid - 1;
    }
    did.push(`Comparisons so far: ${r.c.comparisons}.`);
    r.snap(did, look);
  }
  r.snap(
    [
      `Now \`low\` = ${low} is past \`high\` = ${high}: the range is empty, so ${target} is not in the array.`,
      `That took ${r.c.comparisons} comparisons for ${values.length} values.`,
    ],
    {
      pointers: [pt('high', high), pt('low', low)],
    },
    BINARY_CONCEPT,
  );
  return r.steps;
}

/* ───────────────────────────── Sorts ───────────────────────────── */

const sortedSummary = (r: Recorder, extra: string) =>
  `Sorted: ${list(r.values)}, using ${r.c.comparisons} comparisons and ${extra}.`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const BUBBLE_CONCEPT =
  'Bubble sort compares neighbours and swaps any pair that is out of order. Each pass carries the ' +
  'largest remaining value to the end, so the sorted region grows from the right. About n²/2 ' +
  'comparisons: **O(n²)**.';

export function bubbleSortSteps(values: readonly number[]): Step[] {
  const r = new Recorder(values, { comparisons: 0, swaps: 0 });
  const n = values.length;
  let sorted: number[] = [];
  r.snap(
    [
      `Start with ${list(values)}.`,
      'Bubble sort walks along the array, comparing each value with its right-hand neighbour.',
    ],
    {},
    BUBBLE_CONCEPT,
  );
  for (let pass = 0; pass < n - 1; pass++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - pass; j++) {
      const x = r.a[j].v;
      const y = r.a[j + 1].v;
      r.c.comparisons++;
      const did = [`Compared ${x} and ${y}.`];
      const look: Look = { sorted, pointers: [pt('j', j)] };
      if (x > y) {
        r.swap(j, j + 1);
        r.c.swaps = (r.c.swaps ?? 0) + 1;
        swapped = true;
        did.push(`${x} is bigger, so they swap.`, `Swaps so far: ${r.c.swaps}.`);
        r.snap(did, { ...look, swapped: [j, j + 1] });
      } else {
        did.push(`${x} is not bigger, so they stay.`, `Comparisons so far: ${r.c.comparisons}.`);
        r.snap(did, { ...look, compared: [j, j + 1] });
      }
    }
    const last = n - 1 - pass;
    if (!swapped) {
      sorted = range(0, n - 1);
      r.snap(
        [
          `Pass ${pass + 1} made no swaps, so every neighbouring pair is in order: the array is sorted.`,
        ],
        { sorted },
      );
      break;
    }
    sorted = last === 1 ? range(0, n - 1) : [last, ...sorted];
    r.snap(
      [
        `Pass ${pass + 1} is done: ${r.a[last].v} has reached index ${last}, its final place.` +
          (last === 1 ? ` That leaves ${r.a[0].v} alone at index 0, so it is in place too.` : ''),
      ],
      { sorted },
    );
  }
  r.snap(
    [sortedSummary(r, plural(r.c.swaps ?? 0, 'swap'))],
    { sorted: range(0, n - 1) },
    BUBBLE_CONCEPT,
  );
  return r.steps;
}

const SELECTION_CONCEPT =
  'Selection sort finds the smallest value in the unsorted part and swaps it into the next place. ' +
  'It always makes about n²/2 comparisons (**O(n²)**) but at most n − 1 swaps.';

export function selectionSortSteps(values: readonly number[]): Step[] {
  const r = new Recorder(values, { comparisons: 0, swaps: 0 });
  const n = values.length;
  const sorted: number[] = [];
  r.snap([`Start with ${list(values)}.`], {}, SELECTION_CONCEPT);
  for (let i = 0; i < n - 1; i++) {
    let min = i;
    r.snap(
      [
        `Pass ${i + 1}: find the smallest value in ${span(i, n - 1)}.`,
        `Start with ${r.a[i].v} at index ${i} as the smallest so far.`,
      ],
      { sorted: [...sorted], pointers: [pt('i', i), pt('min', min)] },
    );
    for (let j = i + 1; j < n; j++) {
      r.c.comparisons++;
      const x = r.a[j].v;
      const m = r.a[min].v;
      const did = [`Compared ${x} (index ${j}) with the smallest so far, ${m} (index ${min}).`];
      const old = min;
      if (x < m) {
        min = j;
        did.push(`${x} is smaller, so it is the new smallest.`);
      } else {
        did.push(`${x} is not smaller, so ${m} stays the smallest.`);
      }
      did.push(`Comparisons so far: ${r.c.comparisons}.`);
      r.snap(did, {
        compared: [old, j],
        sorted: [...sorted],
        pointers: [pt('i', i), pt('j', j), pt('min', min)],
      });
    }
    const v = r.a[min].v;
    sorted.push(i);
    if (i === n - 2) sorted.push(n - 1);
    const lastNote =
      i === n - 2
        ? ` The last value left, ${min === i ? r.a[n - 1].v : r.a[i].v}, is then in place too.`
        : '';
    if (min !== i) {
      const other = r.a[i].v;
      r.swap(i, min);
      r.c.swaps = (r.c.swaps ?? 0) + 1;
      r.snap(
        [
          `Swapped ${v} into index ${i}, its final place; ${other} moves to index ${min}.${lastNote}`,
          `Swaps so far: ${r.c.swaps}.`,
        ],
        { swapped: [i, min], sorted: [...sorted], pointers: [pt('i', i), pt('min', i)] },
      );
    } else {
      r.snap([`${v} is already at index ${i}, its final place: no swap needed.${lastNote}`], {
        sorted: [...sorted],
        pointers: [pt('i', i), pt('min', min)],
      });
    }
  }
  r.snap(
    [sortedSummary(r, plural(r.c.swaps ?? 0, 'swap'))],
    { sorted: range(0, n - 1) },
    SELECTION_CONCEPT,
  );
  return r.steps;
}

const INSERTION_CONCEPT =
  'Insertion sort grows a sorted part on the left. Each new value moves left, past every bigger ' +
  'value, until it reaches its place. Nearly sorted input is fast (about n comparisons); reversed ' +
  'input is the worst case, about n²/2: **O(n²)**.';

export function insertionSortSteps(values: readonly number[]): Step[] {
  const r = new Recorder(values, { comparisons: 0, swaps: 0 });
  const n = values.length;
  r.snap(
    [`Start with ${list(values)}.`, `${values[0]} at index 0 is, on its own, a sorted part.`],
    { sorted: [0] },
    INSERTION_CONCEPT,
  );
  for (let i = 1; i < n; i++) {
    const key = r.a[i].v;
    const prefix = range(0, i - 1);
    r.snap([`Next, insert ${key} (index ${i}) into the sorted part, ${span(0, i - 1)}.`], {
      sorted: prefix,
      pointers: [pt('key', i)],
    });
    let j = i;
    for (;;) {
      const left = r.a[j - 1].v;
      r.c.comparisons++;
      const did = [`Compared ${left} and ${key}.`];
      if (left > key) {
        r.swap(j - 1, j);
        r.c.swaps = (r.c.swaps ?? 0) + 1;
        j--;
        did.push(`${left} is bigger, so ${key} moves left past it, to index ${j}.`);
        did.push(`Swaps so far: ${r.c.swaps}.`);
        if (j === 0) {
          did.push(`${key} is now at the front: ${span(0, i)} are sorted.`);
          r.snap(did, { swapped: [0, 1], sorted: range(0, i), pointers: [pt('key', 0)] });
          break;
        }
        r.snap(did, { swapped: [j, j + 1], sorted: prefix, pointers: [pt('key', j)] });
      } else {
        did.push(`${left} is not bigger, so ${key} stays at index ${j}: ${span(0, i)} are sorted.`);
        did.push(`Comparisons so far: ${r.c.comparisons}.`);
        r.snap(did, { compared: [j - 1, j], sorted: range(0, i), pointers: [pt('key', j)] });
        break;
      }
    }
  }
  r.snap(
    [sortedSummary(r, plural(r.c.swaps ?? 0, 'swap'))],
    { sorted: range(0, n - 1) },
    INSERTION_CONCEPT,
  );
  return r.steps;
}

const MERGE_CONCEPT =
  'Merge sort splits the array in half again and again until every piece holds one value, then ' +
  'merges pieces back together in order. There are about log₂ n levels of splitting, and each ' +
  'level of merging places all n values: **O(n log n)**.';

export function mergeSortSteps(values: readonly number[]): Step[] {
  const r = new Recorder(values, { comparisons: 0, writes: 0 });
  const n = values.length;
  const segments: BarsSegment[] = [];
  const build = (from: number, to: number, depth: number) => {
    segments.push({ from, to, depth, state: 'idle' });
    if (from < to) {
      const mid = Math.floor((from + to) / 2);
      build(from, mid, depth + 1);
      build(mid + 1, to, depth + 1);
    }
  };
  build(0, n - 1, 0);
  const seg = (from: number, to: number) => segments.find((s) => s.from === from && s.to === to)!;
  const segs = () => segments.map((s) => ({ ...s }));

  r.snap(
    [
      `Start with ${list(values)}.`,
      'Merge sort first splits the array into halves, level by level, then merges the pieces back in order.',
    ],
    { segments: segs() },
    MERGE_CONCEPT,
  );

  const sort = (from: number, to: number): void => {
    if (from === to) return;
    const mid = Math.floor((from + to) / 2);
    seg(from, to).state = 'split';
    const did = [`Split ${span(from, to)} into ${span(from, mid)} and ${span(mid + 1, to)}.`];
    for (const [a, b] of [
      [from, mid],
      [mid + 1, to],
    ]) {
      if (a === b) seg(a, b).state = 'merged';
    }
    if (from === mid && mid + 1 === to) did.push('A single value is already sorted.');
    else if (from === mid || mid + 1 === to)
      did.push('The piece with a single value is already sorted.');
    r.snap(did, { range: { from, to }, segments: segs() });
    sort(from, mid);
    sort(mid + 1, to);
    merge(from, mid, to);
  };

  const merge = (from: number, mid: number, to: number): void => {
    const left = r.a.slice(from, mid + 1);
    const right = r.a.slice(mid + 1, to + 1);
    const out: Item[] = [];
    seg(from, to).state = 'active';
    const lay = () => {
      const now = [...out, ...left, ...right];
      now.forEach((item, i) => (r.a[from + i] = item));
    };
    const heads = (): BarsPointer[] => [
      ...(left.length > 0 ? [pt('i', from + out.length)] : []),
      ...(right.length > 0 ? [pt('j', from + out.length + left.length)] : []),
    ];
    const where = `Merging ${span(from, to)}:`;
    while (left.length > 0 && right.length > 0) {
      const x = left[0].v;
      const y = right[0].v;
      r.c.comparisons++;
      r.c.writes = (r.c.writes ?? 0) + 1;
      const takeLeft = x <= y;
      out.push(takeLeft ? left.shift()! : right.shift()!);
      lay();
      const into = from + out.length - 1;
      const did = [`${where} compared ${x} and ${y}.`];
      if (x === y) {
        did.push(
          `They are equal, so the left one goes first, into index ${into} (this keeps equal values in order).`,
        );
      } else {
        did.push(`${Math.min(x, y)} is smaller, so it goes next, into index ${into}.`);
      }
      did.push(`Writes so far: ${r.c.writes}.`);
      r.snap(did, { range: { from, to }, swapped: [into], pointers: heads(), segments: segs() });
    }
    const rest = left.length > 0 ? left : right;
    const side = left.length > 0 ? 'right' : 'left';
    const restValues = rest.map((x) => x.v);
    const start = from + out.length;
    out.push(...rest.splice(0));
    lay();
    r.c.writes = (r.c.writes ?? 0) + restValues.length;
    seg(from, to).state = 'merged';
    const whole = from === 0 && to === n - 1;
    r.snap(
      [
        `${where} the ${side} half is used up, so the rest (${restValues.join(', ')}) follows in order, into ${span(start, to)}.`,
        `Writes so far: ${r.c.writes}.`,
        `${span(from, to).replace(/^i/, 'I')} ${from === to ? 'is' : 'are'} merged: ${list(r.values.slice(from, to + 1))}.`,
      ],
      {
        range: { from, to },
        swapped: range(start, to),
        segments: segs(),
        ...(whole ? { sorted: range(0, n - 1) } : {}),
      },
    );
  };

  sort(0, n - 1);
  r.snap(
    [sortedSummary(r, plural(r.c.writes ?? 0, 'write'))],
    { sorted: range(0, n - 1), segments: segs() },
    MERGE_CONCEPT,
  );
  return r.steps;
}
