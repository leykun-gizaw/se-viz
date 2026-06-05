/**
 * SE 200 · More Functions, More Nested Loops (week 3) — the combination.
 *
 * A helper function (`product`) is called *inside* nested loops: for each (row, col) the loop calls
 * product(row, col), pushing/popping a frame, and prints the returned value. This brings together
 * the two week-2 ideas — call/return and nested iteration — in one slightly richer program.
 *
 * Hand-traced (row, col each 1..2; p = product(row, col) = row * col):
 *   row 1: product(1,1)=1, product(1,2)=2  → "1 2 "
 *   row 2: product(2,1)=2, product(2,2)=4  → "2 4 "
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

int product(int a, int b)
{
    return a * b;
}

int main(void)
{
    for (int row = 1; row <= 2; row++) {
        for (int col = 1; col <= 2; col++) {
            int p = product(row, col);
            printf("%d ", p);
        }
        printf("\\n");
    }
    return 0;
}
`;

function intCell(id: string, name: string, value: number, address: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address };
}

function mainFrame(opts: { row?: number; col?: number; p?: number }): StackFrame {
  const vars: ScalarCell[] = [];
  if (opts.row !== undefined) vars.push(intCell('row', 'row', opts.row, '0x7ffd4004'));
  if (opts.col !== undefined) vars.push(intCell('col', 'col', opts.col, '0x7ffd4008'));
  if (opts.p !== undefined) vars.push(intCell('p', 'p', opts.p, '0x7ffd400c'));
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd4000', variables: vars };
}

/** A `product` activation with its two copied arguments. */
function productFrame(callId: number, a: number, b: number): StackFrame {
  return {
    id: `pr${callId}`,
    name: 'product',
    callId,
    address: '0x7ffd3fd0',
    variables: [
      intCell(`pr${callId}.a`, 'a', a, '0x7ffd3fd4'),
      intCell(`pr${callId}.b`, 'b', b, '0x7ffd3fd8'),
    ],
  };
}

