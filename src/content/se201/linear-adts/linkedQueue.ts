/**
 * SE 201 · Stacks, Queues, LIFO, FIFO Part 2 (week 6) — a **linked-list queue** (FIFO).
 *
 * The crux versus the linked stack: two cursors that move independently. `rear` points at the tail
 * (where enqueue appends); `front` points at the head (where dequeue removes). `enqueue` mallocs a
 * node, links the current rear's `next` to it, and moves `rear`. `dequeue` reads the front node,
 * moves `front` to `front->next`, and frees the old head. The empty case (`rear == NULL`) makes the
 * new node both ends; emptying the queue (`front == NULL` after advance) resets `rear` to NULL too.
 *
 * Hand-traced: enqueue 10,20,30 builds front -> 10 -> 20 -> 30 <- rear (rear walks the tail, front
 * stays put — the two cursors move separately); dequeue returns 10 then 20 (first in, first out),
 * leaving front -> 30 <- rear; enqueue 40 appends, moving only rear. Dequeue order 10, 20 matches
 * the enqueue order.
 *
 * Contrast with the linked stack (same week): the stack popped 30, 20 (reverse); the queue dequeues
 * 10, 20 (same), and it advances a separate `front` cursor rather than reusing `top`.
 */
import type { HeapBlock, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `typedef struct node {
    int value;
    struct node *next;
} node;

node *front = NULL;        /* dequeue end */
node *rear  = NULL;        /* enqueue end */

void enqueue(int x) {
    node *n = malloc(sizeof(node));
    n->value = x;
    n->next = NULL;
    if (rear == NULL)      /* empty: n is both ends   */
        front = n;
    else
        rear->next = n;    /* link after current rear */
    rear = n;              /* n is the new rear       */
}

int dequeue(void) {
    if (front == NULL)     /* empty -> underflow */
        return -1;
    node *old = front;
    int x = old->value;
    front = front->next;   /* advance front      */
    if (front == NULL)     /* queue became empty */
        rear = NULL;
    free(old);
    return x;
}

int main(void) {
    enqueue(10);
    enqueue(20);
    enqueue(30);
    int a = dequeue();     /* -> 10 (first in, first out) */
    int b = dequeue();     /* -> 20                       */
    enqueue(40);
    return 0;
}
`;

const ADDR: Record<string, string> = {
  n0: '0x6a10',
  n1: '0x6a40',
  n2: '0x6a70',
  n3: '0x6aa0',
};

/** A heap node: an int `value` and a `next` pointer to the node behind it (toward rear) or NULL. */
function node(id: string, value: number, next: string | null): HeapBlock {
  return {
    id,
    label: 'node',
    type: 'node',
    address: ADDR[id],
    state: 'allocated',
    cells: [
      { kind: 'scalar', id: `${id}.value`, name: 'value', type: 'int', value, address: ADDR[id] },
      {
        kind: 'pointer',
        id: `${id}.next`,
        name: 'next',
        type: 'node *',
        target: next,
        display: next === null ? 'NULL' : ADDR[next],
      },
    ],
  };
}

/** The single frame holding the front/rear cursors and the dequeue results a/b. */
function frame(
  frontTarget: string | null,
  rearTarget: string | null,
  a: number | null,
  b: number | null,
): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    address: '0x7ffd0000',
    variables: [
      {
        kind: 'pointer',
        id: 'front',
        name: 'front',
        type: 'node *',
        target: frontTarget,
        display: frontTarget === null ? 'NULL' : ADDR[frontTarget],
        address: '0x7ffd0010',
      },
      {
        kind: 'pointer',
        id: 'rear',
        name: 'rear',
        type: 'node *',
        target: rearTarget,
        display: rearTarget === null ? 'NULL' : ADDR[rearTarget],
        address: '0x7ffd0018',
      },
      { kind: 'scalar', id: 'a', name: 'a', type: 'int', value: a, address: '0x7ffd0020' },
      { kind: 'scalar', id: 'b', name: 'b', type: 'int', value: b, address: '0x7ffd0024' },
    ],
  };
}

