/**
 * Validation fixture 4 — malloc / free, the heap (PDF screen 04).
 *
 * Exercises all four allocation states at once in the final step: allocated (buf), freed (tmp),
 * dangling (old still aims at a freed block — red dashed arrow, UB), and leaked (c dropped its only
 * reference — no incoming arrow). Also drives the console / heap-watch panel.
 *
 * Breadcrumb is sourced from docs/CURRICULUM.md: **malloc/free is SE 201** (Data Structures &
 * Algorithms I, "Introduction to Memory Allocation"), not SE 200 as the design mockup labelled it.
 * See the report's deviations section.
 */
import type {
  AllocationState,
  HeapBlock,
  PointerCell,
  StackFrame,
  Step,
  Trace,
} from '../../engine/trace/types.ts';

const SOURCE = `char *buf = malloc(32);
strcpy(buf, "hello");

char *old = malloc(32);
free(old);            // old now dangles

char *tmp = malloc(32);
free(tmp); tmp = NULL;

char *c = malloc(32);
c = NULL;             // 0x9060 leaked
`;

function block(id: string, address: string, state: AllocationState, content: string): HeapBlock {
  return {
    id,
    label: '32 bytes',
    type: 'char[32]',
    address,
    state,
    cells: [
      {
        kind: 'scalar',
        id: `${id}.content`,
        name: 'content',
        type: 'char[32]',
        value: content,
        address,
      },
    ],
  };
}

function ptr(id: string, target: string | null, display: string): PointerCell {
  return { kind: 'pointer', id, name: id, type: 'char *', target, display };
}

function frame(vars: PointerCell[]): StackFrame {
  return { id: 'demo', name: 'demo', callId: 0, address: '0x7ffd3000', variables: vars };
}

const SHELL = '$ ./demo';
const WATCH_DANGLING = {
  level: 'dangling' as const,
  message: 'dangling: read through old → 0x9040 was freed at heap.c:5',
};
const WATCH_LEAK = {
  level: 'leak' as const,
  message: 'leak: 32 bytes @ 0x9060 allocated at heap.c:10, never freed',
};

const steps: Step[] = [
  {
    id: 'malloc-buf',
    index: 0,
    narration: 'buf = malloc(32) allocates a 32-byte block on the heap at 0x9000.',
    highlightedLines: [1],
    stack: [frame([ptr('buf', 'b0', '0x9000')])],
    heap: [block('b0', '0x9000', 'allocated', '(uninitialised)')],
    activeId: 'b0',
    stdout: [SHELL],
  },
  {
    id: 'strcpy',
    index: 1,
    narration: 'strcpy copies "hello" into the block; the bytes become hello followed by a NUL.',
    highlightedLines: [2],
    stack: [frame([ptr('buf', 'b0', '0x9000')])],
    heap: [block('b0', '0x9000', 'allocated', '"hello\\0"')],
    activeId: 'b0',
    stdout: [SHELL],
  },
  {
    id: 'malloc-old',
    index: 2,
    narration: 'old = malloc(32) allocates a second block at 0x9040.',
    highlightedLines: [4],
    stack: [frame([ptr('buf', 'b0', '0x9000'), ptr('old', 'b40', '0x9040')])],
    heap: [
      block('b0', '0x9000', 'allocated', '"hello\\0"'),
      block('b40', '0x9040', 'allocated', '(uninitialised)'),
    ],
    activeId: 'b40',
    stdout: [SHELL],
  },
  {
    id: 'free-old',
    index: 3,
    narration:
      'free(old) releases the block at 0x9040 — but old still holds that address. It is now a dangling pointer; reading *old is undefined behaviour.',
    highlightedLines: [5],
    stack: [frame([ptr('buf', 'b0', '0x9000'), ptr('old', 'b40', '0x9040')])],
    heap: [
      block('b0', '0x9000', 'allocated', '"hello\\0"'),
      block('b40', '0x9040', 'dangling', '— freed —'),
    ],
    activeId: 'old',
    stdout: [SHELL],
    watch: [WATCH_DANGLING],
  },
  {
    id: 'malloc-tmp',
    index: 4,
    narration: 'tmp = malloc(32) reuses freed space at 0x9020.',
    highlightedLines: [7],
    stack: [
      frame([ptr('buf', 'b0', '0x9000'), ptr('old', 'b40', '0x9040'), ptr('tmp', 'b20', '0x9020')]),
    ],
    heap: [
      block('b0', '0x9000', 'allocated', '"hello\\0"'),
      block('b20', '0x9020', 'allocated', '(uninitialised)'),
      block('b40', '0x9040', 'dangling', '— freed —'),
    ],
    activeId: 'b20',
    stdout: [SHELL],
    watch: [WATCH_DANGLING],
  },
  {
    id: 'free-tmp',
    index: 5,
    narration:
      'free(tmp); tmp = NULL frees cleanly and clears the pointer — no dangling reference.',
    highlightedLines: [8],
    stack: [frame([ptr('buf', 'b0', '0x9000'), ptr('old', 'b40', '0x9040')])],
    heap: [
      block('b0', '0x9000', 'allocated', '"hello\\0"'),
      block('b20', '0x9020', 'freed', '— returned —'),
      block('b40', '0x9040', 'dangling', '— freed —'),
    ],
    activeId: 'b20',
    stdout: [SHELL],
    watch: [WATCH_DANGLING],
  },
  {
    id: 'malloc-c',
    index: 6,
    narration: 'c = malloc(32) allocates a fourth block at 0x9060.',
    highlightedLines: [10],
    stack: [
      frame([ptr('buf', 'b0', '0x9000'), ptr('old', 'b40', '0x9040'), ptr('c', 'b60', '0x9060')]),
    ],
    heap: [
      block('b0', '0x9000', 'allocated', '"hello\\0"'),
      block('b20', '0x9020', 'freed', '— returned —'),
      block('b40', '0x9040', 'dangling', '— freed —'),
      block('b60', '0x9060', 'allocated', '(uninitialised)'),
    ],
    activeId: 'b60',
    stdout: [SHELL],
    watch: [WATCH_DANGLING],
  },
  {
    id: 'leak-c',
    index: 7,
    narration:
      'c = NULL drops the only reference to 0x9060. The block is still allocated but unreachable — a leak. All four states are now visible at once.',
    highlightedLines: [11],
    stack: [frame([ptr('buf', 'b0', '0x9000'), ptr('old', 'b40', '0x9040')])],
    heap: [
      block('b0', '0x9000', 'allocated', '"hello\\0"'),
      block('b20', '0x9020', 'freed', '— returned —'),
      block('b40', '0x9040', 'dangling', '— freed —'),
      block('b60', '0x9060', 'leaked', '0x?? · unreachable'),
    ],
    activeId: 'b60',
    stdout: [SHELL],
    watch: [WATCH_DANGLING, WATCH_LEAK],
  },
];

export const mallocFreeTrace: Trace = {
  id: 'fixture-malloc-free',
  title: 'malloc / free — the heap & its states',
  course: 'SE 201',
  topic: 'Dynamic memory',
  file: 'heap.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: malloc and free'],
  heapLayout: 'column',
};
