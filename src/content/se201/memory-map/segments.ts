/**
 * SE 201 · The C Memory Map — one program across **all** memory regions (Phase 24 exemplar).
 *
 * A small, complete program whose data deliberately lands in every region, so the learner watches
 * each datum appear where it actually lives:
 *   - `counter = 7`     → static `.data`   (initialized, nonzero global)
 *   - `total`           → static `.bss`    (zero / uninitialized global)
 *   - `"rows"`          → static `.rodata` (read-only string literal; the global pointer `label`
 *                                           lives in `.data` and aims at it)
 *   - `malloc(...)`     → the heap         (a 12-byte block; the stack pointer `heap` holds its addr)
 *   - `n`, `squares[3]` → the stack        (a scalar **and a local array** — a local array is stack
 *                                           memory, not heap)
 *
 * Hand-verified: squares = {1, 4, 9}; total = counter + squares[2] = 7 + 9 = 16; the heap block
 * mirrors squares as {1, 4, 9}; printf("%s = %d\n", "rows", 16) prints `rows = 16`.
 *
 * `staticLayout: 'full'` keeps all three static sub-trays visible the whole time so the full map
 * reads as a memory-layout lesson.
 */
import type {
  AllocationState,
  ArrayCell,
  Cell,
  HeapBlock,
  ScalarCell,
  StackFrame,
  StaticSegment,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdlib.h>
#include <stdio.h>

int counter = 7;            /* .data:   initialized global   */
int total;                  /* .bss:    zeroed global        */
const char *label = "rows"; /* "rows" is read-only (.rodata) */

int main(void)
{
    int n = 3;
    int squares[3];
    int *heap = malloc(n * sizeof(int));
    for (int i = 0; i < n; i++) {
        squares[i] = (i + 1) * (i + 1);
        heap[i] = squares[i];
    }
    total = counter + squares[2];
    printf("%s = %d\\n", label, total);
    free(heap);
    return 0;
}
`;

function hex(n: number): string {
  return '0x' + n.toString(16);
}

function intCell(id: string, name: string, value: number | null, address: string): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value, address };
}

// ── Static segment ──────────────────────────────────────────────────────────────────────────────
const RODATA_ADDR = 0x402008;

/** The read-only string literal `"rows"` (`.rodata`); `label` points at it. */
function rowsCell(): ScalarCell {
  return {
    kind: 'scalar',
    id: 'g.rows',
    name: '"rows"',
    type: 'const char[5]',
    value: '"rows"',
    address: hex(RODATA_ADDR),
  };
}

/** The whole static segment for a step; only `.bss` `total` changes (0 → 16). */
function staticSeg(total: number | null): StaticSegment {
  return {
    data: [
      intCell('g.counter', 'counter', 7, '0x404010'),
      {
        kind: 'pointer',
        id: 'g.label',
        name: 'label',
        type: 'const char *',
        target: 'g.rows',
        display: hex(RODATA_ADDR),
        address: '0x404018',
      },
    ],
    bss: [intCell('g.total', 'total', total, '0x404020')],
    rodata: [rowsCell()],
  };
}

// ── Stack frame `main` ──────────────────────────────────────────────────────────────────────────
const SQUARES_ADDR = 0x7ffd09f0;

/** The local array `squares[3]` (stack memory — lives inside `main`'s frame). */
function squaresCell(values: (number | null)[]): ArrayCell {
  return {
    kind: 'array',
    id: 'squares',
    name: 'squares',
    type: 'int[3]',
    address: hex(SQUARES_ADDR),
    elements: values.map((v, i) => intCell(`squares.${i}`, '', v, hex(SQUARES_ADDR + i * 4))),
  };
}

interface MainState {
  n?: number;
  squares?: (number | null)[];
  heap?: boolean;
  i?: number | null;
}

function mainFrame(s: MainState): StackFrame {
  const vars: Cell[] = [];
  if (s.n !== undefined) vars.push(intCell('n', 'n', s.n, '0x7ffd09fc'));
  if (s.squares) vars.push(squaresCell(s.squares));
  if (s.heap)
    vars.push({
      kind: 'pointer',
      id: 'heap',
      name: 'heap',
      type: 'int *',
      target: 'blk',
      display: '0x5b00',
      address: '0x7ffd09e8',
    });
  if (s.i !== undefined) vars.push(intCell('i', 'i', s.i, '0x7ffd09e4'));
  return { id: 'main', name: 'main', callId: 0, address: '0x7ffd0a00', variables: vars };
}

// ── Heap block ──────────────────────────────────────────────────────────────────────────────────
const HEAP_ADDR = 0x5b00;

/** The `malloc(n * sizeof(int))` block: an `int[3]` on the heap. */
function heapBlock(values: (number | null)[], state: AllocationState): HeapBlock {
  return {
    id: 'blk',
    label: 'malloc(12)',
    type: 'int[3]',
    address: hex(HEAP_ADDR),
    size: 12,
    state,
    cells: [
      {
        kind: 'array',
        id: 'blk.cells',
        name: '',
        type: 'int[3]',
        address: hex(HEAP_ADDR),
        elements: values.map((v, i) => intCell(`blk.${i}`, '', v, hex(HEAP_ADDR + i * 4))),
      },
    ],
  };
}

const steps: Step[] = [
  {
    id: 'load',
    index: 0,
    narration:
      'Before main runs, the program’s globals already exist in the static segment: counter is initialized to 7 (.data), total is a zeroed global (.bss), and the string literal "rows" sits in read-only .rodata, with the global pointer label aimed at it.',
    highlightedLines: [4, 5, 6],
    stack: [],
    heap: [],
    staticData: staticSeg(0),
    activeId: 'g.counter',
    coach: {
      variant: 'idea',
      title: 'Globals live in static memory',
      body: 'Globals and statics are created before main and outlive every call — they live in the static segment, not on the stack. .data holds initialized globals, .bss holds zeroed ones, .rodata holds read-only constants.',
      anchorId: 'g.counter',
    },
  },
  {
    id: 'enter-main',
    index: 1,
    narration: 'Execution enters main; its frame is pushed onto the stack (high addresses).',
    highlightedLines: [8],
    stack: [mainFrame({})],
    heap: [],
    staticData: staticSeg(0),
    activeId: 'main',
  },
  {
    id: 'decl-n',
    index: 2,
    narration: 'int n = 3 is a local — it lives on the stack, inside main’s frame.',
    highlightedLines: [10],
    stack: [mainFrame({ n: 3 })],
    heap: [],
    staticData: staticSeg(0),
    activeId: 'n',
  },
  {
    id: 'decl-squares',
    index: 3,
    narration:
      'int squares[3] is a local array. It is still stack memory — its three ints sit inside main’s frame, uninitialized for now.',
    highlightedLines: [11],
    stack: [mainFrame({ n: 3, squares: [null, null, null] })],
    heap: [],
    staticData: staticSeg(0),
    activeId: 'squares',
    coach: {
      variant: 'watch-out',
      title: 'A local array is NOT on the heap',
      body: 'squares lives on the stack, inside main’s frame — declaring an array does not allocate heap memory. Only malloc does that. The array vanishes when main returns.',
      anchorId: 'squares',
    },
  },
  {
    id: 'malloc',
    index: 4,
    narration:
      'malloc(n * sizeof(int)) carves a 12-byte block from the heap and returns its address; the stack pointer heap holds it (azure arrow into the heap).',
    highlightedLines: [12],
    stack: [mainFrame({ n: 3, squares: [null, null, null], heap: true })],
    heap: [heapBlock([null, null, null], 'allocated')],
    staticData: staticSeg(0),
    activeId: 'blk',
  },
  {
    id: 'iter-0',
    index: 5,
    narration:
      'i = 0: squares[0] = 1×1 = 1 (stack), then heap[0] = squares[0] = 1 (heap). The same value now lives in two regions.',
    highlightedLines: [13, 14, 15],
    stack: [mainFrame({ n: 3, squares: [1, null, null], heap: true, i: 0 })],
    heap: [heapBlock([1, null, null], 'allocated')],
    staticData: staticSeg(0),
    activeId: 'squares.0',
    condition: { expr: 'i < n', result: true },
  },
  {
    id: 'iter-1',
    index: 6,
    narration: 'i = 1: squares[1] = 2×2 = 4, and heap[1] = 4.',
    highlightedLines: [13, 14, 15],
    stack: [mainFrame({ n: 3, squares: [1, 4, null], heap: true, i: 1 })],
    heap: [heapBlock([1, 4, null], 'allocated')],
    staticData: staticSeg(0),
    activeId: 'squares.1',
    condition: { expr: 'i < n', result: true },
  },
  {
    id: 'iter-2',
    index: 7,
    narration: 'i = 2: squares[2] = 3×3 = 9, and heap[2] = 9. The array is full.',
    highlightedLines: [13, 14, 15],
    stack: [mainFrame({ n: 3, squares: [1, 4, 9], heap: true, i: 2 })],
    heap: [heapBlock([1, 4, 9], 'allocated')],
    staticData: staticSeg(0),
    activeId: 'squares.2',
    condition: { expr: 'i < n', result: true },
  },
  {
    id: 'loop-end',
    index: 8,
    narration: 'i = 3: the test i < n is false, so the loop ends.',
    highlightedLines: [13],
    stack: [mainFrame({ n: 3, squares: [1, 4, 9], heap: true, i: 3 })],
    heap: [heapBlock([1, 4, 9], 'allocated')],
    staticData: staticSeg(0),
    activeId: 'i',
    condition: { expr: 'i < n', result: false },
  },
  {
    id: 'total',
    index: 9,
    narration:
      'total = counter + squares[2] = 7 + 9 = 16. The result is written into the .bss global total — it reads a .data global and a stack value, and stores into static memory.',
    highlightedLines: [17],
    stack: [mainFrame({ n: 3, squares: [1, 4, 9], heap: true, i: 3 })],
    heap: [heapBlock([1, 4, 9], 'allocated')],
    staticData: staticSeg(16),
    activeId: 'g.total',
    coach: {
      variant: 'idea',
      title: '.bss globals keep one home',
      body: 'total had no initializer, so it started at 0 in .bss. Writing it updates that same address in place — unlike a stack local, which is recreated on every call.',
      anchorId: 'g.total',
    },
  },
  {
    id: 'print',
    index: 10,
    narration:
      'printf reads the string through label from read-only .rodata and prints "rows = 16".',
    highlightedLines: [18],
    stack: [mainFrame({ n: 3, squares: [1, 4, 9], heap: true, i: 3 })],
    heap: [heapBlock([1, 4, 9], 'allocated')],
    staticData: staticSeg(16),
    activeId: 'g.rows',
    stdout: ['rows = 16'],
    coach: {
      variant: 'watch-out',
      title: '.rodata is read-only',
      body: 'label points into .rodata. Reading the string is fine; writing through it (e.g. label[0] = \'R\') would crash, because .rodata is not writable.',
      anchorId: 'g.rows',
    },
  },
  {
    id: 'free',
    index: 11,
    narration:
      'free(heap) returns the heap block to the allocator. heap still holds the old address, so it now dangles (red, dashed) — but the stack and static memory are untouched.',
    highlightedLines: [19],
    stack: [mainFrame({ n: 3, squares: [1, 4, 9], heap: true, i: 3 })],
    heap: [heapBlock([1, 4, 9], 'freed')],
    staticData: staticSeg(16),
    activeId: 'blk',
    stdout: ['rows = 16'],
    watch: [{ level: 'dangling', message: 'dangling: heap still points at 0x5b00, freed at segments.c:19' }],
  },
  {
    id: 'return',
    index: 12,
    narration:
      'main returns. Its locals (n, squares, heap) disappear with the frame; the freed heap block is already gone; only the static globals persist for the rest of the program.',
    highlightedLines: [20],
    stack: [mainFrame({ n: 3, squares: [1, 4, 9], heap: true, i: 3 })],
    heap: [heapBlock([1, 4, 9], 'freed')],
    staticData: staticSeg(16),
    activeId: 'main',
    stdout: ['rows = 16'],
    coach: {
      variant: 'recap',
      title: 'Three lifetimes, three regions',
      body: 'Stack locals vanish at return; heap blocks live from malloc until free; static globals (.data/.bss/.rodata) persist for the whole program. Where a datum lives is decided by how it is declared.',
    },
  },
];

export const memorySegmentsTrace: Trace = {
  id: 'se201-memory-segments',
  title: 'The C memory map — every region at once',
  course: 'SE 201',
  topic: 'The C Memory Map',
  file: 'segments.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Introduction to Memory Allocation'],
  heapLayout: 'row',
  staticLayout: 'full',
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: memorySegmentsTrace,
  label: 'Memory segments — all regions',
  summary: 'One program across .data / .bss / .rodata, the heap, and the stack — each datum in its real region.',
  order: 5,
};
export default contentModule;
