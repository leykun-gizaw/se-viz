/**
 * SE 200 · Functions and Nested Loops (week 2) — part 2: nested loops.
 *
 * Two nested for-loops with distinct counters (`i` outer, `j` inner) print a small multiplication
 * grid. The inner loop runs to completion for each outer pass, and `j` visibly resets to 1 each time
 * the outer counter advances.
 *
 * Hand-traced output (i, j each 1..2; cell = i * j):
 *   row i=1: 1*1=1, 1*2=2  → "1 2 "
 *   row i=2: 2*1=2, 2*2=4  → "2 4 "
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

int main(void)
{
    for (int i = 1; i <= 2; i++) {
        for (int j = 1; j <= 2; j++) {
            printf("%d ", i * j);
        }
        printf("\\n");
    }
    return 0;
}
`;

function intCell(id: string, name: string, value: number, address: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address };
}

function frame(opts: { i?: number; j?: number }): StackFrame {
  const vars: ScalarCell[] = [];
  if (opts.i !== undefined) vars.push(intCell('i', 'i', opts.i, '0x7ffd3004'));
  if (opts.j !== undefined) vars.push(intCell('j', 'j', opts.j, '0x7ffd3008'));
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd3000', variables: vars };
}

const OUTER = { expr: 'i <= 2' };
const INNER = { expr: 'j <= 2' };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [3],
    stack: [frame({})],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'outer-init',
    index: 1,
    narration: 'Outer loop: i starts at 1.',
    highlightedLines: [5],
    stack: [frame({ i: 1 })],
    heap: [],
    activeId: 'i',
  },
  {
    id: 'outer-check-1',
    index: 2,
    narration: 'i is 1: i <= 2 is true — enter the outer body.',
    highlightedLines: [5],
    stack: [frame({ i: 1 })],
    heap: [],
    activeId: 'i',
    condition: { ...OUTER, result: true },
  },
  {
    id: 'inner-init-1',
    index: 3,
    narration: 'Inner loop: j starts at 1.',
    highlightedLines: [6],
    stack: [frame({ i: 1, j: 1 })],
    heap: [],
    activeId: 'j',
  },
  {
    id: 'inner-check-1a',
    index: 4,
    narration: 'j is 1: j <= 2 is true — enter the inner body.',
    highlightedLines: [6],
    stack: [frame({ i: 1, j: 1 })],
    heap: [],
    activeId: 'j',
    condition: { ...INNER, result: true },
  },
  {
    id: 'print-1a',
    index: 5,
    narration: 'Print i * j = 1 * 1 = 1.',
    highlightedLines: [7],
    stack: [frame({ i: 1, j: 1 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 '],
  },
  {
    id: 'inner-incr-1a',
    index: 6,
    narration: 'j++ → j is 2.',
    highlightedLines: [6],
    stack: [frame({ i: 1, j: 2 })],
    heap: [],
    activeId: 'j',
  },
  {
    id: 'inner-check-1b',
    index: 7,
    narration: 'j is 2: j <= 2 is true — another inner pass.',
    highlightedLines: [6],
    stack: [frame({ i: 1, j: 2 })],
    heap: [],
    activeId: 'j',
    condition: { ...INNER, result: true },
  },
  {
    id: 'print-1b',
    index: 8,
    narration: 'Print i * j = 1 * 2 = 2.',
    highlightedLines: [7],
    stack: [frame({ i: 1, j: 2 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 '],
  },
  {
    id: 'inner-incr-1b',
    index: 9,
    narration: 'j++ → j is 3.',
    highlightedLines: [6],
    stack: [frame({ i: 1, j: 3 })],
    heap: [],
    activeId: 'j',
  },
  {
    id: 'inner-exit-1',
    index: 10,
    narration: 'j is 3: j <= 2 is false — the inner loop ends.',
    highlightedLines: [6],
    stack: [frame({ i: 1, j: 3 })],
    heap: [],
    activeId: 'j',
    condition: { ...INNER, result: false },
  },
  {
    id: 'newline-1',
    index: 11,
    narration: 'Print a newline to finish the first row.',
    highlightedLines: [9],
    stack: [frame({ i: 1, j: 3 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 '],
  },
  {
    id: 'outer-incr',
    index: 12,
    narration: 'i++ → i is 2.',
    highlightedLines: [5],
    stack: [frame({ i: 2, j: 3 })],
    heap: [],
    activeId: 'i',
  },
  {
    id: 'outer-check-2',
    index: 13,
    narration: 'i is 2: i <= 2 is true — second outer pass.',
    highlightedLines: [5],
    stack: [frame({ i: 2, j: 3 })],
    heap: [],
    activeId: 'i',
    condition: { ...OUTER, result: true },
  },
  {
    id: 'inner-init-2',
    index: 14,
    narration: 'The inner loop restarts: j is reset to 1.',
    highlightedLines: [6],
    stack: [frame({ i: 2, j: 1 })],
    heap: [],
    activeId: 'j',
  },
  {
    id: 'inner-check-2a',
    index: 15,
    narration: 'j is 1: j <= 2 is true.',
    highlightedLines: [6],
    stack: [frame({ i: 2, j: 1 })],
    heap: [],
    activeId: 'j',
    condition: { ...INNER, result: true },
  },
  {
    id: 'print-2a',
    index: 16,
    narration: 'Print i * j = 2 * 1 = 2.',
    highlightedLines: [7],
    stack: [frame({ i: 2, j: 1 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 ', '2 '],
  },
  {
    id: 'inner-incr-2a',
    index: 17,
    narration: 'j++ → j is 2.',
    highlightedLines: [6],
    stack: [frame({ i: 2, j: 2 })],
    heap: [],
    activeId: 'j',
  },
  {
    id: 'inner-check-2b',
    index: 18,
    narration: 'j is 2: j <= 2 is true.',
    highlightedLines: [6],
    stack: [frame({ i: 2, j: 2 })],
    heap: [],
    activeId: 'j',
    condition: { ...INNER, result: true },
  },
  {
    id: 'print-2b',
    index: 19,
    narration: 'Print i * j = 2 * 2 = 4.',
    highlightedLines: [7],
    stack: [frame({ i: 2, j: 2 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 ', '2 4 '],
  },
  {
    id: 'inner-incr-2b',
    index: 20,
    narration: 'j++ → j is 3.',
    highlightedLines: [6],
    stack: [frame({ i: 2, j: 3 })],
    heap: [],
    activeId: 'j',
  },
  {
    id: 'inner-exit-2',
    index: 21,
    narration: 'j is 3: j <= 2 is false — the inner loop ends.',
    highlightedLines: [6],
    stack: [frame({ i: 2, j: 3 })],
    heap: [],
    activeId: 'j',
    condition: { ...INNER, result: false },
  },
  {
    id: 'newline-2',
    index: 22,
    narration: 'Print a newline to finish the second row.',
    highlightedLines: [9],
    stack: [frame({ i: 2, j: 3 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 ', '2 4 '],
  },
  {
    id: 'outer-incr-2',
    index: 23,
    narration: 'i++ → i is 3.',
    highlightedLines: [5],
    stack: [frame({ i: 3, j: 3 })],
    heap: [],
    activeId: 'i',
  },
  {
    id: 'outer-exit',
    index: 24,
    narration: 'i is 3: i <= 2 is false — the outer loop ends.',
    highlightedLines: [5],
    stack: [frame({ i: 3, j: 3 })],
    heap: [],
    activeId: 'i',
    condition: { ...OUTER, result: false },
  },
  {
    id: 'return',
    index: 25,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [11],
    stack: [frame({ i: 3, j: 3 })],
    heap: [],
    activeId: 'main',
    stdout: ['1 2 ', '2 4 '],
  },
];

export const nestedLoopsTrace: Trace = {
  id: 'se200-nested-loops',
  title: 'Nested loops — a multiplication grid',
  course: 'SE 200',
  topic: 'Functions and Nested Loops',
  file: 'grid.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Functions and Nested Loops'],
};
