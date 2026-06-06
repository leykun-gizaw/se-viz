/**
 * SE 201 · Stacks, Queues, LIFO, FIFO Part 1 (week 5) — an **array-backed stack** (LIFO).
 *
 * One cursor, `top`, indexes the last element pushed. `push` advances `top` then stores; `pop` reads
 * then retreats `top`. The whole point: the last value pushed is the first one popped, so popping
 * 10, 20, 30 returns them in reverse — 30, 20, 10. `top == -1` is the empty test (an underflow
 * guard); the array slots above `top` are stale and never cleared, which the trace shows honestly.
 *
 * Hand-traced: push 10,20,30 (top -1→0→1→2); pop 30,20,10 (top 2→1→0→-1); then `top == -1` so the
 * fourth pop hits the underflow guard. `data` ends as `[10, 20, 30, _, _]` (the popped values linger
 * as garbage above `top`).
 *
 * Contrast with the array queue (same week): a stack moves ONE cursor; a queue moves TWO.
 */
import type { ArrayCell, ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `int data[5];           /* storage; capacity 5      */
int top = -1;          /* -1 means the stack is empty */

void push(int x) {
    data[++top] = x;   /* advance top, then store    */
}

int pop(void) {
    if (top == -1)     /* empty -> underflow         */
        return -1;
    return data[top--];/* read, then retreat top     */
}

int main(void) {
    push(10);
    push(20);
    push(30);
    pop();             /* -> 30 (last in, first out) */
    pop();             /* -> 20                      */
    pop();             /* -> 10, stack now empty     */
    pop();             /* underflow: top == -1       */
    return 0;
}
`;

const DATA_BASE = 0x4000;

/** The five-slot `data` array; `null` slots render as garbage. */
function dataCell(values: (number | null)[]): ArrayCell {
  const elements: ScalarCell[] = values.map((v, i) => ({
    kind: 'scalar',
    id: `data.${i}`,
    name: '',
    type: 'int',
    value: v,
    address: '0x' + (DATA_BASE + i * 4).toString(16),
  }));
  return { kind: 'array', id: 'data', name: 'data', type: 'int[5]', address: '0x4000', elements };
}

/** The single frame holding `data`, the `top` cursor and the pop results a/b/c. */
function frame(
  values: (number | null)[],
  top: number,
  a: number | null,
  b: number | null,
  c: number | null,
): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    address: '0x7ffd0000',
    variables: [
      dataCell(values),
      { kind: 'scalar', id: 'top', name: 'top', type: 'int', value: top, address: '0x4014' },
      { kind: 'scalar', id: 'a', name: 'a', type: 'int', value: a, address: '0x7ffd0020' },
      { kind: 'scalar', id: 'b', name: 'b', type: 'int', value: b, address: '0x7ffd0024' },
      { kind: 'scalar', id: 'c', name: 'c', type: 'int', value: c, address: '0x7ffd0028' },
    ],
  };
}

const EMPTY: (number | null)[] = [null, null, null, null, null];

const steps: Step[] = [
  {
    id: 'init',
    index: 0,
    narration: 'top is -1: the stack is empty. The data slots hold garbage until something is pushed.',
    highlightedLines: [2],
    stack: [frame(EMPTY, -1, null, null, null)],
    heap: [],
    activeId: 'top',
    condition: { expr: 'top == -1', result: true },
  },
  {
    id: 'push-10',
    index: 1,
    narration: 'push(10): ++top moves top from -1 to 0, then 10 is stored at data[0].',
    highlightedLines: [5, 15],
    stack: [frame([10, null, null, null, null], 0, null, null, null)],
    heap: [],
    activeId: 'data.0',
  },
  {
    id: 'push-20',
    index: 2,
    narration: 'push(20): top advances to 1; 20 is stored at data[1], stacked above 10.',
    highlightedLines: [5, 16],
    stack: [frame([10, 20, null, null, null], 1, null, null, null)],
    heap: [],
    activeId: 'data.1',
  },
  {
    id: 'push-30',
    index: 3,
    narration: 'push(30): top advances to 2; 30 sits on top. Order pushed so far: 10, 20, 30.',
    highlightedLines: [5, 17],
    stack: [frame([10, 20, 30, null, null], 2, null, null, null)],
    heap: [],
    activeId: 'data.2',
  },
  {
    id: 'pop-30',
    index: 4,
    narration:
      'pop() reads data[top] = data[2] = 30, then top-- retreats to 1. LIFO: the last value pushed is the first one out.',
    highlightedLines: [11, 18],
    stack: [frame([10, 20, 30, null, null], 1, 30, null, null)],
    heap: [],
    activeId: 'a',
    condition: { expr: 'top == -1', result: false },
  },
  {
    id: 'pop-20',
    index: 5,
    narration: 'pop() reads data[top] = data[1] = 20, then top retreats to 0.',
    highlightedLines: [11, 19],
    stack: [frame([10, 20, 30, null, null], 0, 30, 20, null)],
    heap: [],
    activeId: 'b',
    condition: { expr: 'top == -1', result: false },
  },
  {
    id: 'pop-10',
    index: 6,
    narration:
      'pop() reads data[top] = data[0] = 10, then top retreats to -1. The slots still show 10, 20, 30 — pop only moves the cursor, it never clears them.',
    highlightedLines: [11, 20],
    stack: [frame([10, 20, 30, null, null], -1, 30, 20, 10)],
    heap: [],
    activeId: 'c',
    condition: { expr: 'top == -1', result: false },
  },
  {
    id: 'underflow',
    index: 7,
    narration:
      'A fourth pop() finds top == -1, so the empty guard fires and it returns -1 instead of reading garbage. This is underflow.',
    highlightedLines: [9, 10, 21],
    stack: [frame([10, 20, 30, null, null], -1, 30, 20, 10)],
    heap: [],
    activeId: 'top',
    condition: { expr: 'top == -1', result: true },
  },
];

export const arrayStackTrace: Trace = {
  id: 'se201-array-stack',
  title: 'Array-backed stack — push, pop, the top cursor',
  course: 'SE 201',
  topic: 'Stacks, Queues, LIFO, FIFO Part 1',
  file: 'array_stack.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Stacks, Queues, LIFO, FIFO—Part 1'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: arrayStackTrace,
  label: 'Array stack (LIFO)',
  summary: 'One top cursor; push/pop show last-in-first-out order plus an empty/underflow guard.',
  order: 50,
};
export default contentModule;
