/**
 * SE 200 · Recursion (week 5) — tree recursion: fibonacci(n).
 *
 * fib makes **two** recursive calls per frame, so the call stack follows **depth-first call order**:
 * at any moment only the current path is live. A frame evaluates its left call fully (pushing and
 * popping a whole subtree) before starting its right call. Each return is a pending expression
 * (`fib(3) + fib(2)` → `2 + fib(2)` → `3`) that resolves and pulses.
 *
 * This also motivates **repeated subproblems**: fib(2) is computed twice from scratch (activations
 * fib2 and fib6), which is why naïve fibonacci is slow.
 *
 * Exact DFS activation order for fib(4) (fib(0)=0, fib(1)=1):
 *   fib(4)[a0] → fib(3)[a1] → fib(2)[a2] → fib(1)[a3]=1, fib(0)[a4]=0 ⇒ fib(2)=1;
 *               fib(1)[a5]=1 ⇒ fib(3)=2;
 *             → fib(2)[a6] → fib(1)[a7]=1, fib(0)[a8]=0 ⇒ fib(2)=1 ⇒ fib(4)=2+1=3.
 *
 * Hand-traced result: fib(4) = 3.
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

int fib(int n) {
    if (n < 2)
        return n;
    return fib(n - 1) + fib(n - 2);
}

int main(void) {
    int result = fib(4);
    printf("%d\\n", result);
    return 0;
}
`;

/** Frame address by stack depth — reused when a frame at a depth pops and another pushes there. */
const ADDR = ['0x7ffee570', '0x7ffee540', '0x7ffee510', '0x7ffee4e0', '0x7ffee4b0'];

function intCell(id: string, name: string, value: ScalarCell['value'], addr: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address: addr };
}

/** A `fib` activation `a` (its unique id) computing fib(`n`), drawn at stack `depth`. */
function fib(a: number, n: number, depth: number, ret: ScalarCell['value']): StackFrame {
  const addr = ADDR[depth];
  return {
    id: `fib${a}`,
    name: 'fib',
    callId: a,
    address: addr,
    variables: [
      intCell(`fib${a}.n`, 'n', n, addr.slice(0, -1) + '4'),
      intCell(`fib${a}.ret`, 'return', ret, addr),
    ],
  };
}

function mainFrame(result: ScalarCell['value']): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    address: ADDR[0],
    variables: [intCell('main.result', 'result', result, '0x7ffee574')],
  };
}

