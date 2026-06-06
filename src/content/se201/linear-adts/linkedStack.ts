/**
 * SE 201 · Stacks, Queues, LIFO, FIFO Part 2 (week 6) — a **linked-list stack** (LIFO).
 *
 * Same LIFO discipline as the array stack, but the storage is a heap chain instead of a fixed array,
 * so there is no capacity limit and no "full". One cursor — `top` — points at the head of the chain.
 * `push` mallocs a node, links its `next` to the old top, and moves `top` to the new node (insert at
 * head). `pop` reads the top node, moves `top` to `top->next`, and frees the old node.
 *
 * Hand-traced: push 10, 20, 30 builds top -> 30 -> 20 -> 10 -> NULL; pop returns 30 then 20 (the
 * last pushed leaves first), leaving top -> 10 -> NULL. `top == NULL` is the empty test.
 *
 * Contrast with the linked queue (same week): a stack keeps ONE cursor and inserts/removes at the
 * same end; a queue keeps TWO and inserts at one end, removes at the other.
 */
import type { HeapBlock, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `typedef struct node {
    int value;
    struct node *next;
} node;

node *top = NULL;          /* empty stack */

void push(int x) {
    node *n = malloc(sizeof(node));
    n->value = x;
    n->next = top;         /* link above old top  */
    top = n;               /* new node is the top */
}

int pop(void) {
    if (top == NULL)       /* empty -> underflow */
        return -1;
    node *old = top;
    int x = old->value;
    top = top->next;       /* drop to next node */
    free(old);
    return x;
}

int main(void) {
    push(10);
    push(20);
    push(30);
    int a = pop();         /* -> 30 (last in, first out) */
    int b = pop();         /* -> 20                      */
    return 0;
}
`;

const ADDR = { n0: '0x6a10', n1: '0x6a40', n2: '0x6a70' } as const;

/** A heap node: an int `value` and a `next` pointer to the node below it on the stack (or NULL). */
function node(id: string, address: string, value: number, next: string | null): HeapBlock {
  return {
    id,
    label: 'node',
    type: 'node',
    address,
    state: 'allocated',
    cells: [
      { kind: 'scalar', id: `${id}.value`, name: 'value', type: 'int', value, address },
      {
        kind: 'pointer',
        id: `${id}.next`,
        name: 'next',
        type: 'node *',
        target: next,
        display: next === null ? 'NULL' : ADDR[next as keyof typeof ADDR],
      },
    ],
  };
}

const N0 = node('n0', ADDR.n0, 10, null);
const N1 = node('n1', ADDR.n1, 20, 'n0');
const N2 = node('n2', ADDR.n2, 30, 'n1');

/** The single frame holding the `top` cursor and the pop results a/b. */
function frame(topTarget: string | null, a: number | null, b: number | null): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    address: '0x7ffd0000',
    variables: [
      {
        kind: 'pointer',
        id: 'top',
        name: 'top',
        type: 'node *',
        target: topTarget,
        display: topTarget === null ? 'NULL' : ADDR[topTarget as keyof typeof ADDR],
        address: '0x7ffd0010',
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
    narration: 'top is NULL: the stack is empty and the heap holds no nodes.',
    highlightedLines: [6],
    stack: [frame(null, null, null)],
    heap: [],
    activeId: 'top',
    condition: { expr: 'top == NULL', result: true },
  },
  {
    id: 'push-10',
    index: 1,
    narration:
      'push(10): malloc a node with value 10, set its next to the old top (NULL), then move top to it.',
    highlightedLines: [9, 11, 12, 26],
    stack: [frame('n0', null, null)],
    heap: [N0],
    activeId: 'n0',
  },
  {
    id: 'push-20',
    index: 2,
    narration:
      'push(20): the new node 20 links to the old top (the 10 node), then top moves up to it. Insert at head.',
    highlightedLines: [9, 11, 12, 27],
    stack: [frame('n1', null, null)],
    heap: [N1, N0],
    activeId: 'n1',
  },
  {
    id: 'push-30',
    index: 3,
    narration:
      'push(30): node 30 links to 20 and becomes the new top. Chain is top -> 30 -> 20 -> 10 -> NULL.',
    highlightedLines: [9, 11, 12, 28],
    stack: [frame('n2', null, null)],
    heap: [N2, N1, N0],
    activeId: 'n2',
  },
  {
    id: 'pop-30',
    index: 4,
    narration:
      'pop() reads top->value = 30, moves top to top->next (the 20 node), and frees the old head. LIFO: the last pushed is the first popped.',
    highlightedLines: [19, 20, 21, 29],
    stack: [frame('n1', 30, null)],
    heap: [N1, N0],
    activeId: 'a',
    condition: { expr: 'top == NULL', result: false },
  },
  {
    id: 'pop-20',
    index: 5,
    narration: 'pop() reads top->value = 20, moves top to the 10 node, and frees the old head.',
    highlightedLines: [19, 20, 21, 30],
    stack: [frame('n0', 30, 20)],
    heap: [N0],
    activeId: 'b',
    condition: { expr: 'top == NULL', result: false },
  },
];

export const linkedStackTrace: Trace = {
  id: 'se201-linked-stack',
  title: 'Linked-list stack — push, pop at the head',
  course: 'SE 201',
  topic: 'Stacks, Queues, LIFO, FIFO Part 2',
  file: 'linked_stack.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Stacks, Queues, LIFO, FIFO—Part 2'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: linkedStackTrace,
  label: 'Linked stack (LIFO)',
  summary: 'Heap chain, top cursor; push/pop at the head show LIFO with no capacity limit.',
  order: 60,
};
export default contentModule;
