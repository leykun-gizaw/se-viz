/**
 * Concept-view validation fixture — dual-trace debugging (PDF screen 09, `view: 'dual-trace'`).
 *
 * The same array-sum program run two ways: a buggy version whose loop test is `i <= 3` (one past the
 * end) and a fixed version testing `i < 3`. arr = {2, 5, 4}. The two runs are identical while they
 * sum the three real elements; they **first diverge** when the fixed loop stops and the buggy loop
 * runs once more, reading arr[3] out of bounds (undefined behaviour). That step is flagged. Engine
 * fixture proving the `dual-trace` renderer; the curriculum module (SE 200 · Debugging) is Phase 14.
 */
import type { ContentModule } from '../module.ts';
import type { DualColumn, Step, Trace } from '../../engine/trace/types.ts';

const BUGGY = `int sum = 0;
for (int i = 0; i <= 3; i++)
    sum += arr[i];
printf("%d\\n", sum);`;

const FIXED = `int sum = 0;
for (int i = 0; i < 3; i++)
    sum += arr[i];
printf("%d\\n", sum);`;

function col(
  label: string,
  line: number | undefined,
  i: string,
  sum: string,
  opts: { sumChanged?: boolean; stdout?: string[] } = {},
): DualColumn {
  const column: DualColumn = {
    label,
    rows: [
      { name: 'i', value: i },
      { name: 'sum', value: sum, changed: opts.sumChanged ?? false },
    ],
  };
  if (line !== undefined) column.line = line;
  if (opts.stdout !== undefined) column.stdout = opts.stdout;
  return column;
}

const steps: Step[] = [
  {
    id: 'init',
    index: 0,
    narration: 'Both versions initialise sum = 0. arr is {2, 5, 4}. So far the runs are identical.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      left: col('buggy  (i <= 3)', 1, '—', '0', { sumChanged: true }),
      right: col('fixed  (i < 3)', 1, '—', '0', { sumChanged: true }),
    },
  },
  {
    id: 'i0',
    index: 1,
    narration: 'i = 0: both add arr[0] = 2. sum = 2 in both runs.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      left: col('buggy  (i <= 3)', 3, '0', '2', { sumChanged: true }),
      right: col('fixed  (i < 3)', 3, '0', '2', { sumChanged: true }),
    },
  },
  {
    id: 'i1',
    index: 2,
    narration: 'i = 1: both add arr[1] = 5. sum = 7.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      left: col('buggy  (i <= 3)', 3, '1', '7', { sumChanged: true }),
      right: col('fixed  (i < 3)', 3, '1', '7', { sumChanged: true }),
    },
  },
  {
    id: 'i2',
    index: 3,
    narration: 'i = 2: both add arr[2] = 4. sum = 11. The three real elements are now summed.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      left: col('buggy  (i <= 3)', 3, '2', '11', { sumChanged: true }),
      right: col('fixed  (i < 3)', 3, '2', '11', { sumChanged: true }),
    },
  },
  {
    id: 'diverge',
    index: 4,
    narration:
      'Here they diverge. With i = 3 the fixed test i < 3 is false, so it stops and prints. The buggy test i <= 3 is true, so it loops once more.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col('buggy  (i <= 3)', 2, '3', '11'),
      right: col('fixed  (i < 3)', 4, '3', '11'),
    },
  },
  {
    id: 'oob',
    index: 5,
    narration:
      'The buggy run reads arr[3] — one past the end of the array, which is undefined behaviour. Here it happens to hold 99, so sum becomes 11 + 99 = 110. The fixed run prints 11.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col('buggy  (i <= 3)', 3, '3', '110', { sumChanged: true }),
      right: col('fixed  (i < 3)', 4, '3', '11', { stdout: ['11'] }),
    },
  },
  {
    id: 'print',
    index: 6,
    narration:
      'The buggy run finally exits and prints 110 — a wrong answer produced by one character: <= where it should have been <.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col('buggy  (i <= 3)', 4, '4', '110', { stdout: ['110'] }),
      right: col('fixed  (i < 3)', 4, '3', '11', { stdout: ['11'] }),
    },
  },
];

export const dualTraceTrace: Trace = {
  id: 'fixture-dual-trace',
  title: 'Debugging — buggy vs fixed (dual trace)',
  course: 'SE 200',
  topic: 'Debugging',
  file: 'sum.c',
  view: 'dual-trace',
  language: 'c',
  source: '',
  leftSource: BUGGY,
  rightSource: FIXED,
  steps,
};

const contentModule: ContentModule = {
  trace: dualTraceTrace,
  label: 'Dual-trace debugging',
  summary: 'Concept view: buggy vs fixed run side by side; first divergence flagged.',
  order: 42,
  course: 'Engine fixtures',
  topic: 'Concept views',
};
export default contentModule;
