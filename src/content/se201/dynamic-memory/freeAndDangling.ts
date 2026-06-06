/**
 * SE 201 · Introduction to Memory Allocation (week 1) — `free`, dangling pointers, and the NULL fix.
 *
 * Allocate one `int`, write 42 through `*p`, print it, then `free(p)`. Immediately after `free`, `p`
 * still holds the block's address, so it is a **dangling** pointer (the block renders red, the
 * heap-watch flags it). Setting `p = NULL` clears the stale address: with no pointer aiming at it the
 * block is simply **freed** memory — the dangling/freed distinction is the whole lesson here.
 *
 * Hand-verified: sizeof(int) == 4, so malloc(sizeof(int)) reserves a 4-byte block; *p prints 42.
 */
import type {
  AllocationState,
  HeapBlock,
  PointerCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdlib.h>
#include <stdio.h>

int main(void)
{
    int *p = malloc(sizeof(int));
    *p = 42;
    printf("%d\\n", *p);

    free(p);             // the block is returned; p now dangles
    p = NULL;            // clear the stale address — no more dangling

    return 0;
}
`;

const SHELL = '$ ./free';
const BLOCK_ADDR = '0x6100';

/** The 4-byte heap block holding a single int. */
function block(state: AllocationState, value: number | string | null): HeapBlock {
  return {
    id: 'p-block',
    label: 'malloc(4)',
    type: 'int',
    address: BLOCK_ADDR,
    size: 4,
    state,
    cells: [{ kind: 'scalar', id: 'p-block.val', name: '*p', type: 'int', value, address: BLOCK_ADDR }],
  };
}

function pPtr(target: string | null, display: string): PointerCell {
  return { kind: 'pointer', id: 'p', name: 'p', type: 'int *', target, display, address: '0x7ffd2008' };
}

function frame(p: PointerCell): StackFrame {
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd2000', variables: [p] };
}

const WATCH_DANGLING = {
  level: 'dangling' as const,
  message: 'dangling: p still aims at 0x6100, freed at free.c:10',
};

const steps: Step[] = [
  {
    id: 'malloc',
    index: 0,
    narration:
      'p = malloc(sizeof(int)) reserves 4 bytes (sizeof(int) == 4) at 0x6100 and stores that address in p.',
    highlightedLines: [6],
    stack: [frame(pPtr('p-block', '0x6100'))],
    heap: [block('allocated', null)],
    activeId: 'p-block',
    stdout: [SHELL],
  },
  {
    id: 'assign',
    index: 1,
    narration: '*p = 42 dereferences p and writes 42 into the heap block it points at.',
    highlightedLines: [7],
    stack: [frame(pPtr('p-block', '0x6100'))],
    heap: [block('allocated', 42)],
    activeId: 'p-block.val',
    stdout: [SHELL],
  },
  {
    id: 'print',
    index: 2,
    narration: 'printf reads *p back and prints 42.',
    highlightedLines: [8],
    stack: [frame(pPtr('p-block', '0x6100'))],
    heap: [block('allocated', 42)],
    activeId: 'p-block',
    stdout: [SHELL, '42'],
  },
  {
    id: 'free',
    index: 3,
    narration:
      'free(p) returns the block to the allocator. But p still holds 0x6100 — it is now a dangling pointer, and reading or writing *p would be undefined behaviour.',
    highlightedLines: [10],
    stack: [frame(pPtr('p-block', '0x6100'))],
    heap: [block('dangling', '— freed —')],
    activeId: 'p',
    stdout: [SHELL, '42'],
    watch: [WATCH_DANGLING],
  },
  {
    id: 'nullify',
    index: 4,
    narration:
      'p = NULL clears the stale address. With no pointer aiming at it, the block is just freed memory — the dangling pointer is gone.',
    highlightedLines: [11],
    stack: [frame(pPtr(null, 'NULL'))],
    heap: [block('freed', '— freed —')],
    activeId: 'p',
    stdout: [SHELL, '42'],
  },
  {
    id: 'return',
    index: 5,
    narration:
      'main returns 0. We allocated, used, freed, and cleared the pointer — no leak and no dangling reference.',
    highlightedLines: [13],
    stack: [frame(pPtr(null, 'NULL'))],
    heap: [block('freed', '— freed —')],
    activeId: 'main',
    stdout: [SHELL, '42'],
  },
];

export const freeAndDanglingTrace: Trace = {
  id: 'se201-free-dangling',
  title: 'free — dangling pointers & the p = NULL fix',
  course: 'SE 201',
  topic: 'Introduction to Memory Allocation',
  file: 'free.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: malloc and free'],
  heapLayout: 'column',
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: freeAndDanglingTrace,
  label: 'free & dangling',
  summary: 'free leaves a dangling pointer; p = NULL clears it (dangling vs freed).',
  order: 11,
};
export default contentModule;
