/**
 * Validation fixture 1 — recursion / call stack (PDF screen 01): `factorial(4)`.
 *
 * Exercises: nested stack frames pushed on call and popped on return, per-frame `n` and return
 * value, the base-case green pulse, and descending stack addresses (the stack grows downward).
 *
 * Breadcrumb is sourced from docs/CURRICULUM.md: **Recursion is SE 200** (C Programming I, week 5),
 * not SE 201 as the design exploration's mockup labelled it. See the report's deviations section.
 *
 * Every value is verifiably correct: 4! = 24, with 1·2·6·24 produced as the frames unwind.
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

int factorial(int n) {
    if (n <= 1)
        return 1;
    return n * factorial(n - 1);
}

int main(void) {
    int result = factorial(4);
    printf("%d\\n", result);
    return 0;
}
`;

/** A frame address per depth — descending, so deeper calls sit lower in memory. */
const FRAME_ADDR = ['0x7ffee570', '0x7ffee540', '0x7ffee510', '0x7ffee4e0', '0x7ffee4b0'];

function intCell(id: string, name: string, value: ScalarCell['value'], addr: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address: addr };
}

/** A `factorial` frame at depth `d` (1..4) with current `n` and its (possibly pending) return. */
function facFrame(d: number, n: number, ret: ScalarCell['value']): StackFrame {
  const addr = FRAME_ADDR[d]; // ends in '0'
  const nAddr = addr.slice(0, -1) + '4'; // +4 bytes from the frame base
  return {
    id: `fac${n}`,
    name: 'factorial',
    callId: d,
    address: addr,
    variables: [intCell(`fac${n}.n`, 'n', n, nAddr), intCell(`fac${n}.ret`, 'return', ret, addr)],
  };
}

function mainFrame(result: ScalarCell['value']): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    address: FRAME_ADDR[0],
    variables: [intCell('main.result', 'result', result, '0x7ffee574')],
  };
}

// Return-value expressions shown until each multiplication resolves.
const PENDING4 = '4 * factorial(3)';
const PENDING3 = '3 * factorial(2)';
const PENDING2 = '2 * factorial(1)';

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'Program starts. main is about to call factorial(4).',
    highlightedLines: [10],
    stack: [mainFrame(null)],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'call-4',
    index: 1,
    narration: 'factorial(4): n is 4, not ≤ 1, so it will return 4 * factorial(3).',
    highlightedLines: [6],
    stack: [mainFrame(null), facFrame(1, 4, PENDING4)],
    heap: [],
    activeId: 'fac4',
  },
  {
    id: 'call-3',
    index: 2,
    narration:
      'factorial(3): n is 3, so it will return 3 * factorial(2). The stack grows downward.',
    highlightedLines: [6],
    stack: [mainFrame(null), facFrame(1, 4, PENDING4), facFrame(2, 3, PENDING3)],
    heap: [],
    activeId: 'fac3',
  },
  {
    id: 'call-2',
    index: 3,
    narration: 'factorial(2): n is 2, so it will return 2 * factorial(1).',
    highlightedLines: [6],
    stack: [
      mainFrame(null),
      facFrame(1, 4, PENDING4),
      facFrame(2, 3, PENDING3),
      facFrame(3, 2, PENDING2),
    ],
    heap: [],
    activeId: 'fac2',
  },
  {
    id: 'call-1',
    index: 4,
    narration: 'factorial(1): n is 1. The if (n <= 1) test is now true.',
    highlightedLines: [4],
    stack: [
      mainFrame(null),
      facFrame(1, 4, PENDING4),
      facFrame(2, 3, PENDING3),
      facFrame(3, 2, PENDING2),
      facFrame(4, 1, null),
    ],
    heap: [],
    activeId: 'fac1',
  },
  {
    id: 'base-case',
    index: 5,
    narration: 'Base case reached — factorial(1) returns 1. Frames now unwind from the bottom up.',
    highlightedLines: [5],
    stack: [
      mainFrame(null),
      facFrame(1, 4, PENDING4),
      facFrame(2, 3, PENDING3),
      facFrame(3, 2, PENDING2),
      facFrame(4, 1, 1),
    ],
    heap: [],
    activeId: 'fac1',
  },
  {
    id: 'unwind-2',
    index: 6,
    narration: 'factorial(1) returned 1, so factorial(2) computes 2 * 1 = 2 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), facFrame(1, 4, PENDING4), facFrame(2, 3, PENDING3), facFrame(3, 2, 2)],
    heap: [],
    activeId: 'fac2',
  },
  {
    id: 'unwind-3',
    index: 7,
    narration: 'factorial(2) returned 2, so factorial(3) computes 3 * 2 = 6 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), facFrame(1, 4, PENDING4), facFrame(2, 3, 6)],
    heap: [],
    activeId: 'fac3',
  },
  {
    id: 'unwind-4',
    index: 8,
    narration: 'factorial(3) returned 6, so factorial(4) computes 4 * 6 = 24 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), facFrame(1, 4, 24)],
    heap: [],
    activeId: 'fac4',
  },
  {
    id: 'assign-result',
    index: 9,
    narration: 'factorial(4) returned 24, which is stored in result.',
    highlightedLines: [10],
    stack: [mainFrame(24)],
    heap: [],
    activeId: 'main.result',
  },
  {
    id: 'print',
    index: 10,
    narration: 'printf writes 24 to standard output.',
    highlightedLines: [11],
    stack: [mainFrame(24)],
    heap: [],
    activeId: 'main.result',
    stdout: ['24'],
  },
  {
    id: 'return',
    index: 11,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [12],
    stack: [mainFrame(24)],
    heap: [],
    activeId: 'main',
    stdout: ['24'],
  },
];

export const factorialTrace: Trace = {
  id: 'fixture-factorial',
  title: 'factorial(4) — recursion & the call stack',
  course: 'SE 200',
  topic: 'Recursion',
  file: 'factorial.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Recursion'],
};
