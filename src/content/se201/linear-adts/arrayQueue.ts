/**
 * SE 201 · Stacks, Queues, LIFO, FIFO Part 1 (week 5) — an **array-backed circular queue** (FIFO).
 *
 * The crux versus a stack: a queue needs TWO cursors that move independently. `rear` is where the
 * next value is enqueued; `front` is where the next value is dequeued. Each advances with modular
 * arithmetic — `(i + 1) % CAP` — so the indices wrap around the fixed array (a ring buffer). `count`
 * tracks live elements: `count == 0` is empty (dequeue underflow), `count == CAP` is full (enqueue
 * overflow), which disambiguates the otherwise-identical `front == rear` state.
 *
 * Hand-traced (CAP = 4): enqueue 10,20,30 (rear 0→1→2→3); dequeue 10 then 20 (front 0→1→2, rear
 * unchanged — the two cursors move separately); enqueue 40 wraps rear 3→0; enqueue 50, 60 fill the
 * ring (count 4 == CAP); enqueue 70 is rejected by the overflow guard; dequeue 30. The dequeue order
 * 10, 20, 30 exactly matches the enqueue order — first in, first out.
 *
 * Contrast with the array stack (same week): popping returned 30, 20, 10 (reverse); dequeuing
 * returns 10, 20, 30 (same).
 */
