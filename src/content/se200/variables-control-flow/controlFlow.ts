/**
 * SE 200 · Variables, if / else, while (week 1) — the core control-flow module.
 *
 * One program that declares scalars, takes an if/else branch (and shows *why*), and runs a while
 * loop that visibly iterates: each pass re-evaluates the condition (shown as a chip), runs the body
 * with the counter and accumulator pulsing as they change, and loops back until the condition is
 * false.
 *
 * Hand-traced correctness (n = 4):
 *   n % 2 == 0  →  4 % 2 == 0  →  true   ⇒ the `if` branch runs, prints "even".
 *   while (i <= n): i=1 sum=1, i=2 sum=3, i=3 sum=6, i=4 sum=10, i=5 → 5 <= 4 false ⇒ exit.
 *   Final: sum = 1 + 2 + 3 + 4 = 10. Prints "sum = 10".
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

int main(void)
{
    int n = 4;
    int sum = 0;

    if (n % 2 == 0)
        printf("even\\n");
    else
        printf("odd\\n");

    int i = 1;
    while (i <= n) {
        sum = sum + i;
        i = i + 1;
    }

    printf("sum = %d\\n", sum);
    return 0;
}
`;

const N = 4;

function intCell(id: string, name: string, value: number | null, address: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address };
}

/** main() frame holding whichever of n / sum / i exist so far. */
function frame(opts: { sum?: number; i?: number }): StackFrame {
  const vars: ScalarCell[] = [intCell('n', 'n', N, '0x7ffd1004')];
  if (opts.sum !== undefined) vars.push(intCell('sum', 'sum', opts.sum, '0x7ffd1008'));
  if (opts.i !== undefined) vars.push(intCell('i', 'i', opts.i, '0x7ffd100c'));
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd1000', variables: vars };
}

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [4],
    stack: [{ id: 'main', name: 'main', callId: 0, address: '0x7ffd1000', variables: [] }],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'decl-n',
    index: 1,
    narration: 'Declare int n and assign 4.',
    highlightedLines: [5],
    stack: [
      {
        id: 'main',
        name: 'main',
        callId: 0,
        address: '0x7ffd1000',
        variables: [intCell('n', 'n', N, '0x7ffd1004')],
      },
    ],
    heap: [],
    activeId: 'n',
  },
  {
    id: 'decl-sum',
    index: 2,
    narration: 'Declare int sum and initialise it to 0 — this will accumulate the loop total.',
    highlightedLines: [6],
    stack: [frame({ sum: 0 })],
    heap: [],
    activeId: 'sum',
  },
  {
    id: 'if-test',
    index: 3,
    narration: 'Evaluate the if condition: n is 4, and 4 % 2 is 0, so n % 2 == 0 is true.',
    highlightedLines: [8],
    stack: [frame({ sum: 0 })],
    heap: [],
    activeId: 'n',
    condition: { expr: 'n % 2 == 0', result: true },
  },
  {
    id: 'if-branch',
    index: 4,
    narration:
      'Because the condition is true, the if branch runs and prints "even". The else line is skipped.',
    highlightedLines: [9],
    stack: [frame({ sum: 0 })],
    heap: [],
    activeId: 'main',
    stdout: ['even'],
  },
  {
    id: 'decl-i',
    index: 5,
    narration: 'Declare the loop counter int i and set it to 1.',
    highlightedLines: [13],
    stack: [frame({ sum: 0, i: 1 })],
    heap: [],
    activeId: 'i',
    stdout: ['even'],
  },
  // ---- iteration 1 (i = 1) ----
  {
    id: 'while-1',
    index: 6,
    narration: 'Check the loop condition: i is 1 and n is 4, so i <= n is true — enter the body.',
    highlightedLines: [14],
    stack: [frame({ sum: 0, i: 1 })],
    heap: [],
    activeId: 'i',
    condition: { expr: 'i <= n', result: true },
    stdout: ['even'],
  },
  {
    id: 'sum-1',
    index: 7,
    narration: 'sum = sum + i = 0 + 1 = 1.',
    highlightedLines: [15],
    stack: [frame({ sum: 1, i: 1 })],
    heap: [],
    activeId: 'sum',
    stdout: ['even'],
  },
  {
    id: 'incr-1',
    index: 8,
    narration: 'i = i + 1 = 2, then loop back to the condition.',
    highlightedLines: [16],
    stack: [frame({ sum: 1, i: 2 })],
    heap: [],
    activeId: 'i',
    stdout: ['even'],
  },
  // ---- iteration 2 (i = 2) ----
  {
    id: 'while-2',
    index: 9,
    narration: 'i is 2, n is 4: i <= n is still true — go around again.',
    highlightedLines: [14],
    stack: [frame({ sum: 1, i: 2 })],
    heap: [],
    activeId: 'i',
    condition: { expr: 'i <= n', result: true },
    stdout: ['even'],
  },
  {
    id: 'sum-2',
    index: 10,
    narration: 'sum = sum + i = 1 + 2 = 3.',
    highlightedLines: [15],
    stack: [frame({ sum: 3, i: 2 })],
    heap: [],
    activeId: 'sum',
    stdout: ['even'],
  },
  {
    id: 'incr-2',
    index: 11,
    narration: 'i = i + 1 = 3.',
    highlightedLines: [16],
    stack: [frame({ sum: 3, i: 3 })],
    heap: [],
    activeId: 'i',
    stdout: ['even'],
  },
  // ---- iteration 3 (i = 3) ----
  {
    id: 'while-3',
    index: 12,
    narration: 'i is 3, n is 4: i <= n is true.',
    highlightedLines: [14],
    stack: [frame({ sum: 3, i: 3 })],
    heap: [],
    activeId: 'i',
    condition: { expr: 'i <= n', result: true },
    stdout: ['even'],
  },
  {
    id: 'sum-3',
    index: 13,
    narration: 'sum = sum + i = 3 + 3 = 6.',
    highlightedLines: [15],
    stack: [frame({ sum: 6, i: 3 })],
    heap: [],
    activeId: 'sum',
    stdout: ['even'],
  },
  {
    id: 'incr-3',
    index: 14,
    narration: 'i = i + 1 = 4.',
    highlightedLines: [16],
    stack: [frame({ sum: 6, i: 4 })],
    heap: [],
    activeId: 'i',
    stdout: ['even'],
  },
  // ---- iteration 4 (i = 4) ----
  {
    id: 'while-4',
    index: 15,
    narration: 'i is 4, n is 4: i <= n is true (4 <= 4) — one last pass.',
    highlightedLines: [14],
    stack: [frame({ sum: 6, i: 4 })],
    heap: [],
    activeId: 'i',
    condition: { expr: 'i <= n', result: true },
    stdout: ['even'],
  },
  {
    id: 'sum-4',
    index: 16,
    narration: 'sum = sum + i = 6 + 4 = 10.',
    highlightedLines: [15],
    stack: [frame({ sum: 10, i: 4 })],
    heap: [],
    activeId: 'sum',
    stdout: ['even'],
  },
  {
    id: 'incr-4',
    index: 17,
    narration: 'i = i + 1 = 5.',
    highlightedLines: [16],
    stack: [frame({ sum: 10, i: 5 })],
    heap: [],
    activeId: 'i',
    stdout: ['even'],
  },
  // ---- loop exit ----
  {
    id: 'while-exit',
    index: 18,
    narration: 'Now i is 5: i <= n is false (5 <= 4 is false) — the loop ends.',
    highlightedLines: [14],
    stack: [frame({ sum: 10, i: 5 })],
    heap: [],
    activeId: 'i',
    condition: { expr: 'i <= n', result: false },
    stdout: ['even'],
  },
  {
    id: 'print-sum',
    index: 19,
    narration: 'Print the result: sum is 10.',
    highlightedLines: [19],
    stack: [frame({ sum: 10, i: 5 })],
    heap: [],
    activeId: 'sum',
    stdout: ['even', 'sum = 10'],
  },
  {
    id: 'return',
    index: 20,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [20],
    stack: [frame({ sum: 10, i: 5 })],
    heap: [],
    activeId: 'main',
    stdout: ['even', 'sum = 10'],
  },
];

export const controlFlowTrace: Trace = {
  id: 'se200-control-flow',
  title: 'Variables, if / else & while',
  course: 'SE 200',
  topic: 'Variables, if, else, while',
  file: 'control.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Variables, if, else, while'],
};
