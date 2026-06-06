/**
 * SE 201 · Doubly Linked Lists (week 4) — insert at head, fixing BOTH links.
 *
 * Prepending to a doubly linked list is the singly case plus one extra rewire: as well as pointing
 * the new node’s `next` at the old head, you must point the old head’s `prev` back at the new node.
 * Miss that and the backward chain is broken. Each of `new->next`, `head->prev`, and the final
 * `head = new` is a visible arrow retarget.
 *
 * Hand-traced: start 2 <-> 3; insert 1; result 1 <-> 2 <-> 3.
 */
import type { Cell, HeapBlock, PointerCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdlib.h>

typedef struct dnode {
    int value;
    struct dnode *prev;
    struct dnode *next;
} dnode_t;

dnode_t *insert_head(dnode_t *head, int value) {
    dnode_t *new = malloc(sizeof(dnode_t));
    new->value = value;
    new->prev = NULL;
    new->next = head;
    if (head != NULL) {
        head->prev = new;
    }
    head = new;
    return head;
}
`;

const ADDR = { d0: '0xc00', d1: '0xc20', nn: '0xc40' } as const;

function dnode(
  id: string,
  address: string,
  value: number | null,
  prevTarget: string | null,
  prevDisplay: string,
  nextTarget: string | null,
  nextDisplay: string,
): HeapBlock {
  return {
    id,
    label: 'node',
    type: 'dnode_t',
    address,
    state: 'allocated',
    cells: [
      { kind: 'scalar', id: `${id}.value`, name: 'value', type: 'int', value, address },
      {
        kind: 'pointer',
        id: `${id}.prev`,
        name: 'prev',
        type: 'dnode_t *',
        target: prevTarget,
        display: prevDisplay,
      },
      {
        kind: 'pointer',
        id: `${id}.next`,
        name: 'next',
        type: 'dnode_t *',
        target: nextTarget,
        display: nextDisplay,
      },
    ],
  };
}

/** d1 is constant throughout; d0.prev is the link that gets fixed; nn evolves as it is built. */
const d1 = dnode('d1', ADDR.d1, 3, 'd0', ADDR.d0, null, 'NULL');

function ptr(
  id: string,
  name: string,
  target: string | null,
  display: string,
  address: string,
): PointerCell {
  return { kind: 'pointer', id, name, type: 'dnode_t *', target, display, address };
}

function frame(
  headTarget: string,
  headDisplay: string,
  newNode: { target: string | null; display: string } | null,
): StackFrame {
  const variables: Cell[] = [
    ptr('head', 'head', headTarget, headDisplay, '0x7ffd6010'),
    { kind: 'scalar', id: 'value', name: 'value', type: 'int', value: 1, address: '0x7ffd6018' },
  ];
  if (newNode) variables.push(ptr('new', 'new', newNode.target, newNode.display, '0x7ffd601c'));
  return { id: 'insert_head', name: 'insert_head', callId: 0, address: '0x7ffd6000', variables };
}

/**
 * Heap for a stage: d0 with the given `prev` link, d1 (constant), and optionally the new node nn
 * built up to `nn` (value/prev/next supplied).
 */
function heap(
  d0Prev: string | null,
  d0PrevDisplay: string,
  nn: {
    value: number | null;
    prevDisplay: string;
    nextTarget: string | null;
    nextDisplay: string;
  } | null,
  /** Place the new node first (leftmost) once it has joined the front of the list, so the chain
   *  renders left→right as 1 ↔ 2 ↔ 3 instead of the new head sitting at the far right. */
  nnFirst = false,
): HeapBlock[] {
  const d0block = dnode('d0', ADDR.d0, 2, d0Prev, d0PrevDisplay, 'd1', ADDR.d1);
  if (!nn) return [d0block, d1];
  const nnBlock = dnode('nn', ADDR.nn, nn.value, null, nn.prevDisplay, nn.nextTarget, nn.nextDisplay);
  return nnFirst ? [nnBlock, d0block, d1] : [d0block, d1, nnBlock];
}

const NN = { target: 'nn', display: ADDR.nn };

const steps: Step[] = [
  {
    id: 'enter',
    index: 0,
    narration: 'insert_head is called with head at node 2 (which links back and forth with node 3) and value 1.',
    highlightedLines: [9],
    stack: [frame('d0', ADDR.d0, null)],
    heap: heap(null, 'NULL', null),
    activeId: 'head',
  },
  {
    id: 'malloc',
    index: 1,
    narration: 'new = malloc(sizeof(dnode_t)) allocates a fresh, uninitialised node at 0xc40.',
    highlightedLines: [10],
    stack: [frame('d0', ADDR.d0, NN)],
    heap: heap(null, 'NULL', {
      value: null,
      prevDisplay: '0x?',
      nextTarget: null,
      nextDisplay: '0x?',
    }),
    activeId: 'nn',
  },
  {
    id: 'set-value',
    index: 2,
    narration: 'new->value = value writes 1 into the new node.',
    highlightedLines: [11],
    stack: [frame('d0', ADDR.d0, NN)],
    heap: heap(null, 'NULL', {
      value: 1,
      prevDisplay: '0x?',
      nextTarget: null,
      nextDisplay: '0x?',
    }),
    activeId: 'nn.value',
  },
  {
    id: 'set-prev',
    index: 3,
    narration: 'new->prev = NULL — the new node will be the first, so nothing precedes it.',
    highlightedLines: [12],
    stack: [frame('d0', ADDR.d0, NN)],
    heap: heap(null, 'NULL', {
      value: 1,
      prevDisplay: 'NULL',
      nextTarget: null,
      nextDisplay: '0x?',
    }),
    activeId: 'nn.prev',
  },
  {
    id: 'set-next',
    index: 4,
    narration: 'new->next = head points the new node forward to node 2 (the old head).',
    highlightedLines: [13],
    stack: [frame('d0', ADDR.d0, NN)],
    heap: heap(null, 'NULL', { value: 1, prevDisplay: 'NULL', nextTarget: 'd0', nextDisplay: ADDR.d0 }, true),
    activeId: 'nn.next',
  },
  {
    id: 'check-head',
    index: 5,
    narration: 'head != NULL is true, so the old head exists and its prev link must be fixed too.',
    highlightedLines: [14],
    stack: [frame('d0', ADDR.d0, NN)],
    heap: heap(null, 'NULL', { value: 1, prevDisplay: 'NULL', nextTarget: 'd0', nextDisplay: ADDR.d0 }, true),
    activeId: 'head',
    condition: { expr: 'head != NULL', result: true },
  },
  {
    id: 'fix-prev',
    index: 6,
    narration:
      'head->prev = new points node 2 back to the new node — the second of the two links. Both directions are now consistent.',
    highlightedLines: [15],
    stack: [frame('d0', ADDR.d0, NN)],
    heap: heap('nn', ADDR.nn, { value: 1, prevDisplay: 'NULL', nextTarget: 'd0', nextDisplay: ADDR.d0 }, true),
    activeId: 'd0.prev',
  },
  {
    id: 'move-head',
    index: 7,
    narration: 'head = new moves head to the new node. The list is now 1 <-> 2 <-> 3.',
    highlightedLines: [17],
    stack: [frame('nn', ADDR.nn, NN)],
    heap: heap('nn', ADDR.nn, { value: 1, prevDisplay: 'NULL', nextTarget: 'd0', nextDisplay: ADDR.d0 }, true),
    activeId: 'head',
  },
  {
    id: 'return',
    index: 8,
    narration: 'insert_head returns the new head (0xc40). The doubly linked list starts at node 1.',
    highlightedLines: [18],
    stack: [frame('nn', ADDR.nn, NN)],
    heap: heap('nn', ADDR.nn, { value: 1, prevDisplay: 'NULL', nextTarget: 'd0', nextDisplay: ADDR.d0 }, true),
    activeId: 'head',
  },
];

export const doublyInsertTrace: Trace = {
  id: 'se201-doubly-insert',
  title: 'Insert at the head of a doubly linked list',
  course: 'SE 201',
  topic: 'Doubly Linked Lists',
  file: 'insert_head.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Doubly Linked Lists'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: doublyInsertTrace,
  label: 'Doubly: insert at head',
  summary: 'Set new->next AND head->prev — a doubly list needs both links fixed.',
  order: 41,
};
export default contentModule;