import type { ArrayCell, ScalarCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#define CAP 4

int q[CAP];                  /* ring buffer of capacity 4    */
int front = 0, rear = 0;     /* two cursors, move separately */
int count = 0;               /* number of live elements      */

void enqueue(int x) {
    if (count == CAP)        /* full -> overflow */
        return;
    q[rear] = x;             /* store at rear    */
    rear = (rear + 1) % CAP; /* advance, wrap    */
    count++;
}

int dequeue(void) {
    if (count == 0)          /* empty -> underflow */
        return -1;
    int x = q[front];        /* read at front      */
    front = (front + 1) % CAP;/* advance, wrap     */
    count--;
    return x;
}

int main(void) {
    enqueue(10);
    enqueue(20);
    enqueue(30);
    int a = dequeue();       /* -> 10 (first in, first out) */
    int b = dequeue();       /* -> 20                       */
    enqueue(40);             /* rear wraps 3 -> 0           */
    enqueue(50);
    enqueue(60);             /* count == CAP: queue full    */
    enqueue(70);             /* rejected by overflow guard  */
    int c = dequeue();       /* -> 30                       */
    return 0;
}
`;

const Q_BASE = 0x5000;

/** The four-slot ring buffer `q`; `null` slots render as garbage. */
function qCell(values: (number | null)[]): ArrayCell {
  const elements: ScalarCell[] = values.map((v, i) => ({
    kind: 'scalar',
    id: `q.${i}`,
    name: '',
    type: 'int',
    value: v,
    address: '0x' + (Q_BASE + i * 4).toString(16),
  }));
  return { kind: 'array', id: 'q', name: 'q', type: 'int[4]', address: '0x5000', elements };
}

/** The single frame holding q, the front/rear cursors, count and the dequeue results a/b/c. */
function frame(
  values: (number | null)[],
  front: number,
  rear: number,
  count: number,
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
      qCell(values),
      { kind: 'scalar', id: 'front', name: 'front', type: 'int', value: front, address: '0x5010' },
      { kind: 'scalar', id: 'rear', name: 'rear', type: 'int', value: rear, address: '0x5014' },
      { kind: 'scalar', id: 'count', name: 'count', type: 'int', value: count, address: '0x5018' },
      { kind: 'scalar', id: 'a', name: 'a', type: 'int', value: a, address: '0x7ffd0020' },
      { kind: 'scalar', id: 'b', name: 'b', type: 'int', value: b, address: '0x7ffd0024' },
      { kind: 'scalar', id: 'c', name: 'c', type: 'int', value: c, address: '0x7ffd0028' },
    ],
  };
}

const FULL = { expr: 'count == CAP', result: false };
const EMPTY = { expr: 'count == 0', result: false };

const steps: Step[] = [
  {
    id: 'init',
    index: 0,
    narration:
      'front and rear both start at 0 and count is 0 — the queue is empty. Two cursors, not one: that is what separates a queue from a stack.',
    highlightedLines: [4, 5],
    stack: [frame([null, null, null, null], 0, 0, 0, null, null, null)],
    heap: [],
    activeId: 'count',
    condition: { expr: 'count == 0', result: true },
  },
  {
    id: 'enqueue-10',
    index: 1,
    narration: 'enqueue(10): store at q[rear] = q[0], then rear advances to 1. front stays at 0.',
    highlightedLines: [10, 11, 25],
    stack: [frame([10, null, null, null], 0, 1, 1, null, null, null)],
    heap: [],
    activeId: 'q.0',
    condition: FULL,
  },
  {
    id: 'enqueue-20',
    index: 2,
    narration: 'enqueue(20): store at q[1], rear advances to 2. front is still 0.',
    highlightedLines: [10, 11, 26],
    stack: [frame([10, 20, null, null], 0, 2, 2, null, null, null)],
    heap: [],
    activeId: 'q.1',
    condition: FULL,
  },
  {
    id: 'enqueue-30',
    index: 3,
    narration: 'enqueue(30): store at q[2], rear advances to 3. Queued so far: 10, 20, 30.',
    highlightedLines: [10, 11, 27],
    stack: [frame([10, 20, 30, null], 0, 3, 3, null, null, null)],
    heap: [],
    activeId: 'q.2',
    condition: FULL,
  },
  {
    id: 'dequeue-10',
    index: 4,
    narration:
      'dequeue() reads q[front] = q[0] = 10, then front advances to 1. FIFO: the first value in is the first out. Note rear has NOT moved.',
    highlightedLines: [18, 19, 28],
    stack: [frame([10, 20, 30, null], 1, 3, 2, 10, null, null)],
    heap: [],
    activeId: 'a',
    condition: EMPTY,
  },
  {
    id: 'dequeue-20',
    index: 5,
    narration:
      'dequeue() reads q[front] = q[1] = 20, then front advances to 2. rear is still 3 — front and rear move independently.',
    highlightedLines: [18, 19, 29],
    stack: [frame([10, 20, 30, null], 2, 3, 1, 10, 20, null)],
    heap: [],
    activeId: 'b',
    condition: EMPTY,
  },
  {
    id: 'enqueue-40-wrap',
    index: 6,
    narration:
      'enqueue(40): store at q[rear] = q[3], then rear = (3 + 1) % 4 = 0. rear wraps back to the start of the ring.',
    highlightedLines: [10, 11, 30],
    stack: [frame([10, 20, 30, 40], 2, 0, 2, 10, 20, null)],
    heap: [],
    activeId: 'q.3',
    condition: FULL,
  },
  {
    id: 'enqueue-50',
    index: 7,
    narration:
      'enqueue(50): store at q[rear] = q[0], reusing the slot 10 vacated, then rear advances to 1.',
    highlightedLines: [10, 11, 31],
    stack: [frame([50, 20, 30, 40], 2, 1, 3, 10, 20, null)],
    heap: [],
    activeId: 'q.0',
    condition: FULL,
  },
  {
    id: 'enqueue-60-full',
    index: 8,
    narration:
      'enqueue(60): store at q[1], rear advances to 2. count is now 4 == CAP, so the queue is full (front == rear == 2, but count tells them apart).',
    highlightedLines: [10, 11, 32],
    stack: [frame([50, 60, 30, 40], 2, 2, 4, 10, 20, null)],
    heap: [],
    activeId: 'q.1',
    condition: FULL,
  },
  {
    id: 'enqueue-70-overflow',
    index: 9,
    narration:
      'enqueue(70) finds count == CAP, so the overflow guard returns immediately. Nothing is stored and the cursors do not move.',
    highlightedLines: [8, 9, 33],
    stack: [frame([50, 60, 30, 40], 2, 2, 4, 10, 20, null)],
    heap: [],
    activeId: 'count',
    condition: { expr: 'count == CAP', result: true },
  },
  {
    id: 'dequeue-30',
    index: 10,
    narration:
      'dequeue() reads q[front] = q[2] = 30, then front advances to 3. Dequeue order was 10, 20, 30 — exactly the order they were enqueued.',
    highlightedLines: [18, 19, 34],
    stack: [frame([50, 60, 30, 40], 3, 2, 3, 10, 20, 30)],
    heap: [],
    activeId: 'c',
    condition: EMPTY,
  },
];

export const arrayQueueTrace: Trace = {
  id: 'se201-array-queue',
  title: 'Circular queue — enqueue, dequeue, front & rear',
  course: 'SE 201',
  topic: 'Stacks, Queues, LIFO, FIFO Part 1',
  file: 'circular_queue.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Stacks, Queues, LIFO, FIFO—Part 1'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: arrayQueueTrace,
  label: 'Circular queue (FIFO)',
  summary: 'Two cursors (front/rear) wrap with modulo; FIFO order plus empty/full guards.',
  order: 51,
};
export default contentModule;
