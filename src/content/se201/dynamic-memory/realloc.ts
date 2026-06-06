/**
 * SE 201 · malloc/free Commands (week 1) — growing a block with `realloc` (copy-on-grow).
 *
 * `realloc` resizes an allocation. When it cannot grow in place it allocates a **new** block, copies
 * the old contents over, and frees the old one — so the address can change. We capture the result in
 * a temporary `b`, see that `b` differs from the stale `a` (which now **dangles** at the freed old
 * block), then reassign `a = b`. That reassignment is the lesson: a pointer to the pre-realloc block
 * is invalid; only the returned address is safe to use. Using a temp also avoids leaking the original
 * if realloc returns NULL.
 *
 * Hand-verified: 2 * sizeof(int) = 8 bytes (old, 0x9000), 4 * sizeof(int) = 16 bytes (new, 0x9400);
 * old elements 0x9000, 0x9004; new elements 0x9400, 0x9404, 0x9408, 0x940c; contents end {1,2,3,4}.
 */
import type {
  AllocationState,
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
    int *a = malloc(2 * sizeof(int));     // 8 bytes at 0x9000
    a[0] = 1;
    a[1] = 2;

    int *b = realloc(a, 4 * sizeof(int)); // grow to 16 bytes
    // realloc may move the block: it copies the old
    // contents to 0x9400 and frees the old block.
    a = b;                  // adopt the new address

    a[2] = 3;
    a[3] = 4;

    free(a);
    return 0;
}
`;

const SHELL = '$ ./realloc';
const OLD_BASE = 0x9000;
const NEW_BASE = 0x9400;

function toHex(n: number): string {
  return '0x' + n.toString(16);
}

/** Build a heap block as an int array; `values[i] === null` is an uninitialised slot. */
function block(
  id: string,
  base: number,
  count: number,
  state: AllocationState,
  values: (number | null)[],
): HeapBlock {
  const elements: ScalarCell[] = Array.from({ length: count }, (_, i) => ({
    kind: 'scalar',
    id: `${id}.${i}`,
    name: `[${i}]`,
    type: 'int',
    value: values[i] ?? null,
    address: toHex(base + i * 4),
  }));
  return {
    id,
    label: `malloc(${count * 4})`,
    type: `int[${count}]`,
    address: toHex(base),
    size: count * 4,
    state,
    cells: [{ kind: 'array', id: `${id}.arr`, name: '', type: `int[${count}]`, address: toHex(base), elements }],
  };
}

function ptr(id: string, target: string | null, display: string): PointerCell {
  return {
    kind: 'pointer',
    id,
    name: id,
    type: 'int *',
    target,
    display,
    address: id === 'a' ? '0x7ffd5008' : '0x7ffd5010',
  };
}

/** main() with a, and b once realloc has run. */
function frame(a: PointerCell, b?: PointerCell): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    address: '0x7ffd5000',
    variables: b ? [a, b] : [a],
  };
}

const WATCH_OLD_DANGLING = {
  level: 'dangling' as const,
  message: 'dangling: a still holds 0x9000, freed by realloc at realloc.c:9',
};
const WATCH_FREED_DANGLING = {
  level: 'dangling' as const,
  message: 'dangling: a and b both hold 0x9400, freed at realloc.c:17',
};

const steps: Step[] = [
  {
    id: 'malloc-a',
    index: 0,
    narration:
      'a = malloc(2 * sizeof(int)) = malloc(8) reserves two ints at 0x9000.',
    highlightedLines: [5],
    stack: [frame(ptr('a', 'oldblk', '0x9000'))],
    heap: [block('oldblk', OLD_BASE, 2, 'allocated', [null, null])],
    activeId: 'oldblk',
    stdout: [SHELL],
  },
  {
    id: 'write-a0',
    index: 1,
    narration: 'a[0] = 1 writes the first int.',
    highlightedLines: [6],
    stack: [frame(ptr('a', 'oldblk', '0x9000'))],
    heap: [block('oldblk', OLD_BASE, 2, 'allocated', [1, null])],
    activeId: 'oldblk.0',
    stdout: [SHELL],
  },
  {
    id: 'write-a1',
    index: 2,
    narration: 'a[1] = 2. The block now holds {1, 2}.',
    highlightedLines: [7],
    stack: [frame(ptr('a', 'oldblk', '0x9000'))],
    heap: [block('oldblk', OLD_BASE, 2, 'allocated', [1, 2])],
    activeId: 'oldblk.1',
    stdout: [SHELL],
  },
  {
    id: 'realloc',
    index: 3,
    narration:
      'realloc(a, 16) needs a bigger block. It cannot grow in place here, so it allocates a NEW 16-byte block at 0x9400, copies {1, 2} over, and frees the old 0x9000 block. The new address goes into b — note b (0x9400) differs from a (0x9000), which now dangles.',
    highlightedLines: [9],
    stack: [frame(ptr('a', 'oldblk', '0x9000'), ptr('b', 'newblk', '0x9400'))],
    heap: [
      block('oldblk', OLD_BASE, 2, 'dangling', [1, 2]),
      block('newblk', NEW_BASE, 4, 'allocated', [1, 2, null, null]),
    ],
    activeId: 'newblk',
    stdout: [SHELL],
    watch: [WATCH_OLD_DANGLING],
  },
  {
    id: 'reassign',
    index: 4,
    narration:
      'a = b makes a point at the new block too, so a now holds 0x9400. The old block has no pointer left — just freed memory. This reassignment is why you must capture realloc\'s result: a pointer to the pre-realloc block is invalid.',
    highlightedLines: [12],
    stack: [frame(ptr('a', 'newblk', '0x9400'), ptr('b', 'newblk', '0x9400'))],
    heap: [
      block('oldblk', OLD_BASE, 2, 'freed', [1, 2]),
      block('newblk', NEW_BASE, 4, 'allocated', [1, 2, null, null]),
    ],
    activeId: 'a',
    stdout: [SHELL],
  },
  {
    id: 'write-a2',
    index: 5,
    narration: 'a[2] = 3 fills the third slot — it exists only because we grew the block.',
    highlightedLines: [14],
    stack: [frame(ptr('a', 'newblk', '0x9400'), ptr('b', 'newblk', '0x9400'))],
    heap: [
      block('oldblk', OLD_BASE, 2, 'freed', [1, 2]),
      block('newblk', NEW_BASE, 4, 'allocated', [1, 2, 3, null]),
    ],
    activeId: 'newblk.2',
    stdout: [SHELL],
  },
  {
    id: 'write-a3',
    index: 6,
    narration: 'a[3] = 4. The grown block holds {1, 2, 3, 4}.',
    highlightedLines: [15],
    stack: [frame(ptr('a', 'newblk', '0x9400'), ptr('b', 'newblk', '0x9400'))],
    heap: [
      block('oldblk', OLD_BASE, 2, 'freed', [1, 2]),
      block('newblk', NEW_BASE, 4, 'allocated', [1, 2, 3, 4]),
    ],
    activeId: 'newblk.3',
    stdout: [SHELL],
  },
  {
    id: 'free',
    index: 7,
    narration:
      'free(a) returns the 16-byte block. a and b both held 0x9400, so both now dangle until the program ends.',
    highlightedLines: [17],
    stack: [frame(ptr('a', 'newblk', '0x9400'), ptr('b', 'newblk', '0x9400'))],
    heap: [
      block('oldblk', OLD_BASE, 2, 'freed', [1, 2]),
      block('newblk', NEW_BASE, 4, 'dangling', [1, 2, 3, 4]),
    ],
    activeId: 'newblk',
    stdout: [SHELL],
    watch: [WATCH_FREED_DANGLING],
  },
  {
    id: 'return',
    index: 8,
    narration: 'main returns 0 and the program ends.',
    highlightedLines: [18],
    stack: [frame(ptr('a', 'newblk', '0x9400'), ptr('b', 'newblk', '0x9400'))],
    heap: [
      block('oldblk', OLD_BASE, 2, 'freed', [1, 2]),
      block('newblk', NEW_BASE, 4, 'dangling', [1, 2, 3, 4]),
    ],
    activeId: 'main',
    stdout: [SHELL],
    watch: [WATCH_FREED_DANGLING],
  },
];

export const reallocTrace: Trace = {
  id: 'se201-realloc',
  title: 'realloc — copy-on-grow & the address change',
  course: 'SE 201',
  topic: 'malloc/free Commands',
  file: 'realloc.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: More on malloc and free'],
  heapLayout: 'column',
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: reallocTrace,
  label: 'realloc',
  summary: 'realloc moves a block to grow it: new address, old freed, pointers must be reassigned.',
  order: 14,
};
export default contentModule;
