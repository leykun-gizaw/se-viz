/**
 * Validation fixture 3 — pointer arithmetic over an array (PDF screen 03): `int x = *(p + 2)`.
 *
 * Exercises: a contiguous `int[5]` with shared borders and ascending addresses, a pointer `p`
 * sitting on an element, and the `*(p + 2)` arc with the byte-offset annotation showing the correct
 * address math (`0x5004 + 2×4 = 0x500c`).
 *
 * Breadcrumb (SE 200 · Pointers) is correct per docs/CURRICULUM.md. Address math is exact:
 * `sizeof(int) == 4`, so `p + 2` advances 8 bytes from `arr[1]` (0x5004) to `arr[3]` (0x500c) = 40.
 */
import type { ArrayCell, ScalarCell, StackFrame, Step, Trace } from '../../engine/trace/types.ts';

const SOURCE = `int arr[5] = {10, 20, 30, 40, 50};

int *p = &arr[1];      // p -> 0x5004

int x = *(p + 2);
    // +2 elements = +8 bytes
    // p + 2 -> 0x500c

printf("%d\\n", x);    // 40
`;

const VALUES = [10, 20, 30, 40, 50];
const BASE = 0x5000;

function toHex(n: number): string {
  return '0x' + n.toString(16);
}

/** The `arr` array cell: five contiguous ints at ascending 4-byte addresses. */
function arrCell(): ArrayCell {
  const elements: ScalarCell[] = VALUES.map((v, i) => ({
    kind: 'scalar',
    id: `arr.${i}`,
    name: '',
    type: 'int',
    value: v,
    address: toHex(BASE + i * 4),
  }));
  return { kind: 'array', id: 'arr', name: 'arr', type: 'int[5]', address: toHex(BASE), elements };
}

/** main() with arr, p (→ arr[1]) and x (the result). */
function frame(x: ScalarCell['value']): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    address: '0x7ffd2000',
    variables: [
      arrCell(),
      {
        kind: 'pointer',
        id: 'p',
        name: 'p',
        type: 'int *',
        target: 'arr.1',
        display: '0x5004',
        address: '0x7ffd2018',
      },
      { kind: 'scalar', id: 'x', name: 'x', type: 'int', value: x, address: '0x7ffd2014' },
    ],
  };
}

const ARITH_ANNOTATION = {
  id: 'pplus2',
  fromId: 'arr.1',
  toId: 'arr.3',
  label: 'p + 2 = 0x5004 + 2×4 = 0x500c',
};

const steps: Step[] = [
  {
    id: 'declare-arr',
    index: 0,
    narration: 'arr is a contiguous block of five ints; each int is 4 bytes, addresses ascending.',
    highlightedLines: [1],
    stack: [frame(null)],
    heap: [],
    activeId: 'arr.0',
  },
  {
    id: 'point-p',
    index: 1,
    narration: 'p = &arr[1] makes p hold 0x5004 — the address of arr[1].',
    highlightedLines: [3],
    stack: [frame(null)],
    heap: [],
    activeId: 'arr.1',
  },
  {
    id: 'compute-offset',
    index: 2,
    narration:
      "p + 2 doesn't add 2 — it adds 2 × sizeof(int) = 8 bytes. From 0x5004 that lands on arr[3].",
    highlightedLines: [5],
    stack: [frame(null)],
    heap: [],
    activeId: 'arr.3',
    annotations: [ARITH_ANNOTATION],
  },
  {
    id: 'assign-x',
    index: 3,
    narration: '*(p + 2) reads arr[3], so x receives 40.',
    highlightedLines: [5],
    stack: [frame(40)],
    heap: [],
    activeId: 'x',
  },
  {
    id: 'print',
    index: 4,
    narration: 'printf writes 40 to standard output.',
    highlightedLines: [9],
    stack: [frame(40)],
    heap: [],
    activeId: 'x',
    stdout: ['40'],
  },
];

export const pointerArithTrace: Trace = {
  id: 'fixture-pointer-arith',
  title: 'Pointer arithmetic — *(p + 2)',
  course: 'SE 200',
  topic: 'Pointers',
  file: 'arith.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: More Pointers, Arrays and Strings'],
};
