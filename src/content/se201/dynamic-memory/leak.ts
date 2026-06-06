/**
 * SE 201 · Introduction to Memory Allocation (week 1) — memory leaks & heap-vs-stack lifetime.
 *
 * The clearest leak: a function allocates a block into a *local* pointer and returns without freeing
 * it. When the frame pops, the stack pointer `local` is destroyed — but the heap block is **not**:
 * heap memory outlives the call that made it and must be freed by hand. With the only reference gone,
 * the block is **leaked** (still allocated, unreachable, no incoming arrow), flagged by the
 * heap-watch. This is the dangling pointer's opposite: dangling = pointer to freed memory; leak =
 * live memory with no pointer.
 *
 * Hand-verified: malloc(64) reserves a 64-byte block; no free call exists on any path.
 */
import type { AllocationState, HeapBlock, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdlib.h>

void make_leak(void)
{
    char *local = malloc(64);   // 64 bytes at 0x7a00
    // returns without free; local is destroyed
}

int main(void)
{
    make_leak();
    return 0;
}
`;

const SHELL = '$ ./leak';
const BLOCK_ADDR = '0x7a00';

/** The 64-byte heap block (one char[64] content cell). */
function block(state: AllocationState): HeapBlock {
  return {
    id: 'leak-block',
    label: 'malloc(64)',
    type: 'char[64]',
    address: BLOCK_ADDR,
    size: 64,
    state,
    cells: [
      {
        kind: 'scalar',
        id: 'leak-block.content',
        name: 'content',
        type: 'char[64]',
        value: '(uninitialised)',
        address: BLOCK_ADDR,
      },
    ],
  };
}

function mainFrame(): StackFrame {
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd3000', variables: [] };
}

/** The make_leak activation; `local` appears once malloc runs. */
function leakFrame(withLocal: boolean): StackFrame {
  return {
    id: 'make_leak',
    name: 'make_leak',
    callId: 1,
    address: '0x7ffd2fd0',
    variables: withLocal
      ? [
          {
            kind: 'pointer',
            id: 'local',
            name: 'local',
            type: 'char *',
            target: 'leak-block',
            display: '0x7a00',
            address: '0x7ffd2fd8',
          },
        ]
      : [],
  };
}

const WATCH_LEAK = {
  level: 'leak' as const,
  message: 'leak: 64 bytes @ 0x7a00 allocated at leak.c:5, never freed',
};

const steps: Step[] = [
  {
    id: 'call',
    index: 0,
    narration:
      'main calls make_leak(). A new frame is pushed for it; nothing has been allocated on the heap yet.',
    highlightedLines: [11, 3],
    stack: [mainFrame(), leakFrame(false)],
    heap: [],
    activeId: 'make_leak',
    stdout: [SHELL],
  },
  {
    id: 'malloc',
    index: 1,
    narration:
      'local = malloc(64) allocates 64 bytes at 0x7a00. local is a stack variable inside make_leak; the block it points to lives on the heap.',
    highlightedLines: [5],
    stack: [mainFrame(), leakFrame(true)],
    heap: [block('allocated')],
    activeId: 'leak-block',
    stdout: [SHELL],
  },
  {
    id: 'return-leak',
    index: 2,
    narration:
      'make_leak returns. Its frame — including local — is destroyed, but the heap block is NOT freed: it outlives the call. Nothing points at those 64 bytes anymore.',
    highlightedLines: [7],
    stack: [mainFrame()],
    heap: [block('leaked')],
    activeId: 'leak-block',
    stdout: [SHELL],
    watch: [WATCH_LEAK],
  },
  {
    id: 'end',
    index: 3,
    narration:
      'Back in main, the block at 0x7a00 is still allocated but unreachable — a leak. It stays allocated until the program exits; heap memory must be freed by hand.',
    highlightedLines: [12],
    stack: [mainFrame()],
    heap: [block('leaked')],
    activeId: 'leak-block',
    stdout: [SHELL],
    watch: [WATCH_LEAK],
  },
];

export const leakTrace: Trace = {
  id: 'se201-leak',
  title: 'Memory leaks — losing the last reference',
  course: 'SE 201',
  topic: 'Introduction to Memory Allocation',
  file: 'leak.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: malloc and free'],
  heapLayout: 'column',
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: leakTrace,
  label: 'Memory leak',
  summary: 'A block outlives its only pointer when a frame pops — leaked, not freed.',
  order: 12,
};
export default contentModule;
