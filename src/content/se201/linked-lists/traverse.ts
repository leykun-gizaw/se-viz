/**
 * SE 201 · Introduction to Singly Linked Lists (week 1) — walking a chain.
 *
 * The canonical traversal: `current` starts at `head` and follows each node's `next` pointer until
 * it reaches `NULL`, printing every value along the way. Each `current = current->next` is a visible
 * arrow retarget (the glide from one heap node to the next); the chain itself never changes, so the
 * teaching focus is purely the pointer walking down the list to the `NULL` sink.
 *
 * Hand-traced list: 5 -> 9 -> 14 -> NULL. Console output: "5", "9", "14".
 *
 * This is the curriculum-quality counterpart of the Phase 1 `linkedList` fixture (kept separately as
 * an engine-test fixture); see the report's deviations section.
 */
import type { HeapBlock, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdio.h>

typedef struct node {
    int value;
    struct node *next;
} node_t;

void print_list(node_t *head) {
    node_t *current = head;
    while (current != NULL) {
        printf("%d\\n", current->value);
        current = current->next;
    }
}
`;

const ADDR = { n0: '0x5500', n1: '0x5520', n2: '0x5540' } as const;

/** Build a node heap block: an int `value` and a `next` pointer to the following node (or NULL). */
function node(
  id: string,
  address: string,
  value: number,
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

const nodes: HeapBlock[] = [
  node('n0', ADDR.n0, 5, 'n1', ADDR.n1),
  node('n1', ADDR.n1, 9, 'n2', ADDR.n2),
  node('n2', ADDR.n2, 14, null, 'NULL'),
];

/** The print_list() frame with head fixed to n0 and current aimed at `currentTarget`. */
function frame(currentTarget: string | null, currentDisplay: string): StackFrame {
  return {
    id: 'print_list',
    name: 'print_list',
    callId: 0,
    address: '0x7ffd1000',
    variables: [
      {
        kind: 'pointer',
        id: 'head',
        name: 'head',
        type: 'node_t *',
        target: 'n0',
        display: ADDR.n0,
        address: '0x7ffd1010',
      },
      {
        kind: 'pointer',
        id: 'current',
        name: 'current',
        type: 'node_t *',
        target: currentTarget,
        display: currentDisplay,
        address: '0x7ffd1018',
      },
    ],
  };
}

const NEQ = { expr: 'current != NULL' };

const steps: Step[] = [
  {
    id: 'init-current',
    index: 0,
    narration: 'current starts at head — the first node, whose value is 5.',
    highlightedLines: [9],
    stack: [frame('n0', ADDR.n0)],
    heap: nodes,
    activeId: 'current',
  },
  {
    id: 'check-1',
    index: 1,
    narration: 'current is not NULL, so the loop body runs.',
    highlightedLines: [10],
    stack: [frame('n0', ADDR.n0)],
    heap: nodes,
    activeId: 'n0',
    condition: { ...NEQ, result: true },
  },
  {
    id: 'print-1',
    index: 2,
    narration: 'printf reads current->value (5) and writes it to the console.',
    highlightedLines: [11],
    stack: [frame('n0', ADDR.n0)],
    heap: nodes,
    activeId: 'n0',
    stdout: ['5'],
  },
  {
    id: 'advance-1',
    index: 3,
    narration: 'current = current->next follows the first node’s next arrow to the second node (value 9).',
    highlightedLines: [12],
    stack: [frame('n1', ADDR.n1)],
    heap: nodes,
    activeId: 'current',
    stdout: ['5'],
  },
  {
    id: 'check-2',
    index: 4,
    narration: 'current is still not NULL — keep going.',
    highlightedLines: [10],
    stack: [frame('n1', ADDR.n1)],
    heap: nodes,
    activeId: 'n1',
    condition: { ...NEQ, result: true },
    stdout: ['5'],
  },
  {
    id: 'print-2',
    index: 5,
    narration: 'printf writes current->value, which is 9.',
    highlightedLines: [11],
    stack: [frame('n1', ADDR.n1)],
    heap: nodes,
    activeId: 'n1',
    stdout: ['5', '9'],
  },
  {
    id: 'advance-2',
    index: 6,
    narration: 'current advances along next to the third node, whose value is 14.',
    highlightedLines: [12],
    stack: [frame('n2', ADDR.n2)],
    heap: nodes,
    activeId: 'current',
    stdout: ['5', '9'],
  },
  {
    id: 'check-3',
    index: 7,
    narration: 'current points at the last node — not NULL — so the body runs once more.',
    highlightedLines: [10],
    stack: [frame('n2', ADDR.n2)],
    heap: nodes,
    activeId: 'n2',
    condition: { ...NEQ, result: true },
    stdout: ['5', '9'],
  },
  {
    id: 'print-3',
    index: 8,
    narration: 'printf writes the last value, 14.',
    highlightedLines: [11],
    stack: [frame('n2', ADDR.n2)],
    heap: nodes,
    activeId: 'n2',
    stdout: ['5', '9', '14'],
  },
  {
    id: 'advance-null',
    index: 9,
    narration: 'The last node’s next is NULL, so current becomes NULL — it now points at the NULL sink.',
    highlightedLines: [12],
    stack: [frame(null, 'NULL')],
    heap: nodes,
    activeId: 'current',
    stdout: ['5', '9', '14'],
  },
  {
    id: 'check-end',
    index: 10,
    narration: 'current == NULL, so the loop test is false and traversal ends.',
    highlightedLines: [10],
    stack: [frame(null, 'NULL')],
    heap: nodes,
    activeId: 'current',
    condition: { ...NEQ, result: false },
    stdout: ['5', '9', '14'],
  },
];

export const singlyTraverseTrace: Trace = {
  id: 'se201-singly-traverse',
  title: 'Traverse a singly linked list',
  course: 'SE 201',
  topic: 'Introduction to Singly Linked Lists',
  file: 'print_list.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Introduction to Singly Linked Lists'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: singlyTraverseTrace,
  label: 'Traverse',
  summary: 'Walk current down the next chain to NULL, printing each node.',
  order: 10,
};
export default contentModule;
