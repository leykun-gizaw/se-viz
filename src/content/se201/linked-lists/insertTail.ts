/**
 * SE 201 · Singly Linked Lists Part 1 (week 2) — insert at the tail.
 *
 * Unlike head insertion, appending needs a walk: follow `next` until `current->next == NULL`
 * (the last node), then point that last node’s `next` at the new node. The walk is a `current`
 * arrow glide; the final `current->next = new` is the single rewire that splices the node on.
 *
 * Hand-traced: start 7 -> 4 -> NULL; append 9; result 7 -> 4 -> 9 -> NULL.
 */
import type { Cell, HeapBlock, PointerCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdlib.h>

typedef struct node {
    int value;
    struct node *next;
} node_t;

node_t *insert_tail(node_t *head, int value) {
    node_t *new = malloc(sizeof(node_t));
    new->value = value;
    new->next = NULL;
    node_t *current = head;
    while (current->next != NULL) {
        current = current->next;
    }
    current->next = new;
    return head;
}
`;

const ADDR = { n0: '0x9a0', n1: '0x9c0', nn: '0x9e0' } as const;

function node(
  id: string,
  address: string,
  value: number | null,
  nextTarget: string | null,
  nextDisplay: string,
): HeapBlock {
  return {
    id,
    label: 'node',
    type: 'node_t',
    address,
    state: 'allocated',
    cells: [
      { kind: 'scalar', id: `${id}.value`, name: 'value', type: 'int', value, address },
      {
        kind: 'pointer',
        id: `${id}.next`,
        name: 'next',
        type: 'node_t *',
        target: nextTarget,
        display: nextDisplay,
      },
    ],
  };
}

const n0 = node('n0', ADDR.n0, 7, 'n1', ADDR.n1);

function ptr(
  id: string,
  name: string,
  target: string | null,
  display: string,
  address: string,
): PointerCell {
  return { kind: 'pointer', id, name, type: 'node_t *', target, display, address };
}

/** insert_tail frame; `new` and `current` are added once their locals are declared. */
function frame(
  newNode: { target: string | null; display: string } | null,
  current: { target: string | null; display: string } | null,
): StackFrame {
  const variables: Cell[] = [
    ptr('head', 'head', 'n0', ADDR.n0, '0x7ffd3010'),
    { kind: 'scalar', id: 'value', name: 'value', type: 'int', value: 9, address: '0x7ffd3018' },
  ];
  if (newNode) variables.push(ptr('new', 'new', newNode.target, newNode.display, '0x7ffd301c'));
  if (current) variables.push(ptr('current', 'current', current.target, current.display, '0x7ffd3020'));
  return { id: 'insert_tail', name: 'insert_tail', callId: 0, address: '0x7ffd3000', variables };
}

/** Heap with n1.next set per stage and the new node present or not. */
function heap(n1Next: string | null, n1NextDisplay: string, withNew: boolean): HeapBlock[] {
  const blocks: HeapBlock[] = [n0, node('n1', ADDR.n1, 4, n1Next, n1NextDisplay)];
  if (withNew) blocks.push(node('nn', ADDR.nn, 9, null, 'NULL'));
  return blocks;
}

const NN = { target: 'nn', display: ADDR.nn };
const NEQ = { expr: 'current->next != NULL' };

const steps: Step[] = [
  {
    id: 'enter',
    index: 0,
    narration: 'insert_tail is called with head at node 7 and value 9 to append.',
    highlightedLines: [8],
    stack: [frame(null, null)],
    heap: heap(null, 'NULL', false),
    activeId: 'head',
  },
  {
    id: 'malloc',
    index: 1,
    narration: 'new = malloc(sizeof(node_t)) allocates a fresh node at 0x9e0.',
    highlightedLines: [9],
    stack: [frame(NN, null)],
    heap: heap(null, 'NULL', true),
    activeId: 'nn',
  },
  {
    id: 'set-value',
    index: 2,
    narration: 'new->value = value writes 9 into the new node.',
    highlightedLines: [10],
    stack: [frame(NN, null)],
    heap: heap(null, 'NULL', true),
    activeId: 'nn.value',
  },
  {
    id: 'set-next-null',
    index: 3,
    narration: 'new->next = NULL marks the new node as the future end of the list.',
    highlightedLines: [11],
    stack: [frame(NN, null)],
    heap: heap(null, 'NULL', true),
    activeId: 'nn.next',
  },
  {
    id: 'current-head',
    index: 4,
    narration: 'current = head starts the walk to the last node at the first node (7).',
    highlightedLines: [12],
    stack: [frame(NN, { target: 'n0', display: ADDR.n0 })],
    heap: heap(null, 'NULL', true),
    activeId: 'current',
  },
  {
    id: 'check-1',
    index: 5,
    narration: 'current->next is node 4 — not NULL — so current is not the last node yet.',
    highlightedLines: [13],
    stack: [frame(NN, { target: 'n0', display: ADDR.n0 })],
    heap: heap(null, 'NULL', true),
    activeId: 'n0',
    condition: { ...NEQ, result: true },
  },
  {
    id: 'advance',
    index: 6,
    narration: 'current = current->next advances to node 4.',
    highlightedLines: [14],
    stack: [frame(NN, { target: 'n1', display: ADDR.n1 })],
    heap: heap(null, 'NULL', true),
    activeId: 'current',
  },
  {
    id: 'check-2',
    index: 7,
    narration: 'current->next is NULL now, so current is the last node — the walk stops.',
    highlightedLines: [13],
    stack: [frame(NN, { target: 'n1', display: ADDR.n1 })],
    heap: heap(null, 'NULL', true),
    activeId: 'n1',
    condition: { ...NEQ, result: false },
  },
  {
    id: 'splice',
    index: 8,
    narration:
      'current->next = new re-points the last node’s next from NULL to the new node. The list is now 7 -> 4 -> 9 -> NULL.',
    highlightedLines: [16],
    stack: [frame(NN, { target: 'n1', display: ADDR.n1 })],
    heap: heap('nn', ADDR.nn, true),
    activeId: 'n1.next',
  },
  {
    id: 'return',
    index: 9,
    narration: 'insert_tail returns head — unchanged, since appending does not move the first node.',
    highlightedLines: [17],
    stack: [frame(NN, { target: 'n1', display: ADDR.n1 })],
    heap: heap('nn', ADDR.nn, true),
    activeId: 'head',
  },
];

export const insertTailTrace: Trace = {
  id: 'se201-insert-tail',
  title: 'Insert at the tail of a linked list',
  course: 'SE 201',
  topic: 'Singly Linked Lists Part 1',
  file: 'insert_tail.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Singly Linked Lists Part 1'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: insertTailTrace,
  label: 'Insert at tail',
  summary: 'Walk to the last node, then splice the new node onto its next.',
  order: 21,
};
export default contentModule;
