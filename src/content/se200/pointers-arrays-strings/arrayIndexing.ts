/**
 * SE 200 · Pointers, Arrays and Strings (week 3) — array/pointer duality.
 *
 * Shows that `arr[i]` and `*(arr + i)` are the same thing: both land on the same element at the same
 * address. The array name `arr` behaves as a pointer to the first element, so `arr + 2` is address
 * arithmetic: `0x6000 + 2 × sizeof(int) = 0x6008`, which is exactly `&arr[2]`.
 *
 * Hand-traced: arr = {10,20,30,40}; arr[2] = 30 (@0x6008); *(arr + 2) = 30 (same address). a=b=30.
 */
import type {
  ArrayCell,
  ScalarCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';

const SOURCE = `#include <stdio.h>

int main(void)
{
    int arr[4] = {10, 20, 30, 40};
    int a = arr[2];
    int b = *(arr + 2);
    printf("%d %d\\n", a, b);
    return 0;
}
`;

const VALUES = [10, 20, 30, 40];
const BASE = 0x6000;

function hex(n: number): string {
  return '0x' + n.toString(16);
}

function arrCell(): ArrayCell {
  const elements: ScalarCell[] = VALUES.map((v, i) => ({
    kind: 'scalar',
    id: `arr.${i}`,
    name: '',
    type: 'int',
    value: v,
    address: hex(BASE + i * 4),
  }));
  return { kind: 'array', id: 'arr', name: 'arr', type: 'int[4]', address: hex(BASE), elements };
}

function intCell(id: string, name: string, value: number | null, address: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address };
}

function frame(opts: { a?: number; b?: number }): StackFrame {
  const vars: (ArrayCell | ScalarCell)[] = [arrCell()];
  if (opts.a !== undefined) vars.push(intCell('a', 'a', opts.a, '0x7ffd0020'));
  if (opts.b !== undefined) vars.push(intCell('b', 'b', opts.b, '0x7ffd0024'));
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd0000', variables: vars };
}

const steps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration: 'main begins.',
    highlightedLines: [4],
    stack: [frame({})],
    heap: [],
    activeId: 'arr.0',
  },
  {
    id: 'declare',
    index: 1,
    narration:
      'arr is four contiguous ints. Each int is 4 bytes, so the addresses ascend by 4: 0x6000, 0x6004, 0x6008, 0x600c.',
    highlightedLines: [5],
    stack: [frame({})],
    heap: [],
    activeId: 'arr.0',
  },
  {
    id: 'index',
    index: 2,
    narration:
      'arr[2] selects the element at index 2 — value 30, at address 0x6008 — and copies it into a.',
    highlightedLines: [6],
    stack: [frame({ a: 30 })],
    heap: [],
    activeId: 'arr.2',
  },
  {
    id: 'pointer-form',
    index: 3,
    narration:
      '*(arr + 2) computes the same address (0x6000 + 2 × 4 = 0x6008) and reads the same element, 30. arr[i] and *(arr + i) are identical.',
    highlightedLines: [7],
    stack: [frame({ a: 30, b: 30 })],
    heap: [],
    activeId: 'arr.2',
    annotations: [
      { id: 'arrplus2', fromId: 'arr.0', toId: 'arr.2', label: 'arr + 2 = 0x6000 + 2×4 = 0x6008' },
    ],
  },
  {
    id: 'print',
    index: 4,
    narration: 'Both a and b are 30 — the two notations are equivalent.',
    highlightedLines: [8],
    stack: [frame({ a: 30, b: 30 })],
    heap: [],
    activeId: 'arr.2',
    stdout: ['30 30'],
  },
  {
    id: 'return',
    index: 5,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [9],
    stack: [frame({ a: 30, b: 30 })],
    heap: [],
    activeId: 'main',
    stdout: ['30 30'],
  },
];

export const arrayIndexingTrace: Trace = {
  id: 'se200-array-indexing',
  title: 'Arrays — arr[i] is *(arr + i)',
  course: 'SE 200',
  topic: 'Pointers, Arrays and Strings',
  file: 'arrays.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE200: Pointers, Arrays and Strings'],
};