const OUTER = { expr: 'row <= 2' };
const INNER = { expr: 'col <= 2' };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [8],
    stack: [mainFrame({})],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'outer-init',
    index: 1,
    narration: 'Outer loop: row starts at 1.',
    highlightedLines: [10],
    stack: [mainFrame({ row: 1 })],
    heap: [],
    activeId: 'row',
  },
  {
    id: 'outer-check-1',
    index: 2,
    narration: 'row is 1: row <= 2 is true.',
    highlightedLines: [10],
    stack: [mainFrame({ row: 1 })],
    heap: [],
    activeId: 'row',
    condition: { ...OUTER, result: true },
  },
  {
    id: 'inner-init-1',
    index: 3,
    narration: 'Inner loop: col starts at 1.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 1, col: 1 })],
    heap: [],
    activeId: 'col',
  },
  {
    id: 'inner-check-1a',
    index: 4,
    narration: 'col is 1: col <= 2 is true.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 1, col: 1 })],
    heap: [],
    activeId: 'col',
    condition: { ...INNER, result: true },
  },
  {
    id: 'call-1a',
    index: 5,
    narration: 'Call product(row, col) = product(1, 1); 1 and 1 are copied into a and b.',
    highlightedLines: [12, 3],
    stack: [mainFrame({ row: 1, col: 1 }), productFrame(0, 1, 1)],
    heap: [],
    activeId: 'pr0',
  },
  {
    id: 'ret-1a',
    index: 6,
    narration: 'product returns a * b = 1 * 1 = 1; the frame pops and 1 is stored in p.',
    highlightedLines: [12],
    stack: [mainFrame({ row: 1, col: 1, p: 1 })],
    heap: [],
    activeId: 'p',
  },
  {
    id: 'print-1a',
    index: 7,
    narration: 'Print p = 1.',
    highlightedLines: [13],
    stack: [mainFrame({ row: 1, col: 1, p: 1 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 '],
  },
  {
    id: 'inner-incr-1a',
    index: 8,
    narration: 'col++ → col is 2.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 1, col: 2, p: 1 })],
    heap: [],
    activeId: 'col',
  },
  {
    id: 'inner-check-1b',
    index: 9,
    narration: 'col is 2: col <= 2 is true.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 1, col: 2, p: 1 })],
    heap: [],
    activeId: 'col',
    condition: { ...INNER, result: true },
  },
  {
    id: 'call-1b',
    index: 10,
    narration: 'Call product(1, 2).',
    highlightedLines: [12, 3],
    stack: [mainFrame({ row: 1, col: 2, p: 1 }), productFrame(1, 1, 2)],
    heap: [],
    activeId: 'pr1',
  },
  {
    id: 'ret-1b',
    index: 11,
    narration: 'product returns 1 * 2 = 2; p becomes 2.',
    highlightedLines: [12],
    stack: [mainFrame({ row: 1, col: 2, p: 2 })],
    heap: [],
    activeId: 'p',
  },
  {
    id: 'print-1b',
    index: 12,
    narration: 'Print p = 2.',
    highlightedLines: [13],
    stack: [mainFrame({ row: 1, col: 2, p: 2 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 '],
  },
  {
    id: 'inner-incr-1b',
    index: 13,
    narration: 'col++ → col is 3.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 1, col: 3, p: 2 })],
    heap: [],
    activeId: 'col',
  },
  {
    id: 'inner-exit-1',
    index: 14,
    narration: 'col is 3: col <= 2 is false — the inner loop ends.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 1, col: 3, p: 2 })],
    heap: [],
    activeId: 'col',
    condition: { ...INNER, result: false },
  },
  {
    id: 'newline-1',
    index: 15,
    narration: 'Print a newline to finish the first row.',
    highlightedLines: [15],
    stack: [mainFrame({ row: 1, col: 3, p: 2 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 '],
  },
  {
    id: 'outer-incr',
    index: 16,
    narration: 'row++ → row is 2.',
    highlightedLines: [10],
    stack: [mainFrame({ row: 2, col: 3, p: 2 })],
    heap: [],
    activeId: 'row',
  },
  {
    id: 'outer-check-2',
    index: 17,
    narration: 'row is 2: row <= 2 is true — second outer pass.',
    highlightedLines: [10],
    stack: [mainFrame({ row: 2, col: 3, p: 2 })],
    heap: [],
    activeId: 'row',
    condition: { ...OUTER, result: true },
  },
  {
    id: 'inner-init-2',
    index: 18,
    narration: 'The inner loop restarts: col is reset to 1.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 2, col: 1, p: 2 })],
    heap: [],
    activeId: 'col',
  },
  {
    id: 'inner-check-2a',
    index: 19,
    narration: 'col is 1: col <= 2 is true.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 2, col: 1, p: 2 })],
    heap: [],
    activeId: 'col',
    condition: { ...INNER, result: true },
  },
  {
    id: 'call-2a',
    index: 20,
    narration: 'Call product(2, 1).',
    highlightedLines: [12, 3],
    stack: [mainFrame({ row: 2, col: 1, p: 2 }), productFrame(2, 2, 1)],
    heap: [],
    activeId: 'pr2',
  },
  {
    id: 'ret-2a',
    index: 21,
    narration: 'product returns 2 * 1 = 2; p stays 2.',
    highlightedLines: [12],
    stack: [mainFrame({ row: 2, col: 1, p: 2 })],
    heap: [],
    activeId: 'p',
  },
  {
    id: 'print-2a',
    index: 22,
    narration: 'Print p = 2.',
    highlightedLines: [13],
    stack: [mainFrame({ row: 2, col: 1, p: 2 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 ', '2 '],
  },
  {
    id: 'inner-incr-2a',
    index: 23,
    narration: 'col++ → col is 2.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 2, col: 2, p: 2 })],
    heap: [],
    activeId: 'col',
  },
  {
    id: 'inner-check-2b',
    index: 24,
    narration: 'col is 2: col <= 2 is true.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 2, col: 2, p: 2 })],
    heap: [],
    activeId: 'col',
    condition: { ...INNER, result: true },
  },
  {
    id: 'call-2b',
    index: 25,
    narration: 'Call product(2, 2).',
    highlightedLines: [12, 3],
    stack: [mainFrame({ row: 2, col: 2, p: 2 }), productFrame(3, 2, 2)],
    heap: [],
    activeId: 'pr3',
  },
  {
    id: 'ret-2b',
    index: 26,
    narration: 'product returns 2 * 2 = 4; p becomes 4.',
    highlightedLines: [12],
    stack: [mainFrame({ row: 2, col: 2, p: 4 })],
    heap: [],
    activeId: 'p',
  },
  {
    id: 'print-2b',
    index: 27,
    narration: 'Print p = 4.',
    highlightedLines: [13],
    stack: [mainFrame({ row: 2, col: 2, p: 4 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 ', '2 4 '],
  },
  {
    id: 'inner-incr-2b',
    index: 28,
    narration: 'col++ → col is 3.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 2, col: 3, p: 4 })],
    heap: [],
    activeId: 'col',
  },
  {
    id: 'inner-exit-2',
    index: 29,
    narration: 'col is 3: col <= 2 is false — the inner loop ends.',
    highlightedLines: [11],
    stack: [mainFrame({ row: 2, col: 3, p: 4 })],
    heap: [],
    activeId: 'col',
    condition: { ...INNER, result: false },
  },
  {
    id: 'newline-2',
    index: 30,
    narration: 'Print a newline to finish the second row.',
    highlightedLines: [15],
    stack: [mainFrame({ row: 2, col: 3, p: 4 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 ', '2 4 '],
  },
  {
    id: 'outer-incr-2',
    index: 31,
    narration: 'row++ → row is 3.',
    highlightedLines: [10],
    stack: [mainFrame({ row: 3, col: 3, p: 4 })],
    heap: [],
    activeId: 'row',
  },
  {
    id: 'outer-exit',
    index: 32,
    narration: 'row is 3: row <= 2 is false — the outer loop ends.',
    highlightedLines: [10],
    stack: [mainFrame({ row: 3, col: 3, p: 4 })],
    heap: [],
    activeId: 'row',
    condition: { ...OUTER, result: false },
  },
  {
    id: 'return',
    index: 33,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [17],
    stack: [mainFrame({ row: 3, col: 3, p: 4 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 ', '2 4 '],
  },
];

export const areaTableTrace: Trace = {
  id: 'se200-more-functions-loops',
  title: 'A function inside nested loops',
  course: 'SE 200',
  topic: 'More Functions, More Nested Loops',
  file: 'table.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: More Functions, More Nested Loops'],
};
