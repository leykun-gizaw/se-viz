/**
 * SE 200 · More Pointers, Arrays and Strings (week 4) — pass-by-pointer (the marquee "why pointers"
 * example).
 *
 * swap receives the *addresses* of main's x and y. Its parameters a and b are pointers that reach
 * **across the frame boundary** into main's frame, so writing through them mutates main's variables
 * — and you can see x and y pulse in main. With pass-by-value (plain ints) the swap would only touch
 * copies and main would be unchanged; pass-by-pointer is what makes it stick.
 *
 * Hand-traced: x=3, y=7; tmp = *a = 3; *a = *b ⇒ x = 7; *b = tmp ⇒ y = 3. Result: x=7, y=3.
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

void swap(int *a, int *b)
{
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

int main(void)
{
    int x = 3;
    int y = 7;
    swap(&x, &y);
    printf("%d %d\\n", x, y);
    return 0;
}
`;

const ADDR = { x: '0x7ffd0010', y: '0x7ffd0014' } as const;

function intCell(id: string, name: string, value: number | null, address: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address };
}

function mainFrame(opts: { x?: number; y?: number }): StackFrame {
  const vars: ScalarCell[] = [];
  if (opts.x !== undefined) vars.push(intCell('x', 'x', opts.x, ADDR.x));
  if (opts.y !== undefined) vars.push(intCell('y', 'y', opts.y, ADDR.y));
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd0000', variables: vars };
}

/** swap() frame: a → main.x, b → main.y, plus tmp. */
function swapFrame(tmp: number | null): StackFrame {
  return {
    id: 'swap',
    name: 'swap',
    callId: 0,
    address: '0x7ffd0fd0',
    variables: [
      {
        kind: 'pointer',
        id: 'a',
        name: 'a',
        type: 'int *',
        target: 'x',
        display: ADDR.x,
        address: '0x7ffd0fd0',
      },
      {
        kind: 'pointer',
        id: 'b',
        name: 'b',
        type: 'int *',
        target: 'y',
        display: ADDR.y,
        address: '0x7ffd0fd4',
      },
      intCell('tmp', 'tmp', tmp, '0x7ffd0fd8'),
    ],
  };
}

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [10],
    stack: [mainFrame({})],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'decl-x',
    index: 1,
    narration: 'x = 3.',
    highlightedLines: [12],
    stack: [mainFrame({ x: 3 })],
    heap: [],
    activeId: 'x',
  },
  {
    id: 'decl-y',
    index: 2,
    narration: 'y = 7.',
    highlightedLines: [13],
    stack: [mainFrame({ x: 3, y: 7 })],
    heap: [],
    activeId: 'y',
  },
  {
    id: 'call',
    index: 3,
    narration:
      'swap(&x, &y) passes the addresses of x and y. The parameters a and b are pointers aimed across the frame boundary into main — a → x, b → y.',
    highlightedLines: [14, 3],
    stack: [mainFrame({ x: 3, y: 7 }), swapFrame(null)],
    heap: [],
    activeId: 'swap',
  },
  {
    id: 'tmp',
    index: 4,
    narration: 'tmp = *a reads through a into main’s x: tmp = 3.',
    highlightedLines: [5],
    stack: [mainFrame({ x: 3, y: 7 }), swapFrame(3)],
    heap: [],
    activeId: 'tmp',
  },
  {
    id: 'write-a',
    index: 5,
    narration:
      '*a = *b writes through a into main’s x: *b is 7, so x becomes 7. The change happens in main’s frame, not swap’s.',
    highlightedLines: [6],
    stack: [mainFrame({ x: 7, y: 7 }), swapFrame(3)],
    heap: [],
    activeId: 'x',
  },
  {
    id: 'write-b',
    index: 6,
    narration: '*b = tmp writes 3 into main’s y. x and y are now swapped.',
    highlightedLines: [7],
    stack: [mainFrame({ x: 7, y: 3 }), swapFrame(3)],
    heap: [],
    activeId: 'y',
  },
  {
    id: 'return-swap',
    index: 7,
    narration:
      'swap returns and its frame is gone — but main’s x and y stayed swapped. That is why pass-by-pointer works.',
    highlightedLines: [8],
    stack: [mainFrame({ x: 7, y: 3 })],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'print',
    index: 8,
    narration: 'Print x and y: "7 3".',
    highlightedLines: [15],
    stack: [mainFrame({ x: 7, y: 3 })],
    heap: [],
    activeId: 'x',
    stdout: ['7 3'],
  },
  {
    id: 'return',
    index: 9,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [16],
    stack: [mainFrame({ x: 7, y: 3 })],
    heap: [],
    activeId: 'main',
    stdout: ['7 3'],
  },
];

export const swapTrace: Trace = {
  id: 'se200-swap',
  title: 'Pass-by-pointer — swap(&x, &y)',
  course: 'SE 200',
  topic: 'More Pointers, Arrays and Strings',
  file: 'swap.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: More Pointers, Arrays and Strings'],
};
