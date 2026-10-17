/**
 * SE 201 · Singly Linked Lists Part 1 (week 2) — insert at head.
 *
 * `malloc` a node, then perform the two pointer rewires **in the right order**:
 *   1. `new->next = head;`  — link the new node to the current first node FIRST.
 *   2. `head = new;`        — only then move head to the new node.
 * If you did these the other way round (`head = new;` before reading the old head) you would lose
 * the address of the rest of the list. Each rewire is a visible arrow retarget.
 *
 * Hand-traced: start 7 -> 4 -> NULL; insert 2; result 2 -> 7 -> 4 -> NULL.
 */
import type {
  Cell,
  HeapBlock,
  PointerCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdlib.h>

typedef struct node {
    int value;
    struct node *next;
} node_t;

node_t *insert_head(node_t *head, int value) {
    node_t *new = malloc(sizeof(node_t));
    new->value = value;
    new->next = head;
    head = new;
    return head;
}
`;

const ADDR = { n0: '0x8a0', n1: '0x8c0', nn: '0x8e0' } as const;

/** A node block with an int `value` and a `next` pointer (target by id, or NULL). */
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

/** The two original nodes never change. */
const baseNodes: [HeapBlock, HeapBlock] = [
  node('n0', ADDR.n0, 7, 'n1', ADDR.n1),
  node('n1', ADDR.n1, 4, null, 'NULL'),
];

function ptr(
  id: string,
  name: string,
  target: string | null,
  display: string,
  address: string,
): PointerCell {
  return { kind: 'pointer', id, name, type: 'node_t *', target, display, address };
}

/**
 * The insert_head frame. `head` retargets at the end; `value` is constant; `newNode` only exists
 * once the local has been declared (pass `null` before that).
 */
function frame(
  headTarget: string | null,
  headDisplay: string,
  newNode: { target: string | null; display: string } | null,
): StackFrame {
  const variables: Cell[] = [
    ptr('head', 'head', headTarget, headDisplay, '0x7ffd2010'),
    { kind: 'scalar', id: 'value', name: 'value', type: 'int', value: 2, address: '0x7ffd2018' },
  ];
  if (newNode) {
    variables.push(ptr('new', 'new', newNode.target, newNode.display, '0x7ffd201c'));
  }
  return { id: 'insert_head', name: 'insert_head', callId: 0, address: '0x7ffd2000', variables };
}

const steps: Step[] = [
  {
    id: 'enter',
    index: 0,
    explain: {
      did: [
        '`insert_head` is called with `head` pointing at the first node (value 7) and `value` set to 2.',
        'The list is 7 -> 4 -> NULL. Nothing new has been allocated yet.',
      ],
      concept:
        "`head` is the function's own copy of the caller's pointer. Changing it here does not change the caller's variable, which is why the function returns the new head.",
    },
    narration: 'insert_head is called with head pointing at node 7 and value 2 to prepend.',
    highlightedLines: [8],
    stack: [frame('n0', ADDR.n0, null)],
    heap: baseNodes,
    activeId: 'head',
  },
  {
    id: 'malloc',
    index: 1,
    explain: {
      did: [
        '`malloc(sizeof(node_t))` reserves a node-sized block on the heap, at `0x8e0`.',
        "The local `new` now holds that block's address.",
        "The node's fields are uninitialised (`?`): `malloc` does not clear memory.",
      ],
      concept:
        'Heap memory outlives the function call: this node stays allocated after `insert_head` returns, until someone calls `free` on it.',
    },
    narration: 'new = malloc(sizeof(node_t)) allocates a fresh, uninitialised node at 0x8e0.',
    highlightedLines: [9],
    stack: [frame('n0', ADDR.n0, { target: 'nn', display: ADDR.nn })],
    heap: [...baseNodes, node('nn', ADDR.nn, null, null, '0x?')],
    activeId: 'nn',
  },
  {
    id: 'set-value',
    index: 2,
    explain: {
      did: ['`new->value = value` follows `new` to the node and stores 2 in its `value` field.'],
      concept:
        '`p->field` is shorthand for `(*p).field`: follow the pointer, then select the field.',
    },
    narration: 'new->value = value writes 2 into the new node.',
    highlightedLines: [10],
    stack: [frame('n0', ADDR.n0, { target: 'nn', display: ADDR.nn })],
    heap: [...baseNodes, node('nn', ADDR.nn, 2, null, '0x?')],
    activeId: 'nn.value',
    coach: {
      variant: 'predict',
      title: 'Two rewires ahead',
      body: 'We need to splice this node in with two pointer assignments. Does the order matter — could one ordering lose the rest of the list?',
      anchorId: 'new',
    },
  },
  {
    id: 'link-next',
    index: 3,
    explain: {
      did: [
        "`new->next = head` copies the address in `head` (the node holding 7) into the new node's `next` field.",
        'The new node now leads to the old first node, so the rest of the list is reachable from it.',
      ],
      concept:
        'Order matters: link the new node **before** moving `head`. If `head` moved first, nothing would point at node 7 any more and the rest of the list would be lost.',
    },
    narration:
      'new->next = head links the new node to the old first node (7) — do this BEFORE moving head, or the rest of the list is lost.',
    highlightedLines: [11],
    stack: [frame('n0', ADDR.n0, { target: 'nn', display: ADDR.nn })],
    heap: [node('nn', ADDR.nn, 2, 'n0', ADDR.n0), ...baseNodes],
    activeId: 'nn.next',
    coach: {
      variant: 'watch-out',
      title: 'Order matters',
      body: 'Link new->next = head FIRST, while head still points at node 7. If you did head = new first, you would overwrite head and lose the address of the rest of the list.',
      anchorId: 'nn.next',
    },
  },
  {
    id: 'move-head',
    index: 4,
    explain: {
      did: [
        "`head = new` copies the new node's address into `head`.",
        'Read from `head`, the list is now 2 -> 7 -> 4 -> NULL.',
      ],
    },
    narration: 'head = new now retargets head to the new node. The list is 2 -> 7 -> 4 -> NULL.',
    highlightedLines: [12],
    stack: [frame('nn', ADDR.nn, { target: 'nn', display: ADDR.nn })],
    heap: [node('nn', ADDR.nn, 2, 'n0', ADDR.n0), ...baseNodes],
    activeId: 'head',
  },
  {
    id: 'return',
    index: 5,
    explain: {
      did: [
        "`return head;` hands the new first node's address (`0x8e0`) back to the caller.",
        'The caller must store it, e.g. `list = insert_head(list, 2);`, or the new node is unreachable.',
      ],
      concept:
        'Inserting at the head takes the same two pointer assignments however long the list is: it is O(1).',
    },
    narration: 'insert_head returns the new head (0x8e0) — the caller’s list now starts at node 2.',
    highlightedLines: [13],
    stack: [frame('nn', ADDR.nn, { target: 'nn', display: ADDR.nn })],
    heap: [node('nn', ADDR.nn, 2, 'n0', ADDR.n0), ...baseNodes],
    activeId: 'head',
  },
];

export const insertHeadTrace: Trace = {
  id: 'se201-insert-head',
  title: 'Insert at the head of a linked list',
  course: 'SE 201',
  topic: 'Singly Linked Lists Part 1',
  file: 'insert_head.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Singly Linked Lists Part 1'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: insertHeadTrace,
  label: 'Insert at head',
  summary: 'malloc a node, link new->next = head, then head = new — order matters.',
  order: 20,
};
export default contentModule;