const steps: Step[] = [
  {
    id: 'init',
    index: 0,
    narration:
      'front and rear are both NULL: the queue is empty. Two cursors track the two ends — that is what makes a queue, not a stack.',
    highlightedLines: [6, 7],
    stack: [frame(null, null, null, null)],
    heap: [],
    activeId: 'front',
    condition: { expr: 'rear == NULL', result: true },
  },
  {
    id: 'enqueue-10',
    index: 1,
    narration:
      'enqueue(10): rear is NULL, so the empty branch runs — the new node becomes both front and rear.',
    highlightedLines: [13, 14, 17, 33],
    stack: [frame('n0', 'n0', null, null)],
    heap: [node('n0', 10, null)],
    activeId: 'n0',
    condition: { expr: 'rear == NULL', result: true },
  },
  {
    id: 'enqueue-20',
    index: 2,
    narration:
      'enqueue(20): rear is not NULL, so link rear->next to the new node and move rear to it. front stays at 10 — the cursors move independently.',
    highlightedLines: [16, 17, 34],
    stack: [frame('n0', 'n1', null, null)],
    heap: [node('n0', 10, 'n1'), node('n1', 20, null)],
    activeId: 'n1',
    condition: { expr: 'rear == NULL', result: false },
  },
  {
    id: 'enqueue-30',
    index: 3,
    narration:
      'enqueue(30): append again; rear walks to the new tail. Queue is front -> 10 -> 20 -> 30 <- rear.',
    highlightedLines: [16, 17, 35],
    stack: [frame('n0', 'n2', null, null)],
    heap: [node('n0', 10, 'n1'), node('n1', 20, 'n2'), node('n2', 30, null)],
    activeId: 'n2',
    condition: { expr: 'rear == NULL', result: false },
  },
  {
    id: 'dequeue-10',
    index: 4,
    narration:
      'dequeue() reads front->value = 10, moves front to front->next (the 20 node), and frees the old head. FIFO: first in, first out. rear has NOT moved.',
    highlightedLines: [24, 25, 28, 36],
    stack: [frame('n1', 'n2', 10, null)],
    heap: [node('n1', 20, 'n2'), node('n2', 30, null)],
    activeId: 'a',
    condition: { expr: 'front == NULL', result: false },
  },
  {
    id: 'dequeue-20',
    index: 5,
    narration:
      'dequeue() reads front->value = 20, advances front to the 30 node, and frees the old head. Now front == rear: one element left.',
    highlightedLines: [24, 25, 28, 37],
    stack: [frame('n2', 'n2', 10, 20)],
    heap: [node('n2', 30, null)],
    activeId: 'b',
    condition: { expr: 'front == NULL', result: false },
  },
  {
    id: 'enqueue-40',
    index: 6,
    narration:
      'enqueue(40): append after rear (the 30 node) and move rear to 40. front stays at 30. Dequeue order so far — 10, 20 — matched the enqueue order exactly.',
    highlightedLines: [16, 17, 38],
    stack: [frame('n2', 'n3', 10, 20)],
    heap: [node('n2', 30, 'n3'), node('n3', 40, null)],
    activeId: 'n3',
    condition: { expr: 'rear == NULL', result: false },
  },
];

export const linkedQueueTrace: Trace = {
  id: 'se201-linked-queue',
  title: 'Linked-list queue — enqueue at rear, dequeue at front',
  course: 'SE 201',
  topic: 'Stacks, Queues, LIFO, FIFO Part 2',
  file: 'linked_queue.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Stacks, Queues, LIFO, FIFO—Part 2'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: linkedQueueTrace,
  label: 'Linked queue (FIFO)',
  summary: 'Heap chain with independent front/rear cursors; enqueue at tail, dequeue at head (FIFO).',
  order: 61,
};
export default contentModule;
