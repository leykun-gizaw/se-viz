/**
 * SE 201 · Doubly Linked Lists (week 4) — traverse forward and backward.
 *
 * A doubly linked node carries two pointers: `next` (toward the tail) and `prev` (toward the head),
 * so each node renders with arrows in both directions. The first loop walks `current` forward to
 * NULL (printing 1 2 3) while remembering the tail; the second loop walks `tail` backward along
 * `prev` to NULL (printing 3 2 1). The chain never changes — the lesson is that `prev` lets you go
 * back, which a singly list cannot.
 *
 * Hand-traced list: 1 <-> 2 <-> 3. Console output: "1 2 3 3 2 1 ".
 */
import type { HeapBlock, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

typedef struct dnode {
    int value;
    struct dnode *prev;
    struct dnode *next;
} dnode_t;

void traverse_both(dnode_t *head) {
    dnode_t *current = head;
    dnode_t *tail = NULL;
    while (current != NULL) {
        printf("%d ", current->value);
        tail = current;
        current = current->next;
    }
    while (tail != NULL) {
        printf("%d ", tail->value);
        tail = tail->prev;
    }
}
`;

const ADDR = { d0: '0xb00', d1: '0xb20', d2: '0xb40' } as const;

/** A doubly node: int `value`, a `prev` pointer and a `next` pointer (each a target id or NULL). */
function dnode(
  id: string,
  address: string,
  value: number,
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

const nodes: HeapBlock[] = [
  dnode('d0', ADDR.d0, 1, null, 'NULL', 'd1', ADDR.d1),
  dnode('d1', ADDR.d1, 2, 'd0', ADDR.d0, 'd2', ADDR.d2),
  dnode('d2', ADDR.d2, 3, 'd1', ADDR.d1, null, 'NULL'),
];

function frame(
  currentTarget: string | null,
  currentDisplay: string,
  tailTarget: string | null,
  tailDisplay: string,
): StackFrame {
  return {
    id: 'traverse_both',
    name: 'traverse_both',
    callId: 0,
    address: '0x7ffd5000',
    variables: [
      {
        kind: 'pointer',
        id: 'head',
        name: 'head',
        type: 'dnode_t *',
        target: 'd0',
        display: ADDR.d0,
        address: '0x7ffd5010',
      },
      {
        kind: 'pointer',
        id: 'current',
        name: 'current',
        type: 'dnode_t *',
        target: currentTarget,
        display: currentDisplay,
        address: '0x7ffd5018',
      },
      {
        kind: 'pointer',
        id: 'tail',
        name: 'tail',
        type: 'dnode_t *',
        target: tailTarget,
        display: tailDisplay,
        address: '0x7ffd5020',
      },
    ],
  };
}

const A = ADDR;
const FWD = { expr: 'current != NULL' };
const BWD = { expr: 'tail != NULL' };

const steps: Step[] = [
  {
    id: 'current-head',
    index: 0,
    narration: 'current = head starts the forward walk at the first node (1).',
    highlightedLines: [10],
    stack: [frame('d0', A.d0, null, 'NULL')],
    heap: nodes,
    activeId: 'current',
  },
  {
    id: 'tail-null',
    index: 1,
    narration: 'tail = NULL — we have not reached the last node yet.',
    highlightedLines: [11],
    stack: [frame('d0', A.d0, null, 'NULL')],
    heap: nodes,
    activeId: 'tail',
  },
  {
    id: 'fwd-check-1',
    index: 2,
    narration: 'current is not NULL, so the forward loop runs.',
    highlightedLines: [12],
    stack: [frame('d0', A.d0, null, 'NULL')],
    heap: nodes,
    activeId: 'd0',
    condition: { ...FWD, result: true },
  },
  {
    id: 'fwd-print-1',
    index: 3,
    narration: 'printf writes current->value, which is 1.',
    highlightedLines: [13],
    stack: [frame('d0', A.d0, null, 'NULL')],
    heap: nodes,
    activeId: 'd0',
    stdout: ['1 '],
  },
  {
    id: 'fwd-tail-1',
    index: 4,
    narration: 'tail = current records node 1 as the last node seen so far.',
    highlightedLines: [14],
    stack: [frame('d0', A.d0, 'd0', A.d0)],
    heap: nodes,
    activeId: 'tail',
    stdout: ['1 '],
  },
  {
    id: 'fwd-advance-1',
    index: 5,
    narration: 'current = current->next follows the next arrow to node 2.',
    highlightedLines: [15],
    stack: [frame('d1', A.d1, 'd0', A.d0)],
    heap: nodes,
    activeId: 'current',
    stdout: ['1 '],
  },
  {
    id: 'fwd-check-2',
    index: 6,
    narration: 'current is still not NULL — continue.',
    highlightedLines: [12],
    stack: [frame('d1', A.d1, 'd0', A.d0)],
    heap: nodes,
    activeId: 'd1',
    condition: { ...FWD, result: true },
    stdout: ['1 '],
  },
  {
    id: 'fwd-print-2',
    index: 7,
    narration: 'printf writes current->value, which is 2.',
    highlightedLines: [13],
    stack: [frame('d1', A.d1, 'd0', A.d0)],
    heap: nodes,
    activeId: 'd1',
    stdout: ['1 2 '],
  },
  {
    id: 'fwd-tail-2',
    index: 8,
    narration: 'tail = current updates the last-seen node to node 2.',
    highlightedLines: [14],
    stack: [frame('d1', A.d1, 'd1', A.d1)],
    heap: nodes,
    activeId: 'tail',
    stdout: ['1 2 '],
  },
  {
    id: 'fwd-advance-2',
    index: 9,
    narration: 'current advances along next to node 3.',
    highlightedLines: [15],
    stack: [frame('d2', A.d2, 'd1', A.d1)],
    heap: nodes,
    activeId: 'current',
    stdout: ['1 2 '],
  },
  {
    id: 'fwd-check-3',
    index: 10,
    narration: 'current is the last node — not NULL — so the body runs once more.',
    highlightedLines: [12],
    stack: [frame('d2', A.d2, 'd1', A.d1)],
    heap: nodes,
    activeId: 'd2',
    condition: { ...FWD, result: true },
    stdout: ['1 2 '],
  },
  {
    id: 'fwd-print-3',
    index: 11,
    narration: 'printf writes current->value, which is 3.',
    highlightedLines: [13],
    stack: [frame('d2', A.d2, 'd1', A.d1)],
    heap: nodes,
    activeId: 'd2',
    stdout: ['1 2 3 '],
  },
  {
    id: 'fwd-tail-3',
    index: 12,
    narration: 'tail = current now points at node 3 — the true tail of the list.',
    highlightedLines: [14],
    stack: [frame('d2', A.d2, 'd2', A.d2)],
    heap: nodes,
    activeId: 'tail',
    stdout: ['1 2 3 '],
  },
  {
    id: 'fwd-advance-3',
    index: 13,
    narration: 'current = current->next becomes NULL — node 3’s next is the NULL sink.',
    highlightedLines: [15],
    stack: [frame(null, 'NULL', 'd2', A.d2)],
    heap: nodes,
    activeId: 'current',
    stdout: ['1 2 3 '],
  },
  {
    id: 'fwd-check-end',
    index: 14,
    narration: 'current == NULL ends the forward loop. tail is left pointing at node 3.',
    highlightedLines: [12],
    stack: [frame(null, 'NULL', 'd2', A.d2)],
    heap: nodes,
    activeId: 'tail',
    condition: { ...FWD, result: false },
    stdout: ['1 2 3 '],
  },
  {
    id: 'bwd-check-1',
    index: 15,
    narration: 'The backward loop begins: tail is not NULL, so it runs.',
    highlightedLines: [17],
    stack: [frame(null, 'NULL', 'd2', A.d2)],
    heap: nodes,
    activeId: 'd2',
    condition: { ...BWD, result: true },
    stdout: ['1 2 3 '],
  },
  {
    id: 'bwd-print-1',
    index: 16,
    narration: 'printf writes tail->value, which is 3 — the same last node, now read going back.',
    highlightedLines: [18],
    stack: [frame(null, 'NULL', 'd2', A.d2)],
    heap: nodes,
    activeId: 'd2',
    stdout: ['1 2 3 3 '],
  },
  {
    id: 'bwd-advance-1',
    index: 17,
    narration: 'tail = tail->prev steps backward along the prev arrow to node 2.',
    highlightedLines: [19],
    stack: [frame(null, 'NULL', 'd1', A.d1)],
    heap: nodes,
    activeId: 'tail',
    stdout: ['1 2 3 3 '],
  },
  {
    id: 'bwd-check-2',
    index: 18,
    narration: 'tail is not NULL — continue going back.',
    highlightedLines: [17],
    stack: [frame(null, 'NULL', 'd1', A.d1)],
    heap: nodes,
    activeId: 'd1',
    condition: { ...BWD, result: true },
    stdout: ['1 2 3 3 '],
  },
  {
    id: 'bwd-print-2',
    index: 19,
    narration: 'printf writes tail->value, which is 2.',
    highlightedLines: [18],
    stack: [frame(null, 'NULL', 'd1', A.d1)],
    heap: nodes,
    activeId: 'd1',
    stdout: ['1 2 3 3 2 '],
  },
  {
    id: 'bwd-advance-2',
    index: 20,
    narration: 'tail = tail->prev steps back to node 1.',
    highlightedLines: [19],
    stack: [frame(null, 'NULL', 'd0', A.d0)],
    heap: nodes,
    activeId: 'tail',
    stdout: ['1 2 3 3 2 '],
  },
  {
    id: 'bwd-check-3',
    index: 21,
    narration: 'tail is the first node — not NULL — so the body runs a last time.',
    highlightedLines: [17],
    stack: [frame(null, 'NULL', 'd0', A.d0)],
    heap: nodes,
    activeId: 'd0',
    condition: { ...BWD, result: true },
    stdout: ['1 2 3 3 2 '],
  },
  {
    id: 'bwd-print-3',
    index: 22,
    narration: 'printf writes tail->value, which is 1.',
    highlightedLines: [18],
    stack: [frame(null, 'NULL', 'd0', A.d0)],
    heap: nodes,
    activeId: 'd0',
    stdout: ['1 2 3 3 2 1 '],
  },
  {
    id: 'bwd-advance-3',
    index: 23,
    narration: 'tail = tail->prev becomes NULL — node 1’s prev is the NULL sink.',
    highlightedLines: [19],
    stack: [frame(null, 'NULL', null, 'NULL')],
    heap: nodes,
    activeId: 'tail',
    stdout: ['1 2 3 3 2 1 '],
  },
  {
    id: 'bwd-check-end',
    index: 24,
    narration: 'tail == NULL ends the backward loop. The list was printed forward then backward.',
    highlightedLines: [17],
    stack: [frame(null, 'NULL', null, 'NULL')],
    heap: nodes,
    activeId: 'tail',
    condition: { ...BWD, result: false },
    stdout: ['1 2 3 3 2 1 '],
  },
];

export const doublyTraverseTrace: Trace = {
  id: 'se201-doubly-traverse',
  title: 'Traverse a doubly linked list both ways',
  course: 'SE 201',
  topic: 'Doubly Linked Lists',
  file: 'traverse_both.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Doubly Linked Lists'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: doublyTraverseTrace,
  label: 'Doubly: traverse both ways',
  summary: 'next walks forward, prev walks back — two arrow directions per node.',
  order: 40,
};
export default contentModule;
