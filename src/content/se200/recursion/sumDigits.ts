/**
 * SE 200 · Recursion (week 5) — sum_digits(n): add a number's decimal digits recursively.
 *
 * `sum_digits(n) = n % 10 + sum_digits(n / 10)`, base case `n == 0 → 0`. Each call peels off the last
 * digit (`n % 10`) and recurses on the rest (`n / 10`); the digits are added back on the unwind.
 *
 * Hand-traced: sum_digits(135) = 1 + 3 + 5 = 9.
 *   sum_digits(135)=5 + sum_digits(13); sum_digits(13)=3 + sum_digits(1);
 *   sum_digits(1)=1 + sum_digits(0); sum_digits(0)=0 (base).
 *   Unwind: sum_digits(1)=1+0=1; sum_digits(13)=3+1=4; sum_digits(135)=5+4=9.
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

int sum_digits(int n) {
    if (n == 0)
        return 0;
    return n % 10 + sum_digits(n / 10);
}

int main(void) {
    int result = sum_digits(135);
    printf("%d\\n", result);
    return 0;
}
`;

const FRAME_ADDR = ['0x7ffee570', '0x7ffee540', '0x7ffee510', '0x7ffee4e0', '0x7ffee4b0'];

function intCell(id: string, name: string, value: ScalarCell['value'], addr: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address: addr };
}

/** A `sum_digits` activation at depth `d` with its own `n` and a (pending) return. */
function sdFrame(d: number, n: number, ret: ScalarCell['value']): StackFrame {
  const addr = FRAME_ADDR[d];
  return {
    id: `sd${n}`,
    name: 'sum_digits',
    callId: d,
    address: addr,
    variables: [
      intCell(`sd${n}.n`, 'n', n, addr.slice(0, -1) + '4'),
      intCell(`sd${n}.ret`, 'return', ret, addr),
    ],
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

const S135 = '5 + sum_digits(13)';
const S13 = '3 + sum_digits(1)';
const S1 = '1 + sum_digits(0)';
const COND = { expr: 'n == 0' };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main is about to call sum_digits(135).',
    highlightedLines: [10],
    stack: [mainFrame(null)],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'call-135',
    index: 1,
    narration:
      'sum_digits(135): n == 0 is false. Peel the last digit: 135 % 10 = 5, and recurse on 135 / 10 = 13.',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), sdFrame(1, 135, S135)],
    heap: [],
    activeId: 'sd135',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-13',
    index: 2,
    narration: 'sum_digits(13): 13 % 10 = 3, recurse on 13 / 10 = 1.',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), sdFrame(1, 135, S135), sdFrame(2, 13, S13)],
    heap: [],
    activeId: 'sd13',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-1',
    index: 3,
    narration: 'sum_digits(1): 1 % 10 = 1, recurse on 1 / 10 = 0.',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), sdFrame(1, 135, S135), sdFrame(2, 13, S13), sdFrame(3, 1, S1)],
    heap: [],
    activeId: 'sd1',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-0',
    index: 4,
    narration: 'sum_digits(0): now n is 0, so n == 0 is true — the base case. It returns 0.',
    highlightedLines: [4],
    stack: [
      mainFrame(null),
      sdFrame(1, 135, S135),
      sdFrame(2, 13, S13),
      sdFrame(3, 1, S1),
      sdFrame(4, 0, null),
    ],
    heap: [],
    activeId: 'sd0',
    condition: { ...COND, result: true },
    coach: {
      variant: 'idea',
      title: 'The base case',
      body: 'When n reaches 0 there are no digits left to add, so sum_digits(0) returns 0 — the seed the additions build on as the stack unwinds.',
      anchorId: 'sd0',
    },
  },
  {
    id: 'base-case',
    index: 5,
    narration:
      'sum_digits(0) returns 0. The deepest frame is done; the stack unwinds, adding digits.',
    highlightedLines: [5],
    stack: [
      mainFrame(null),
      sdFrame(1, 135, S135),
      sdFrame(2, 13, S13),
      sdFrame(3, 1, S1),
      sdFrame(4, 0, 0),
    ],
    heap: [],
    activeId: 'sd0',
  },
  {
    id: 'unwind-1',
    index: 6,
    narration: 'sum_digits(0) returned 0, so sum_digits(1) resolves 1 + 0 = 1 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), sdFrame(1, 135, S135), sdFrame(2, 13, S13), sdFrame(3, 1, 1)],
    heap: [],
    activeId: 'sd1',
  },
  {
    id: 'unwind-13',
    index: 7,
    narration: 'sum_digits(1) returned 1, so sum_digits(13) resolves 3 + 1 = 4 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), sdFrame(1, 135, S135), sdFrame(2, 13, 4)],
    heap: [],
    activeId: 'sd13',
  },
  {
    id: 'unwind-135',
    index: 8,
    narration: 'sum_digits(13) returned 4, so sum_digits(135) resolves 5 + 4 = 9 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), sdFrame(1, 135, 9)],
    heap: [],
    activeId: 'sd135',
  },
  {
    id: 'assign-result',
    index: 9,
    narration: 'sum_digits(135) returned 9 (1 + 3 + 5), which is stored in result.',
    highlightedLines: [10],
    stack: [mainFrame(9)],
    heap: [],
    activeId: 'main.result',
  },
  {
    id: 'print',
    index: 10,
    narration: 'printf writes 9 to the console.',
    highlightedLines: [11],
    stack: [mainFrame(9)],
    heap: [],
    activeId: 'main.result',
    stdout: ['9'],
  },
  {
    id: 'return',
    index: 11,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [12],
    stack: [mainFrame(9)],
    heap: [],
    activeId: 'main',
    stdout: ['9'],
  },
];

export const sumDigitsTrace: Trace = {
  id: 'se200-sum-digits',
  title: 'sum_digits(n) — add a number’s digits recursively',
  course: 'SE 200',
  topic: 'Recursion',
  file: 'sumdigits.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Recursion'],
};

const contentModule: ContentModule = {
  trace: sumDigitsTrace,
  label: 'sum_digits(n)',
  summary:
    'Peel the last digit each call (n % 10), recurse on n / 10, add the digits back on unwind.',
  order: 86,
};
export default contentModule;
