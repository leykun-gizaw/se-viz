/**
 * Validation fixture 2 — linked-list traversal (PDF screen 02): walking a 3-node `node_t` chain
 * with `head` and `current` pointers.
 *
 * Exercises: struct nodes in the heap, azure pointer arrows resolved by stable id, the `next`-chain
 * to a NULL sink, and the `current` retarget glide as the pointer advances node → node.
 *
 * Breadcrumb (SE 201 · Linked lists) is correct per docs/CURRICULUM.md. The `count` value is
 * authored correctly here: it is incremented once per completed iteration (the design mockup's
 * count was a known placeholder inconsistency).
 */
import type { HeapBlock, StackFrame, Step, Trace } from '../../engine/trace/types.ts';
import type { ContentModule } from '../module.ts';

const SOURCE = `typedef struct node {
    int value;
    struct node *next;
} node_t;

void traverse(node_t *head) {
    node_t *current = head;
    int count = 0;
    while (current != NULL) {
        visit(current->value);
        current = current->next;
        count++;
    }
}
`;

const ADDR = { n0: '0x6a10', n1: '0x6a40', n2: '0x6a70' } as const;

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
  node('n0', ADDR.n0, 12, 'n1', ADDR.n1),
  node('n1', ADDR.n1, 99, 'n2', ADDR.n2),
  node('n2', ADDR.n2, 37, null, 'NULL'),
];

/** The traverse() frame with head fixed to n0 and current aimed at `currentTarget`. */
function frame(
  currentTarget: string | null,
  currentDisplay: string,
  count: number | null,
): StackFrame {
  return {
    id: 'traverse',
    name: 'traverse',
    callId: 0,
    address: '0x7ffd0000',
    variables: [
      {
        kind: 'pointer',
        id: 'head',
        name: 'head',
        type: 'node_t *',
        target: 'n0',
        display: ADDR.n0,
        address: '0x7ffd0010',
      },
      {
        kind: 'pointer',
        id: 'current',
        name: 'current',
        type: 'node_t *',
        target: currentTarget,
        display: currentDisplay,
        address: '0x7ffd0014',
      },
      {
        kind: 'scalar',
        id: 'count',
        name: 'count',
        type: 'int',
        value: count,
        address: '0x7ffd0018',
      },
    ],
  };
}

const steps: Step[] = [
  {
    id: 'init-current',
    index: 0,
    narration: 'current starts at head — the first node, whose value is 12.',
    highlightedLines: [7],
    stack: [frame('n0', ADDR.n0, null)],
    heap: nodes,
    activeId: 'current',
  },
  {
    id: 'init-count',
    index: 1,
    narration: 'count is initialised to 0.',
    highlightedLines: [8],
    stack: [frame('n0', ADDR.n0, 0)],
    heap: nodes,
    activeId: 'count',
  },
  {
    id: 'check-1',
    index: 2,
    narration: 'current is not NULL, so the loop body runs.',
    highlightedLines: [9],
    stack: [frame('n0', ADDR.n0, 0)],
    heap: nodes,
    activeId: 'n0',
  },
  {
    id: 'visit-1',
    index: 3,
    narration: 'visit reads current->value, which is 12.',
    highlightedLines: [10],
    stack: [frame('n0', ADDR.n0, 0)],
    heap: nodes,
    activeId: 'n0',
  },
  {
    id: 'advance-1',
    index: 4,
    narration: 'current = current->next advances the pointer to the second node — its value is 99.',
    highlightedLines: [11],
    stack: [frame('n1', ADDR.n1, 0)],
    heap: nodes,
    activeId: 'n1',
  },
  {
    id: 'count-1',
    index: 5,
    narration: 'count++ makes count 1 — one node visited so far.',
    highlightedLines: [12],
    stack: [frame('n1', ADDR.n1, 1)],
    heap: nodes,
    activeId: 'count',
  },
  {
    id: 'visit-2',
    index: 6,
    narration: 'Second iteration: visit reads current->value, which is 99.',
    highlightedLines: [10],
    stack: [frame('n1', ADDR.n1, 1)],
    heap: nodes,
    activeId: 'n1',
  },
  {
    id: 'advance-2',
    index: 7,
    narration: 'current advances to the third node, whose value is 37.',
    highlightedLines: [11],
    stack: [frame('n2', ADDR.n2, 1)],
    heap: nodes,
    activeId: 'n2',
  },
  {
    id: 'count-2',
    index: 8,
    narration: 'count++ makes count 2.',
    highlightedLines: [12],
    stack: [frame('n2', ADDR.n2, 2)],
    heap: nodes,
    activeId: 'count',
  },
  {
    id: 'advance-null',
    index: 9,
    narration: "The third node's next is NULL, so current becomes NULL and the loop ends.",
    highlightedLines: [11],
    stack: [frame(null, 'NULL', 2)],
    heap: nodes,
    activeId: 'current',
  },
];

export const linkedListTrace: Trace = {
  id: 'fixture-linked-list',
  title: 'Linked-list traversal — head & current',
  course: 'SE 201',
  topic: 'Linked lists',
  file: 'traverse.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Singly linked lists'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: linkedListTrace,
  label: 'Linked-list traversal',
  summary: 'Heap nodes, next arrows, current retarget, NULL sink.',
  order: 10,
  course: 'Engine fixtures',
  topic: 'Renderer primitives',
};
export default contentModule;
