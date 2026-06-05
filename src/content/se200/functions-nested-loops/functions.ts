/**
 * SE 200 · Functions and Nested Loops (week 2) — part 1: functions (call & return).
 *
 * main calls `square` twice. Each call pushes a frame (the argument is copied into the parameter
 * `x`), computes a return value, and the value is assigned back into a local in main when the frame
 * pops. Reuses the Phase 1 stack rendering.
 *
 * Hand-traced: square(4) = 4 * 4 = 16; square(7) = 7 * 7 = 49. Prints "16 49".
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

int square(int x)
{
    return x * x;
}

int main(void)
{
    int a = square(4);
    int b = square(7);
    printf("%d %d\\n", a, b);
    return 0;
}
`;

function intCell(id: string, name: string, value: number | null, address: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address };
}

function mainFrame(opts: { a?: number; b?: number }): StackFrame {
  const vars: ScalarCell[] = [];
  if (opts.a !== undefined) vars.push(intCell('a', 'a', opts.a, '0x7ffd2008'));
  if (opts.b !== undefined) vars.push(intCell('b', 'b', opts.b, '0x7ffd2004'));
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd2000', variables: vars };
}

/** A `square` activation. `ret` is null until the return value is computed. */
function squareFrame(callId: number, x: number, ret: number | null): StackFrame {
  return {
    id: `sq${callId}`,
    name: 'square',
    callId,
    address: '0x7ffd1fd0',
    variables: [
      intCell(`sq${callId}.x`, 'x', x, '0x7ffd1fd4'),
      intCell(`sq${callId}.ret`, 'return', ret, '0x7ffd1fd0'),
    ],
  };
}

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins. It will compute square(4) and square(7).',
    highlightedLines: [8],
    stack: [mainFrame({})],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'call-a',
    index: 1,
    narration:
      'main calls square(4). A new frame is pushed and the argument 4 is copied into the parameter x.',
    highlightedLines: [10, 3],
    stack: [mainFrame({}), squareFrame(0, 4, null)],
    heap: [],
    activeId: 'sq0',
  },
  {
    id: 'return-a',
    index: 2,
    narration: 'Inside square: return x * x = 4 * 4 = 16.',
    highlightedLines: [5],
    stack: [mainFrame({}), squareFrame(0, 4, 16)],
    heap: [],
    activeId: 'sq0.ret',
  },
  {
    id: 'assign-a',
    index: 3,
    narration: 'square returns; its frame is popped and the value 16 is stored in a.',
    highlightedLines: [10],
    stack: [mainFrame({ a: 16 })],
    heap: [],
    activeId: 'a',
  },
  {
    id: 'call-b',
    index: 4,
    narration: 'main calls square(7); 7 is copied into x in a fresh square frame.',
    highlightedLines: [11, 3],
    stack: [mainFrame({ a: 16 }), squareFrame(1, 7, null)],
    heap: [],
    activeId: 'sq1',
  },
  {
    id: 'return-b',
    index: 5,
    narration: 'Inside square: return x * x = 7 * 7 = 49.',
    highlightedLines: [5],
    stack: [mainFrame({ a: 16 }), squareFrame(1, 7, 49)],
    heap: [],
    activeId: 'sq1.ret',
  },
  {
    id: 'assign-b',
    index: 6,
    narration: 'The square frame pops and 49 is stored in b.',
    highlightedLines: [11],
    stack: [mainFrame({ a: 16, b: 49 })],
    heap: [],
    activeId: 'b',
  },
  {
    id: 'print',
    index: 7,
    narration: 'Print a and b: "16 49".',
    highlightedLines: [12],
    stack: [mainFrame({ a: 16, b: 49 })],
    heap: [],
    activeId: 'main',
    stdout: ['16 49'],
  },
  {
    id: 'return',
    index: 8,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [13],
    stack: [mainFrame({ a: 16, b: 49 })],
    heap: [],
    activeId: 'main',
    stdout: ['16 49'],
  },
];

export const functionsTrace: Trace = {
  id: 'se200-functions',
  title: 'Functions — call & return',
  course: 'SE 200',
  topic: 'Functions and Nested Loops',
  file: 'square.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Functions and Nested Loops'],
};
