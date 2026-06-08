/**
 * SE 200 · Recursion (week 5) — gcd(a, b) by Euclid's algorithm (a flavour of tail recursion).
 *
 * `gcd(a, b) = gcd(b, a % b)`, base case `b == 0 → a`. Unlike factorial/power, nothing is combined on
 * the way back up: the recursive call is in **tail position**, so the base case's value simply
 * propagates up unchanged. Each call pushes a new `gcd` frame with its own `a`, `b`.
 *
 * Hand-traced: gcd(48, 36).
 *   gcd(48,36): b=36≠0 → gcd(36, 48%36=12)
 *   gcd(36,12): b=12≠0 → gcd(12, 36%12=0)
 *   gcd(12, 0): b==0   → return a = 12   (base)
 *   Unwind: 12 returns unchanged through gcd(36,12) and gcd(48,36). Result = 12.
 */
import type { ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

int gcd(int a, int b) {
    if (b == 0)
        return a;
    return gcd(b, a % b);
}

int main(void) {
    int result = gcd(48, 36);
    printf("%d\\n", result);
    return 0;
}
`;

const FRAME_ADDR = ['0x7ffee570', '0x7ffee540', '0x7ffee510', '0x7ffee4e0'];

function intCell(id: string, name: string, value: ScalarCell['value'], addr: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address: addr };
}

/** A `gcd` activation at depth `d` with its own `a`, `b` and a (pending) return. `key` ids the activation. */
function gcdFrame(
  d: number,
  key: string,
  a: number,
  b: number,
  ret: ScalarCell['value'],
): StackFrame {
  const addr = FRAME_ADDR[d];
  const base = addr.slice(0, -1);
  return {
    id: `gcd${key}`,
    name: 'gcd',
    callId: d,
    address: addr,
    variables: [
      intCell(`gcd${key}.a`, 'a', a, base + '0'),
      intCell(`gcd${key}.b`, 'b', b, base + '4'),
      intCell(`gcd${key}.ret`, 'return', ret, addr),
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

const R0 = 'gcd(36, 12)';
const R1 = 'gcd(12, 0)';
const COND = { expr: 'b == 0' };

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main is about to call gcd(48, 36).',
    highlightedLines: [10],
    stack: [mainFrame(null)],
    heap: [],
    activeId: 'main',
  },
  {
    id: 'call-0',
    index: 1,
    narration: 'gcd(48, 36): b is 36, so b == 0 is false. Return gcd(36, 48 % 36) = gcd(36, 12).',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), gcdFrame(1, '0', 48, 36, R0)],
    heap: [],
    activeId: 'gcd0',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-1',
    index: 2,
    narration: 'gcd(36, 12): b is 12 — not zero. Return gcd(12, 36 % 12) = gcd(12, 0).',
    highlightedLines: [4, 6],
    stack: [mainFrame(null), gcdFrame(1, '0', 48, 36, R0), gcdFrame(2, '1', 36, 12, R1)],
    heap: [],
    activeId: 'gcd1',
    condition: { ...COND, result: false },
  },
  {
    id: 'call-2',
    index: 3,
    narration: 'gcd(12, 0): now b is 0, so b == 0 is true — the base case. It returns a = 12.',
    highlightedLines: [4],
    stack: [
      mainFrame(null),
      gcdFrame(1, '0', 48, 36, R0),
      gcdFrame(2, '1', 36, 12, R1),
      gcdFrame(3, '2', 12, 0, null),
    ],
    heap: [],
    activeId: 'gcd2',
    condition: { ...COND, result: true },
    coach: {
      variant: 'idea',
      title: 'Tail recursion',
      body: 'The recursive call is the last thing each gcd does — nothing is combined afterward. So the base case answer (12) just rides back up the stack unchanged, rather than being multiplied or added like factorial.',
      anchorId: 'gcd2',
    },
  },
  {
    id: 'base-case',
    index: 4,
    narration:
      'The base case returns a = 12. The stack now unwinds — the value passes straight up.',
    highlightedLines: [5],
    stack: [
      mainFrame(null),
      gcdFrame(1, '0', 48, 36, R0),
      gcdFrame(2, '1', 36, 12, R1),
      gcdFrame(3, '2', 12, 0, 12),
    ],
    heap: [],
    activeId: 'gcd2',
  },
  {
    id: 'unwind-1',
    index: 5,
    narration: 'gcd(12, 0) returned 12, so gcd(36, 12) returns that same 12 unchanged.',
    highlightedLines: [6],
    stack: [mainFrame(null), gcdFrame(1, '0', 48, 36, R0), gcdFrame(2, '1', 36, 12, 12)],
    heap: [],
    activeId: 'gcd1',
  },
  {
    id: 'unwind-0',
    index: 6,
    narration: 'gcd(36, 12) returned 12, so gcd(48, 36) returns 12 — the answer.',
    highlightedLines: [6],
    stack: [mainFrame(null), gcdFrame(1, '0', 48, 36, 12)],
    heap: [],
    activeId: 'gcd0',
  },
  {
    id: 'assign-result',
    index: 7,
    narration: 'gcd(48, 36) returned 12, which is stored in result.',
    highlightedLines: [10],
    stack: [mainFrame(12)],
    heap: [],
    activeId: 'main.result',
  },
  {
    id: 'print',
    index: 8,
    narration: 'printf writes 12 to the console.',
    highlightedLines: [11],
    stack: [mainFrame(12)],
    heap: [],
    activeId: 'main.result',
    stdout: ['12'],
  },
  {
    id: 'return',
    index: 9,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [12],
    stack: [mainFrame(12)],
    heap: [],
    activeId: 'main',
    stdout: ['12'],
  },
];

export const gcdTrace: Trace = {
  id: 'se200-gcd',
  title: 'gcd(a, b) — Euclid & tail recursion',
  course: 'SE 200',
  topic: 'Recursion',
  file: 'gcd.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Recursion'],
};

const contentModule: ContentModule = {
  trace: gcdTrace,
  label: 'gcd(a, b)',
  summary:
    "Euclid's algorithm: a tail call whose base-case answer rides straight back up the stack.",
  order: 85,
};
export default contentModule;
