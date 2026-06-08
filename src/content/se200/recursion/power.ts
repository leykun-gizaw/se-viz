/**
 * SE 200 · Recursion (week 5) — power(b, e): linear recursion that multiplies on the way back up.
 *
 * `power(b, e) = b * power(b, e - 1)`, base case `e == 0 → 1`. Each call pushes a new `power` frame
 * with its own `e` (distinct frame ids per activation); the stack grows to the base case, then each
 * frame multiplies `b` by the value returned from below as it unwinds — the same shape as factorial.
 *
 * Hand-traced: power(2, 3) = 2 * 2 * 2 * 1 = 8.
 *   power(2,3)=2*power(2,2); power(2,2)=2*power(2,1); power(2,1)=2*power(2,0); power(2,0)=1 (base).
 *   Unwind: power(2,1)=2*1=2; power(2,2)=2*2=4; power(2,3)=2*4=8.
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

int power(int b, int e) {
    if (e == 0)
        return 1;
    return b * power(b, e - 1);
}

int main(void) {
    int result = power(2, 3);
    printf("%d\\n", result);
    return 0;
}
`;

const FRAME_ADDR = ['0x7ffee570', '0x7ffee540', '0x7ffee510', '0x7ffee4e0', '0x7ffee4b0'];

function intCell(id: string, name: string, value: ScalarCell['value'], addr: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address: addr };
}

/** A `power` activation at depth `d` (1..4): its own `e`, the constant `b = 2`, and a (pending) return. */
function powFrame(d: number, e: number, ret: ScalarCell['value']): StackFrame {
  const addr = FRAME_ADDR[d];
  const base = addr.slice(0, -1);
  return {
    id: `pow${e}`,
    name: 'power',
    callId: d,
    address: addr,
    variables: [
      intCell(`pow${e}.b`, 'b', 2, base + '0'),
      intCell(`pow${e}.e`, 'e', e, base + '4'),
      intCell(`pow${e}.ret`, 'return', ret, addr),
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

const P3 = '2 * power(2, 2)';
const P2 = '2 * power(2, 1)';
const P1 = '2 * power(2, 0)';
const COND = { expr: 'e == 0' };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main is about to call power(2, 3).',
    highlightedLines: [10],
    stack: [mainFrame(null)],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'call-3',
    index: 1,
    narration: 'power(2, 3): e is 3, so e == 0 is false. It will return 2 * power(2, 2).',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), powFrame(1, 3, P3)],
    heap: [],
    activeId: 'pow3',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-2',
    index: 2,
    narration: 'power(2, 2): still not the base case — push a frame for power(2, 1).',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), powFrame(1, 3, P3), powFrame(2, 2, P2)],
    heap: [],
    activeId: 'pow2',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-1',
    index: 3,
    narration: 'power(2, 1): not yet — push a frame for power(2, 0).',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), powFrame(1, 3, P3), powFrame(2, 2, P2), powFrame(3, 1, P1)],
    heap: [],
    activeId: 'pow1',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-0',
    index: 4,
    narration: 'power(2, 0): now e is 0, so e == 0 is true — the base case. Recursion stops.',
    highlightedLines: [4],
    stack: [
      mainFrame(null),
      powFrame(1, 3, P3),
      powFrame(2, 2, P2),
      powFrame(3, 1, P1),
      powFrame(4, 0, null),
    ],
    heap: [],
    activeId: 'pow0',
    condition: { ...COND, result: true },
    coach: {
      variant: 'idea',
      title: 'The base case',
      body: 'Anything to the power 0 is 1 — power(2, 0) returns 1 directly, with no further call. That seed is what the multiplications build on as the stack unwinds.',
      anchorId: 'pow0',
    },
  },
  {
    id: 'base-case',
    index: 5,
    narration: 'power(2, 0) returns 1 (the seed). The deepest frame is done; the stack unwinds.',
    highlightedLines: [5],
    stack: [
      mainFrame(null),
      powFrame(1, 3, P3),
      powFrame(2, 2, P2),
      powFrame(3, 1, P1),
      powFrame(4, 0, 1),
    ],
    heap: [],
    activeId: 'pow0',
  },
  {
    id: 'unwind-1',
    index: 6,
    narration: 'power(2, 0) returned 1, so power(2, 1) resolves 2 * 1 = 2 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), powFrame(1, 3, P3), powFrame(2, 2, P2), powFrame(3, 1, 2)],
    heap: [],
    activeId: 'pow1',
  },
  {
    id: 'unwind-2',
    index: 7,
    narration: 'power(2, 1) returned 2, so power(2, 2) resolves 2 * 2 = 4 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), powFrame(1, 3, P3), powFrame(2, 2, 4)],
    heap: [],
    activeId: 'pow2',
  },
  {
    id: 'unwind-3',
    index: 8,
    narration: 'power(2, 2) returned 4, so power(2, 3) resolves 2 * 4 = 8 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), powFrame(1, 3, 8)],
    heap: [],
    activeId: 'pow3',
  },
  {
    id: 'assign-result',
    index: 9,
    narration: 'power(2, 3) returned 8, which is stored in result.',
    highlightedLines: [10],
    stack: [mainFrame(8)],
    heap: [],
    activeId: 'main.result',
  },
  {
    id: 'print',
    index: 10,
    narration: 'printf writes 8 to the console.',
    highlightedLines: [11],
    stack: [mainFrame(8)],
    heap: [],
    activeId: 'main.result',
    stdout: ['8'],
  },
  {
    id: 'return',
    index: 11,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [12],
    stack: [mainFrame(8)],
    heap: [],
    activeId: 'main',
    stdout: ['8'],
  },
];

export const powerTrace: Trace = {
  id: 'se200-power',
  title: 'power(b, e) — linear recursion, multiply on unwind',
  course: 'SE 200',
  topic: 'Recursion',
  file: 'power.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Recursion'],
};

const contentModule: ContentModule = {
  trace: powerTrace,
  label: 'power(b, e)',
  summary: 'Linear recursion: frames grow to e == 0, then each multiplies b on the way back up.',
  order: 84,
};
export default contentModule;
