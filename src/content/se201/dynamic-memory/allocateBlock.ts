/**
 * SE 201 · Introduction to Memory Allocation (week 1) — `malloc` returns a heap block.
 *
 * The happy path: `malloc(32)` hands back the address of a fresh 32-byte heap block, which we store
 * in the stack pointer `buf` (azure arrow into the heap). We check the result for `NULL` (allocation
 * failure), write into the block with `strcpy` (the heap bytes change, the pointer does not), print
 * it, then `free` it. After `free`, `buf` still holds the old address, so it is left dangling — the
 * cue that picks up in the next module.
 *
 * Hand-verified: `"hello"` is 5 chars plus a NUL terminator = 6 bytes written into the 32-byte block.
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
#include <string.h>
#include <stdio.h>

int main(void)
{
    char *buf = malloc(32);
    if (buf == NULL)
        return 1;            // allocation failed
    strcpy(buf, "hello");
    printf("%s\\n", buf);
    free(buf);
    return 0;
}
`;

const SHELL = '$ ./alloc';
const BLOCK_ADDR = '0x5a00';

/** The 32-byte heap block, modeled as one `char[32]` content cell (mirrors the Phase 1 fixture). */
function block(state: AllocationState, content: string): HeapBlock {
  return {
    id: 'buf-block',
    label: 'malloc(32)',
    type: 'char[32]',
    address: BLOCK_ADDR,
    size: 32,
    state,
    cells: [
      {
        kind: 'scalar',
        id: 'buf-block.content',
        name: 'content',
        type: 'char[32]',
        value: content,
        address: BLOCK_ADDR,
      },
    ],
  };
}

/** `main` holds the single stack pointer `buf`. */
function frame(buf: PointerCell): StackFrame {
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd1000', variables: [buf] };
}

function bufPtr(target: string | null, display: string): PointerCell {
  return { kind: 'pointer', id: 'buf', name: 'buf', type: 'char *', target, display, address: '0x7ffd1008' };
}

const WATCH_DANGLING = {
  level: 'dangling' as const,
  message: 'dangling: buf still holds 0x5a00, freed at alloc.c:12',
};

const steps: Step[] = [
  {
    id: 'malloc',
    index: 0,
    narration:
      'malloc(32) asks the allocator for 32 bytes and returns the address of a fresh heap block (here 0x5a00). buf lives on the stack; the block lives on the heap, and buf points to it.',
    highlightedLines: [7],
    stack: [frame(bufPtr('buf-block', '0x5a00'))],
    heap: [block('allocated', '(uninitialised)')],
    activeId: 'buf-block',
    stdout: [SHELL],
  },
  {
    id: 'null-check',
    index: 1,
    narration:
      'Always check the result: malloc returns NULL when it cannot satisfy the request. Here buf is 0x5a00, so buf == NULL is false and we skip the error return.',
    highlightedLines: [8],
    stack: [frame(bufPtr('buf-block', '0x5a00'))],
    heap: [block('allocated', '(uninitialised)')],
    activeId: 'buf',
    stdout: [SHELL],
    condition: { expr: 'buf == NULL', result: false },
  },
  {
    id: 'strcpy',
    index: 2,
    narration:
      'strcpy copies the 6 bytes \'h\',\'e\',\'l\',\'l\',\'o\',\'\\0\' into the block. The heap bytes change; the stack pointer buf is untouched.',
    highlightedLines: [10],
    stack: [frame(bufPtr('buf-block', '0x5a00'))],
    heap: [block('allocated', '"hello\\0"')],
    activeId: 'buf-block',
    stdout: [SHELL],
  },
  {
    id: 'print',
    index: 3,
    narration: 'printf reads the string back through buf and writes hello to the console.',
    highlightedLines: [11],
    stack: [frame(bufPtr('buf-block', '0x5a00'))],
    heap: [block('allocated', '"hello\\0"')],
    activeId: 'buf-block',
    stdout: [SHELL, 'hello'],
  },
  {
    id: 'free',
    index: 4,
    narration:
      'free(buf) hands the block back to the allocator. buf still holds 0x5a00, so it is now a dangling pointer — reading *buf from here on is undefined behaviour.',
    highlightedLines: [12],
    stack: [frame(bufPtr('buf-block', '0x5a00'))],
    heap: [block('dangling', '— freed —')],
    activeId: 'buf',
    stdout: [SHELL, 'hello'],
    watch: [WATCH_DANGLING],
  },
  {
    id: 'return',
    index: 5,
    narration:
      'main returns 0 and the program ends. We freed the block, so nothing leaked — but buf was left pointing at freed memory.',
    highlightedLines: [13],
    stack: [frame(bufPtr('buf-block', '0x5a00'))],
    heap: [block('dangling', '— freed —')],
    activeId: 'main',
    stdout: [SHELL, 'hello'],
    watch: [WATCH_DANGLING],
  },
];

export const allocateBlockTrace: Trace = {
  id: 'se201-malloc-allocate',
  title: 'malloc — allocate, check, use, free',
  course: 'SE 201',
  topic: 'Introduction to Memory Allocation',
  file: 'alloc.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: malloc and free'],
  heapLayout: 'column',
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: allocateBlockTrace,
  label: 'malloc a block',
  summary: 'malloc returns a heap block; NULL-check it, strcpy into it, then free it.',
  order: 10,
};
export default contentModule;
