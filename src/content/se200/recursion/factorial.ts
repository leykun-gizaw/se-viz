/**
 * SE 200 · Recursion (week 5) — factorial(n), the canonical example.
 *
 * Promoted from the Phase 1 validation fixture and refined to curriculum narration quality. Each
 * call pushes a NEW `factorial` frame with its own copy of `n` (distinct frame ids per activation),
 * so several frames are live at once; the stack grows downward (descending addresses) to the base
 * case, then unwinds. Each frame's return is a **pending expression** (e.g. `4 * factorial(3)`) that
 * resolves to a number and green-pulses as its child returns.
 *
 * Hand-traced: factorial(4) = 4 · 3 · 2 · 1 = 24. Base case factorial(1) = 1.
 *
 * @remarks Step ids and cell ids (`fac4.ret`, `unwind-3`, …) are kept stable because the engine's
 * `pulse.test.ts` exercises the unwind pulse against this trace.
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

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

/** Descending frame addresses by stack depth — the stack grows downward. */
const FRAME_ADDR = ['0x7ffee570', '0x7ffee540', '0x7ffee510', '0x7ffee4e0', '0x7ffee4b0'];

function intCell(id: string, name: string, value: ScalarCell['value'], addr: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address: addr };
}

/** A `factorial` activation at depth `d` (1..4) with its own `n` and a (pending) return value. */
function facFrame(d: number, n: number, ret: ScalarCell['value']): StackFrame {
  const addr = FRAME_ADDR[d];
  return {
    id: `fac${n}`,
    name: 'factorial',
    callId: d,
    address: addr,
    variables: [
      intCell(`fac${n}.n`, 'n', n, addr.slice(0, -1) + '4'),
      intCell(`fac${n}.ret`, 'return', ret, addr),
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

const PENDING4 = '4 * factorial(3)';
const PENDING3 = '3 * factorial(2)';
const PENDING2 = '2 * factorial(1)';
const COND = { expr: 'n <= 1' };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main is about to call factorial(4).',
    highlightedLines: [10],
    stack: [mainFrame(null)],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'call-4',
    index: 1,
    narration:
      'factorial(4): n is 4, so n <= 1 is false. It will return 4 * factorial(3) — but first it pushes a new frame to compute factorial(3).',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), facFrame(1, 4, PENDING4)],
    heap: [],
    activeId: 'fac4',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-3',
    index: 2,
    narration:
      'factorial(3): n is 3 — not the base case — so it pushes another frame for factorial(2). The stack grows downward.',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), facFrame(1, 4, PENDING4), facFrame(2, 3, PENDING3)],
    heap: [],
    activeId: 'fac3',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-2',
    index: 3,
    narration: 'factorial(2): still not the base case — push a frame for factorial(1).',
    highlightedLines: [4, 6],
    stack: [
      mainFrame(null),
      facFrame(1, 4, PENDING4),
      facFrame(2, 3, PENDING3),
      facFrame(3, 2, PENDING2),
    ],
    heap: [],
    activeId: 'fac2',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-1',
    index: 4,
    narration:
      'factorial(1): now n is 1, so n <= 1 is true — this is the base case. Recursion stops here.',
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
    condition: { ...COND, result: true },
  },
  {
    id: 'base-case',
    index: 5,
    narration:
      'The base case returns 1 (the seed value). The deepest frame is done; the stack now unwinds from the bottom up.',
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
    narration: 'factorial(1) returned 1, so factorial(2) resolves 2 * 1 = 2 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), facFrame(1, 4, PENDING4), facFrame(2, 3, PENDING3), facFrame(3, 2, 2)],
    heap: [],
    activeId: 'fac2',
  },
  {
    id: 'unwind-3',
    index: 7,
    narration: 'factorial(2) returned 2, so factorial(3) resolves 3 * 2 = 6 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), facFrame(1, 4, PENDING4), facFrame(2, 3, 6)],
    heap: [],
    activeId: 'fac3',
  },
  {
    id: 'unwind-4',
    index: 8,
    narration: 'factorial(3) returned 6, so factorial(4) resolves 4 * 6 = 24 and returns.',
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
    narration: 'printf writes 24 to the console.',
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
  id: 'se200-factorial',
  title: 'factorial(n) — recursion & the call stack',
  course: 'SE 200',
  topic: 'Recursion',
  file: 'factorial.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Recursion'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: factorialTrace,
  label: 'factorial(n)',
  summary: 'The canonical example: nested frames grow to the base case, then unwind.',
  order: 80,
};
export default contentModule;
