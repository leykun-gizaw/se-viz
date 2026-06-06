/**
 * SE 201 · malloc/free Commands (week 1) — sizing an allocation with `sizeof`.
 *
 * `malloc(n * sizeof(int))` is the idiom for "room for n ints": you ask for bytes, so multiply the
 * element count by the element size. Here n = 4 and sizeof(int) == 4, so malloc(16) returns one
 * contiguous 16-byte block of four ints at ascending 4-byte addresses. A loop fills them, then a
 * single free returns the whole block — you free the allocation, not each element.
 *
 * Hand-verified: 4 * sizeof(int) = 4 * 4 = 16 bytes; element addresses 0x8000, 0x8004, 0x8008,
 * 0x800c; a[i] = i * 10 gives {0, 10, 20, 30}.
 */
import type {
  AllocationState,
  Cell,
  HeapBlock,
  PointerCell,
  ScalarCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdlib.h>

int main(void)
{
    int n = 4;
    int *a = malloc(n * sizeof(int));   // 4 * 4 = 16 bytes

    for (int i = 0; i < n; i++)
        a[i] = i * 10;

    free(a);
    return 0;
}
`;

const SHELL = '$ ./sizeof';
const BASE = 0x8000;

function toHex(n: number): string {
  return '0x' + n.toString(16);
}

/** The 16-byte heap block as an int[4] array; `values[i] === null` renders an uninitialised slot. */
function block(state: AllocationState, values: (number | null)[]): HeapBlock {
  const elements: ScalarCell[] = values.map((v, i) => ({
    kind: 'scalar',
    id: `a.${i}`,
    name: `[${i}]`,
    type: 'int',
    value: v,
    address: toHex(BASE + i * 4),
  }));
  return {
    id: 'a-block',
    label: 'malloc(16)',
    type: 'int[4]',
    address: toHex(BASE),
    size: 16,
    state,
    cells: [{ kind: 'array', id: 'a-arr', name: '', type: 'int[4]', address: toHex(BASE), elements }],
  };
}

function aPtr(target: string | null): PointerCell {
  return { kind: 'pointer', id: 'a', name: 'a', type: 'int *', target, display: target ? '0x8000' : 'NULL', address: '0x7ffd4008' };
}

/** main() with n, a, and (during the loop) the loop counter i. */
function frame(aTarget: string | null, i: number | null): StackFrame {
  const vars: Cell[] = [
    { kind: 'scalar', id: 'n', name: 'n', type: 'int', value: 4, address: '0x7ffd4004' },
    aPtr(aTarget),
  ];
  if (i !== null) {
    vars.push({ kind: 'scalar', id: 'i', name: 'i', type: 'int', value: i, address: '0x7ffd400c' });
  }
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd4000', variables: vars };
}

const UNINIT: (number | null)[] = [null, null, null, null];

const WATCH_DANGLING = {
  level: 'dangling' as const,
  message: 'dangling: a still holds 0x8000, freed at sizeof.c:11',
};

/** Build one "iteration" step: the test passed and the body wrote a[i] = i * 10. */
function iteration(i: number, values: (number | null)[]): Step {
  return {
    id: `write-${i}`,
    index: i + 2,
    narration: `Iteration i = ${i}: i < n is true, so a[${i}] = ${i} * 10 = ${i * 10} is stored at ${toHex(BASE + i * 4)}.`,
    highlightedLines: [8, 9],
    stack: [frame('a-block', i)],
    heap: [block('allocated', values)],
    activeId: `a.${i}`,
    stdout: [SHELL],
    condition: { expr: 'i < n', result: true },
  };
}

const steps: Step[] = [
  {
    id: 'decl-n',
    index: 0,
    narration: 'n = 4 is how many ints we want to store.',
    highlightedLines: [5],
    stack: [frame(null, null)],
    heap: [],
    activeId: 'n',
    stdout: [SHELL],
  },
  {
    id: 'malloc',
    index: 1,
    narration:
      'malloc(n * sizeof(int)) = malloc(4 * 4) = malloc(16) reserves one contiguous 16-byte block at 0x8000. a points at the first int; the four slots share the block at ascending 4-byte addresses.',
    highlightedLines: [6],
    stack: [frame('a-block', null)],
    heap: [block('allocated', UNINIT)],
    activeId: 'a-block',
    stdout: [SHELL],
  },
  iteration(0, [0, null, null, null]),
  iteration(1, [0, 10, null, null]),
  iteration(2, [0, 10, 20, null]),
  iteration(3, [0, 10, 20, 30]),
  {
    id: 'loop-exit',
    index: 6,
    narration: 'i is now 4, so i < n is false — the loop ends with all four ints set to {0, 10, 20, 30}.',
    highlightedLines: [8],
    stack: [frame('a-block', 4)],
    heap: [block('allocated', [0, 10, 20, 30])],
    activeId: 'a-block',
    stdout: [SHELL],
    condition: { expr: 'i < n', result: false },
  },
  {
    id: 'free',
    index: 7,
    narration:
      'free(a) returns all 16 bytes in one call — you free the block, not each element. a still holds 0x8000, so it dangles until the program ends.',
    highlightedLines: [11],
    stack: [frame('a-block', null)],
    heap: [block('dangling', [0, 10, 20, 30])],
    activeId: 'a',
    stdout: [SHELL],
    watch: [WATCH_DANGLING],
  },
  {
    id: 'return',
    index: 8,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [12],
    stack: [frame('a-block', null)],
    heap: [block('dangling', [0, 10, 20, 30])],
    activeId: 'main',
    stdout: [SHELL],
    watch: [WATCH_DANGLING],
  },
];

export const sizeofMallocTrace: Trace = {
  id: 'se201-sizeof-malloc',
  title: 'sizeof — sizing an array allocation',
  course: 'SE 201',
  topic: 'malloc/free Commands',
  file: 'sizeof.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: More on malloc and free'],
  heapLayout: 'column',
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: sizeofMallocTrace,
  label: 'sizeof & arrays',
  summary: 'malloc(n * sizeof(int)) sizes one contiguous block of n ints; free returns it whole.',
  order: 13,
};
export default contentModule;
