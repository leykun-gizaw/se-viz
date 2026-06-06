/**
 * SE 200 · Debugging — find the maximum of an array, buggy vs fixed (`view: 'dual-trace'`).
 *
 * The same `max-of-array` program run two ways. The bug is a single flipped comparison operator on
 * line 3: the buggy version tests `a[i] < max`, the fixed version tests `a[i] > max`. Both scan
 * a[] = {3, 7, 2, 9} starting from max = a[0] = 3.
 *
 * The two runs are identical only up to the very first comparison (i = 1): there the buggy `7 < 3`
 * is false while the fixed `7 > 3` is true, so the runs take opposite branches — that is the flagged
 * first divergence. Everything afterwards is downstream of it: the buggy run drifts to the SMALLEST
 * value it sees below the seed (2), while the fixed run climbs to the true maximum (9).
 *
 * Teaching focus: debug by comparison. Scanning the two columns top-to-bottom, the first row whose
 * behaviour differs pinpoints the offending line — no need to read the whole program.
 */
import type { ContentModule } from '../../module.ts';
import type { DualColumn, Step, Trace } from '../../../engine/trace/types.ts';

// 1-based lines (shared structure; only line 3's operator differs between the two):
//   1  int max = a[0];
//   2  for (int i = 1; i < 4; i++)
//   3      if (a[i] > max)        // buggy: a[i] < max
//   4          max = a[i];
//   5  printf("%d\n", max);
const BUGGY = `int max = a[0];
for (int i = 1; i < 4; i++)
    if (a[i] < max)
        max = a[i];
printf("%d\\n", max);`;

const FIXED = `int max = a[0];
for (int i = 1; i < 4; i++)
    if (a[i] > max)
        max = a[i];
printf("%d\\n", max);`;

const BUGGY_LABEL = 'buggy  (a[i] < max)';
const FIXED_LABEL = 'fixed  (a[i] > max)';

function col(
  label: string,
  line: number | undefined,
  i: string,
  ai: string,
  max: string,
  opts: { maxChanged?: boolean; stdout?: string[] } = {},
): DualColumn {
  const column: DualColumn = {
    label,
    rows: [
      { name: 'i', value: i },
      { name: 'a[i]', value: ai },
      { name: 'max', value: max, changed: opts.maxChanged ?? false },
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
    narration:
      'Both versions seed max = a[0] = 3, then loop i from 1 to 3. a[] = {3, 7, 2, 9}. So far the two runs are identical.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      left: col(BUGGY_LABEL, 1, '—', '—', '3', { maxChanged: true }),
      right: col(FIXED_LABEL, 1, '—', '—', '3', { maxChanged: true }),
    },
  },
  {
    id: 'i1-test',
    index: 1,
    narration:
      'First divergence. i = 1, a[1] = 7, max = 3. The buggy test 7 < 3 is FALSE, so it will skip; the fixed test 7 > 3 is TRUE, so it will update. The flipped operator on line 3 is the bug — everything below is downstream of this row.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col(BUGGY_LABEL, 3, '1', '7', '3'),
      right: col(FIXED_LABEL, 3, '1', '7', '3'),
    },
    coach: {
      variant: 'watch-out',
      title: 'First divergence',
      body: 'Debug by comparison: scan both columns until a row first differs. Here the if test diverges (7 < 3 vs 7 > 3) — line 3’s flipped operator is the bug. Everything below is just downstream of it.',
    },
  },
  {
    id: 'i1-act',
    index: 2,
    narration:
      'The buggy run takes the false branch and leaves max = 3. The fixed run takes the true branch: max = a[1] = 7. The two runs now hold different maxima.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col(BUGGY_LABEL, 2, '1', '7', '3'),
      right: col(FIXED_LABEL, 4, '1', '7', '7', { maxChanged: true }),
    },
  },
  {
    id: 'i2-test',
    index: 3,
    narration:
      'i = 2, a[2] = 2. Buggy compares against max = 3: 2 < 3 is TRUE, so it will (wrongly) update. Fixed compares against max = 7: 2 > 7 is FALSE, so it correctly skips.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col(BUGGY_LABEL, 3, '2', '2', '3'),
      right: col(FIXED_LABEL, 3, '2', '2', '7'),
    },
  },
  {
    id: 'i2-act',
    index: 4,
    narration:
      'The buggy run assigns max = a[2] = 2 — it is tracking the SMALLEST value, not the largest. The fixed run skips and keeps max = 7.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col(BUGGY_LABEL, 4, '2', '2', '2', { maxChanged: true }),
      right: col(FIXED_LABEL, 2, '2', '2', '7'),
    },
  },
  {
    id: 'i3-test',
    index: 5,
    narration:
      'i = 3, a[3] = 9 — the true maximum. Buggy compares against max = 2: 9 < 2 is FALSE, so it skips. Fixed compares against max = 7: 9 > 7 is TRUE, so it will update.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col(BUGGY_LABEL, 3, '3', '9', '2'),
      right: col(FIXED_LABEL, 3, '3', '9', '7'),
    },
  },
  {
    id: 'i3-act',
    index: 6,
    narration:
      'The buggy run skips and is stuck at max = 2. The fixed run assigns max = a[3] = 9 — the correct maximum.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col(BUGGY_LABEL, 2, '3', '9', '2'),
      right: col(FIXED_LABEL, 4, '3', '9', '9', { maxChanged: true }),
    },
  },
  {
    id: 'print',
    index: 7,
    narration:
      'The loop ends and both print max. The buggy run prints 2 (a value from the array, but the wrong one); the fixed run prints 9. One flipped comparison on line 3 turned a max into a min.',
    highlightedLines: [],
    stack: [],
    heap: [],
    dualTrace: {
      diverged: true,
      left: col(BUGGY_LABEL, 5, '4', '—', '2', { stdout: ['2'] }),
      right: col(FIXED_LABEL, 5, '4', '—', '9', { stdout: ['9'] }),
    },
  },
];

export const maxArrayTrace: Trace = {
  id: 'se200-debugging-max-array',
  title: 'Debugging — max of array (buggy vs fixed)',
  course: 'SE 200',
  topic: 'Debugging',
  file: 'maxarray.c',
  view: 'dual-trace',
  language: 'c',
  source: '',
  leftSource: BUGGY,
  rightSource: FIXED,
  steps,
};

const contentModule: ContentModule = {
  trace: maxArrayTrace,
  label: 'Max of array',
  summary:
    'Buggy vs fixed max-of-array side by side; the first divergence (i = 1) localizes the flipped comparison.',
  order: 35,
};
export default contentModule;
