/**
 * SE 201 · Singly Linked Lists Part 2 (week 3) — delete a node (pointer surgery + free).
 *
 * Find the node by value while remembering its predecessor (`prev`), then re-point the
 * predecessor’s `next` *around* the doomed node and `free` it (it turns to the `freed` state).
 * The order is the whole lesson: you must read `current->next` (to bridge prev -> n2) BEFORE you
 * `free(current)`. Freeing first would leave you reaching through a dangling pointer for the rest
 * of the list — the classic use-after-free bug.
 *
 * Hand-traced: start 7 -> 4 -> 9 -> NULL; delete value 4 (the middle node); result 7 -> 9 -> NULL,
 * with the old middle node freed.
 */
import type { Cell, HeapBlock, PointerCell, StackFrame, Step, Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#include <stdlib.h>

typedef struct node {
    int value;
    struct node *next;
} node_t;

node_t *delete_value(node_t *head, int target) {
    node_t *current = head;
    node_t *prev = NULL;
    while (current != NULL && current->value != target) {
        prev = current;
        current = current->next;
    }
    if (current == NULL) return head;
    if (prev == NULL) {
        head = current->next;
    } else {
        prev->next = current->next;
    }
    free(current);
    return head;
}
`;

const ADDR = { n0: '0xa00', n1: '0xa20', n2: '0xa40' } as const;

function node(
  id: string,
  address: string,
  value: number,
  nextTarget: string | null,
  nextDisplay: string,
  state: HeapBlock['state'] = 'allocated',
): HeapBlock {
  return {
    id,
    label: 'node',
    type: 'node_t',
    address,
    state,
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

function ptr(
  id: string,
  name: string,
  target: string | null,
  display: string,
  address: string,
): PointerCell {
  return { kind: 'pointer', id, name, type: 'node_t *', target, display, address };
}

/** delete_value frame. `prev` is added once declared; head retargets only in the prev==NULL branch. */
function frame(
  headTarget: string,
  headDisplay: string,
  current: { target: string | null; display: string },
  prev: { target: string | null; display: string } | null,
): StackFrame {
  const variables: Cell[] = [
    ptr('head', 'head', headTarget, headDisplay, '0x7ffd4010'),
    { kind: 'scalar', id: 'target', name: 'target', type: 'int', value: 4, address: '0x7ffd4018' },
    ptr('current', 'current', current.target, current.display, '0x7ffd401c'),
  ];
  if (prev) variables.push(ptr('prev', 'prev', prev.target, prev.display, '0x7ffd4020'));
  return { id: 'delete_value', name: 'delete_value', callId: 0, address: '0x7ffd4000', variables };
}

/** Heap; n0.next is n1 until the bridge step (then n2); n1 is freed in the final stages. */
function heap(n0Next: string, n0NextDisplay: string, n1State: HeapBlock['state']): HeapBlock[] {
  return [
    node('n0', ADDR.n0, 7, n0Next, n0NextDisplay),
    node('n1', ADDR.n1, 4, 'n2', ADDR.n2, n1State),
    node('n2', ADDR.n2, 9, null, 'NULL'),
  ];
}

const N0 = { target: 'n0', display: ADDR.n0 } as const;
const N1 = { target: 'n1', display: ADDR.n1 } as const;
const NUL = { target: null, display: 'NULL' } as const;

const steps: Step[] = [
  {
    id: 'enter',
    index: 0,
    narration: 'delete_value is called to remove the node whose value is 4 from 7 -> 4 -> 9 -> NULL.',
    highlightedLines: [8],
    stack: [frame('n0', ADDR.n0, N0, null)],
    heap: heap('n1', ADDR.n1, 'allocated'),
    activeId: 'head',
  },
  {
    id: 'current-head',
    index: 1,
    narration: 'current = head begins the search at the first node (7).',
    highlightedLines: [9],
    stack: [frame('n0', ADDR.n0, N0, null)],
    heap: heap('n1', ADDR.n1, 'allocated'),
    activeId: 'current',
  },
  {
    id: 'prev-null',
    index: 2,
    narration: 'prev = NULL — there is no predecessor yet.',
    highlightedLines: [10],
    stack: [frame('n0', ADDR.n0, N0, NUL)],
    heap: heap('n1', ADDR.n1, 'allocated'),
    activeId: 'prev',
  },
  {
    id: 'check-1',
    index: 3,
    narration: 'current is not NULL and current->value (7) is not 4 — keep searching.',
    highlightedLines: [11],
    stack: [frame('n0', ADDR.n0, N0, NUL)],
    heap: heap('n1', ADDR.n1, 'allocated'),
    activeId: 'n0',
    condition: { expr: 'current != NULL && current->value != target', result: true },
  },
  {
    id: 'advance-prev',
    index: 4,
    narration: 'prev = current remembers node 7 as the predecessor.',
    highlightedLines: [12],
    stack: [frame('n0', ADDR.n0, N0, N0)],
    heap: heap('n1', ADDR.n1, 'allocated'),
    activeId: 'prev',
  },
  {
    id: 'advance-current',
    index: 5,
    narration: 'current = current->next moves to node 4.',
    highlightedLines: [13],
    stack: [frame('n0', ADDR.n0, N1, N0)],
    heap: heap('n1', ADDR.n1, 'allocated'),
    activeId: 'current',
  },
  {
    id: 'check-2',
    index: 6,
    narration: 'current->value (4) equals target, so the second test is false — the loop stops with current on the match.',
    highlightedLines: [11],
    stack: [frame('n0', ADDR.n0, N1, N0)],
    heap: heap('n1', ADDR.n1, 'allocated'),
    activeId: 'n1',
    condition: { expr: 'current != NULL && current->value != target', result: false },
  },
  {
    id: 'check-found',
    index: 7,
    narration: 'current is not NULL, so the value was found — there is a node to delete.',
    highlightedLines: [15],
    stack: [frame('n0', ADDR.n0, N1, N0)],
    heap: heap('n1', ADDR.n1, 'allocated'),
    activeId: 'current',
    condition: { expr: 'current == NULL', result: false },
  },
  {
    id: 'check-prev',
    index: 8,
    narration: 'prev is not NULL (it is node 7), so we unlink via the predecessor rather than moving head.',
    highlightedLines: [16],
    stack: [frame('n0', ADDR.n0, N1, N0)],
    heap: heap('n1', ADDR.n1, 'allocated'),
    activeId: 'prev',
    condition: { expr: 'prev == NULL', result: false },
  },
  {
    id: 'bridge',
    index: 9,
    narration:
      'prev->next = current->next bridges node 7 straight to node 9, around the doomed node. We read current->next FIRST — freeing before this would lose node 9.',
    highlightedLines: [19],
    stack: [frame('n0', ADDR.n0, N1, N0)],
    heap: heap('n2', ADDR.n2, 'allocated'),
    activeId: 'n0.next',
  },
  {
    id: 'free',
    index: 10,
    narration:
      'free(current) returns node 4 to the allocator — it becomes a freed block. current now dangles, but the function is about to return.',
    highlightedLines: [21],
    stack: [frame('n0', ADDR.n0, N1, N0)],
    heap: heap('n2', ADDR.n2, 'freed'),
    activeId: 'n1',
    watch: [{ level: 'dangling', message: 'current -> 0xa20 was freed at delete.c:21' }],
  },
  {
    id: 'return',
    index: 11,
    narration: 'delete_value returns head — still node 7. The live list is 7 -> 9 -> NULL.',
    highlightedLines: [22],
    stack: [frame('n0', ADDR.n0, N1, N0)],
    heap: heap('n2', ADDR.n2, 'freed'),
    activeId: 'head',
  },
];

export const deleteNodeTrace: Trace = {
  id: 'se201-delete-node',
  title: 'Delete a node from a linked list',
  course: 'SE 201',
  topic: 'Singly Linked Lists Part 2',
  file: 'delete.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Singly Linked Lists Part 2'],
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: deleteNodeTrace,
  label: 'Delete a node',
  summary: 'Bridge prev->next around the node, then free it — read the link before freeing.',
  order: 30,
};
export default contentModule;