const COND = { expr: 'n < 2' };
const A0 = 'fib(3) + fib(2)';
const A1 = 'fib(2) + fib(1)';
const SUB = 'fib(1) + fib(0)';

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main is about to call fib(4).',
    highlightedLines: [9],
    stack: [mainFrame(null)],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'call-4',
    index: 1,
    narration:
      'fib(4): 4 is not < 2, so it returns fib(3) + fib(2). It evaluates the left call, fib(3), first.',
    highlightedLines: [10, 6],
    stack: [mainFrame(null), fib(0, 4, 1, A0)],
    heap: [],
    activeId: 'fib0',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-3',
    index: 2,
    narration: 'fib(3): returns fib(2) + fib(1). Evaluate fib(2) first.',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, A0), fib(1, 3, 2, A1)],
    heap: [],
    activeId: 'fib1',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-2a',
    index: 3,
    narration: 'fib(2): returns fib(1) + fib(0). Evaluate fib(1) first.',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, A0), fib(1, 3, 2, A1), fib(2, 2, 3, SUB)],
    heap: [],
    activeId: 'fib2',
    condition: { ...COND, result: false },
  },
  {
    id: 'base-1a',
    index: 4,
    narration: 'fib(1): 1 < 2 is true — base case — returns 1.',
    highlightedLines: [4, 5],
    stack: [
      mainFrame(null),
      fib(0, 4, 1, A0),
      fib(1, 3, 2, A1),
      fib(2, 2, 3, SUB),
      fib(3, 1, 4, 1),
    ],
    heap: [],
    activeId: 'fib3',
    condition: { ...COND, result: true },
  },
  {
    id: 'left-2a',
    index: 5,
    narration: 'fib(1) returned 1. Back in fib(2): now evaluate the right call, fib(0).',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, A0), fib(1, 3, 2, A1), fib(2, 2, 3, '1 + fib(0)')],
    heap: [],
    activeId: 'fib2',
  },
  {
    id: 'base-0a',
    index: 6,
    narration: 'fib(0): base case — returns 0.',
    highlightedLines: [4, 5],
    stack: [
      mainFrame(null),
      fib(0, 4, 1, A0),
      fib(1, 3, 2, A1),
      fib(2, 2, 3, '1 + fib(0)'),
      fib(4, 0, 4, 0),
    ],
    heap: [],
    activeId: 'fib4',
    condition: { ...COND, result: true },
  },
  {
    id: 'resolve-2a',
    index: 7,
    narration: 'fib(0) returned 0, so fib(2) = 1 + 0 = 1 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, A0), fib(1, 3, 2, A1), fib(2, 2, 3, 1)],
    heap: [],
    activeId: 'fib2',
  },
  {
    id: 'left-3',
    index: 8,
    narration: 'fib(2) returned 1. Back in fib(3): now evaluate the right call, fib(1).',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, A0), fib(1, 3, 2, '1 + fib(1)')],
    heap: [],
    activeId: 'fib1',
  },
  {
    id: 'base-1b',
    index: 9,
    narration: 'fib(1): base case — returns 1.',
    highlightedLines: [4, 5],
    stack: [mainFrame(null), fib(0, 4, 1, A0), fib(1, 3, 2, '1 + fib(1)'), fib(5, 1, 3, 1)],
    heap: [],
    activeId: 'fib5',
    condition: { ...COND, result: true },
  },
  {
    id: 'resolve-3',
    index: 10,
    narration: 'fib(1) returned 1, so fib(3) = 1 + 1 = 2 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, A0), fib(1, 3, 2, 2)],
    heap: [],
    activeId: 'fib1',
  },
  {
    id: 'left-4',
    index: 11,
    narration:
      'fib(3) returned 2. Back in fib(4): now evaluate the right call, fib(2). Notice fib(2) is computed all over again — a repeated subproblem, which is why naïve fib is slow.',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, '2 + fib(2)')],
    heap: [],
    activeId: 'fib0',
  },
  {
    id: 'call-2b',
    index: 12,
    narration: 'fib(2): the same work as before — return fib(1) + fib(0).',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, '2 + fib(2)'), fib(6, 2, 2, SUB)],
    heap: [],
    activeId: 'fib6',
    condition: { ...COND, result: false },
  },
  {
    id: 'base-1c',
    index: 13,
    narration: 'fib(1): base case — returns 1.',
    highlightedLines: [4, 5],
    stack: [mainFrame(null), fib(0, 4, 1, '2 + fib(2)'), fib(6, 2, 2, SUB), fib(7, 1, 3, 1)],
    heap: [],
    activeId: 'fib7',
    condition: { ...COND, result: true },
  },
  {
    id: 'left-2b',
    index: 14,
    narration: 'fib(1) returned 1. Now evaluate fib(0).',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, '2 + fib(2)'), fib(6, 2, 2, '1 + fib(0)')],
    heap: [],
    activeId: 'fib6',
  },
  {
    id: 'base-0b',
    index: 15,
    narration: 'fib(0): base case — returns 0.',
    highlightedLines: [4, 5],
    stack: [
      mainFrame(null),
      fib(0, 4, 1, '2 + fib(2)'),
      fib(6, 2, 2, '1 + fib(0)'),
      fib(8, 0, 3, 0),
    ],
    heap: [],
    activeId: 'fib8',
    condition: { ...COND, result: true },
  },
  {
    id: 'resolve-2b',
    index: 16,
    narration: 'fib(0) returned 0, so this fib(2) = 1 + 0 = 1 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, '2 + fib(2)'), fib(6, 2, 2, 1)],
    heap: [],
    activeId: 'fib6',
  },
  {
    id: 'resolve-4',
    index: 17,
    narration: 'fib(2) returned 1, so fib(4) = 2 + 1 = 3 and returns.',
    highlightedLines: [6],
    stack: [mainFrame(null), fib(0, 4, 1, 3)],
    heap: [],
    activeId: 'fib0',
  },
  {
    id: 'assign-result',
    index: 18,
    narration: 'fib(4) returned 3, stored in result.',
    highlightedLines: [10],
    stack: [mainFrame(3)],
    heap: [],
    activeId: 'main.result',
  },
  {
    id: 'print',
    index: 19,
    narration: 'printf writes 3 to the console.',
    highlightedLines: [11],
    stack: [mainFrame(3)],
    heap: [],
    activeId: 'main.result',
    stdout: ['3'],
  },
  {
    id: 'return',
    index: 20,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [12],
    stack: [mainFrame(3)],
    heap: [],
    activeId: 'main',
    stdout: ['3'],
  },
];

export const fibonacciTrace: Trace = {
  id: 'se200-fibonacci',
  title: 'fibonacci(n) — tree recursion',
  course: 'SE 200',
  topic: 'Recursion',
  file: 'fib.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Recursion'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: fibonacciTrace,
  label: 'fibonacci(n)',
  summary: 'Tree recursion (two calls): depth-first order; fib(2) recomputed.',
  order: 83,
};
export default contentModule;
