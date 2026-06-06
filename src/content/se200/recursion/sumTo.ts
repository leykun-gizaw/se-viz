/**
 * SE 200 · Recursion (week 5) — accumulation recursion: sum_to(n) = n + (n-1) + … + 1 + 0.
 *
 * The simplest recursive shape: the stack builds all the way to the base case `sum_to(0) = 0`, then
 * on the way back up each frame adds its own `n` to the value returned from below. Each return is a
 * pending expression (`4 + sum_to(3)`) that resolves and green-pulses as its child returns.
 *
 * Hand-traced: sum_to(0)=0, sum_to(1)=1, sum_to(2)=3, sum_to(3)=6, sum_to(4)=10 (= 4+3+2+1).
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

int sum_to(int n) {
    if (n == 0)
        return 0;
    return n + sum_to(n - 1);
}

int main(void) {
    int total = sum_to(4);
    printf("%d\\n", total);
    return 0;
}
`;

const FRAME_ADDR = [
  '0x7ffee570',
  '0x7ffee540',
  '0x7ffee510',
  '0x7ffee4e0',
  '0x7ffee4b0',
  '0x7ffee480',
];

function intCell(id: string, name: string, value: ScalarCell['value'], addr: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address: addr };
}

/** A `sum_to` activation at depth `d` (1..5 → n = 4..0) with its own `n` and (pending) return. */
function sumFrame(d: number, n: number, ret: ScalarCell['value']): StackFrame {
  const addr = FRAME_ADDR[d];
  return {
    id: `st${n}`,
    name: 'sum_to',
    callId: d,
    address: addr,
    variables: [
      intCell(`st${n}.n`, 'n', n, addr.slice(0, -1) + '4'),
      intCell(`st${n}.ret`, 'return', ret, addr),
    ],
  };
}

function mainFrame(total: ScalarCell['value']): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    address: FRAME_ADDR[0],
    variables: [intCell('main.total', 'total', total, '0x7ffee574')],
  };
}

const P4 = '4 + sum_to(3)';
const P3 = '3 + sum_to(2)';
const P2 = '2 + sum_to(1)';
const P1 = '1 + sum_to(0)';
const COND = { expr: 'n == 0' };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main is about to call sum_to(4).',
    highlightedLines: [10],
    stack: [mainFrame(null)],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'call-4',
    index: 1,
    narration:
      'sum_to(4): n is not 0, so it will return 4 + sum_to(3). Push a frame for sum_to(3).',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), sumFrame(1, 4, P4)],
    heap: [],
    activeId: 'st4',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-3',
    index: 2,
    narration: 'sum_to(3): push a frame for sum_to(2). The stack keeps growing.',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), sumFrame(1, 4, P4), sumFrame(2, 3, P3)],
    heap: [],
    activeId: 'st3',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-2',
    index: 3,
    narration: 'sum_to(2): push a frame for sum_to(1).',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), sumFrame(1, 4, P4), sumFrame(2, 3, P3), sumFrame(3, 2, P2)],
    heap: [],
    activeId: 'st2',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-1',
    index: 4,
    narration: 'sum_to(1): push a frame for sum_to(0).',
    highlightedLines: [4, 6],
    stack: [
      mainFrame(null),
      sumFrame(1, 4, P4),
      sumFrame(2, 3, P3),
      sumFrame(3, 2, P2),
      sumFrame(4, 1, P1),
    ],
    heap: [],
    activeId: 'st1',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-0',
    index: 5,
    narration: 'sum_to(0): now n == 0 is true — the base case.',
    highlightedLines: [4],
    stack: [
      mainFrame(null),
      sumFrame(1, 4, P4),
      sumFrame(2, 3, P3),
      sumFrame(3, 2, P2),
      sumFrame(4, 1, P1),
      sumFrame(5, 0, null),
    ],
    heap: [],
    activeId: 'st0',
    condition: { ...COND, result: true },
  },
  {
    id: 'base-case',
    index: 6,
    narration:
      'The base case returns 0 (the seed). The stack now unwinds, each frame adding its n.',
    highlightedLines: [5],
    stack: [
      mainFrame(null),
      sumFrame(1, 4, P4),
      sumFrame(2, 3, P3),
      sumFrame(3, 2, P2),
      sumFrame(4, 1, P1),
      sumFrame(5, 0, 0),
    ],
    heap: [],
    activeId: 'st0',
  },
  {
    id: 'unwind-1',
    index: 7,
    narration: 'sum_to(0) returned 0, so sum_to(1) resolves 1 + 0 = 1.',
    highlightedLines: [6],
    stack: [
      mainFrame(null),
      sumFrame(1, 4, P4),
      sumFrame(2, 3, P3),
      sumFrame(3, 2, P2),
      sumFrame(4, 1, 1),
    ],
    heap: [],
    activeId: 'st1',
  },
  {
    id: 'unwind-2',
    index: 8,
    narration: 'sum_to(1) returned 1, so sum_to(2) resolves 2 + 1 = 3.',
    highlightedLines: [6],
    stack: [mainFrame(null), sumFrame(1, 4, P4), sumFrame(2, 3, P3), sumFrame(3, 2, 3)],
    heap: [],
    activeId: 'st2',
  },
  {
    id: 'unwind-3',
    index: 9,
    narration: 'sum_to(2) returned 3, so sum_to(3) resolves 3 + 3 = 6.',
    highlightedLines: [6],
    stack: [mainFrame(null), sumFrame(1, 4, P4), sumFrame(2, 3, 6)],
    heap: [],
    activeId: 'st3',
  },
  {
    id: 'unwind-4',
    index: 10,
    narration: 'sum_to(3) returned 6, so sum_to(4) resolves 4 + 6 = 10.',
    highlightedLines: [6],
    stack: [mainFrame(null), sumFrame(1, 4, 10)],
    heap: [],
    activeId: 'st4',
  },
  {
    id: 'assign-total',
    index: 11,
    narration: 'sum_to(4) returned 10, stored in total.',
    highlightedLines: [10],
    stack: [mainFrame(10)],
    heap: [],
    activeId: 'main.total',
  },
  {
    id: 'print',
    index: 12,
    narration: 'printf writes 10 to the console.',
    highlightedLines: [11],
    stack: [mainFrame(10)],
    heap: [],
    activeId: 'main.total',
    stdout: ['10'],
  },
  {
    id: 'return',
    index: 13,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [12],
    stack: [mainFrame(10)],
    heap: [],
    activeId: 'main',
    stdout: ['10'],
  },
];

export const sumToTrace: Trace = {
  id: 'se200-sum-to',
  title: 'sum_to(n) — accumulation recursion',
  course: 'SE 200',
  topic: 'Recursion',
  file: 'sum_to.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Recursion'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: sumToTrace,
  label: 'sum_to(n)',
  summary: 'Accumulation: each frame adds its n to the value returned from below.',
  order: 81,
};
export default contentModule;
