/**
 * SE 201 · Hash Tables (week 7) — lookup that walks a collision chain.
 *
 * Continues from the insert module: the table already holds "cat" in bucket 0 and the collision
 * chain owl -> dog in bucket 2. `get("dog")` hashes the key to its bucket, then walks the chain
 * comparing keys with strcmp until it matches (or hits NULL).
 *
 * The same explicit hash is used: `hash(key) = (sum of char codes) % 8`.
 *   "dog" = 100 + 111 + 103 = 314 ; 314 % 8 = 2
 * Bucket 2's head is "owl" (the most recently inserted), so the walk visits "owl" first
 * (strcmp -> no match), then "dog" (match), returning 9. Each key comparison is shown as a
 * `Step.condition` chip so the learner sees the exact test and its result.
 *
 * The hash(key) % N -> index mapping is drawn with an azure `Annotation` arc carrying the
 * arithmetic (the engine has no dedicated process-box view); the chosen bucket pulses via the
 * active ring. Entirely within the existing trace format.
 */
import type {
  ArrayCell,
  HeapBlock,
  PointerCell,
  StackFrame,
  Step,
  Trace,
} from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

const SOURCE = `#define N 8

typedef struct entry {
    const char *key;
    int value;
    struct entry *next;
} entry_t;

extern entry_t *table[N];   /* cat @ [0], owl -> dog @ [2] */

unsigned int hash(const char *key) {
    unsigned int sum = 0;
    for (int i = 0; key[i] != '\\0'; i++)
        sum += key[i];
    return sum % N;
}

int get(const char *key) {
    unsigned int i = hash(key);
    entry_t *e = table[i];
    while (e != NULL) {
        if (strcmp(e->key, key) == 0)
            return e->value;
        e = e->next;
    }
    return -1;
}
`;

const ENTRY_ADDR: Record<string, string> = {
  e_cat: '0x5a00',
  e_dog: '0x5a20',
  e_owl: '0x5a40',
};

const BUCKET_ADDR = Array.from({ length: 8 }, (_, i) => `0x${(0x6000 + i * 8).toString(16)}`);

function bucket(i: number, target: string | null): PointerCell {
  return {
    kind: 'pointer',
    id: `table.${i}`,
    name: `[${i}]`,
    type: 'entry_t *',
    target,
    display: target ? ENTRY_ADDR[target] : 'NULL',
    address: BUCKET_ADDR[i],
  };
}

function tableCell(heads: Record<number, string | null>): ArrayCell {
  return {
    kind: 'array',
    id: 'table',
    name: 'table',
    type: 'entry_t *[8]',
    address: BUCKET_ADDR[0],
    elements: Array.from({ length: 8 }, (_, i) => bucket(i, heads[i] ?? null)),
  };
}

/**
 * The file-scope bucket array `table[N]`. It is authored here as a synthetic `globals` frame for
 * convenience, then **lifted into the static `.bss` segment** by {@link liftGlobalsToStatic} (Phase
 * 24): `table` is a zero-initialized global, so it lives in `.bss`, not on the stack.
 */
function globalsFrame(): StackFrame {
  return {
    id: 'globals',
    name: 'globals',
    callId: 0,
    address: '0x601000',
    variables: [tableCell({ 0: 'e_cat', 2: 'e_owl' })],
  };
}

/**
 * Move the synthetic `globals` frame's variables out of the stack and into the static segment's
 * `.bss` (a zero-initialized global). Keeps every authored per-step snapshot otherwise identical.
 */
function liftGlobalsToStatic(step: Step): Step {
  const globals = step.stack.find((f) => f.id === 'globals');
  if (!globals) return step;
  return {
    ...step,
    stack: step.stack.filter((f) => f.id !== 'globals'),
    staticData: { data: [], bss: globals.variables, rodata: [] },
  };
}

function entry(id: string, key: string, value: number, nextTarget: string | null): HeapBlock {
  const base = ENTRY_ADDR[id];
  const valueAddr = `0x${(parseInt(base, 16) + 8).toString(16)}`;
  const nextAddr = `0x${(parseInt(base, 16) + 16).toString(16)}`;
  return {
    id,
    label: 'entry',
    type: 'entry_t',
    address: base,
    state: 'allocated',
    cells: [
      { kind: 'scalar', id: `${id}.key`, name: 'key', type: 'const char *', value: `"${key}"`, address: base },
      { kind: 'scalar', id: `${id}.value`, name: 'value', type: 'int', value, address: valueAddr },
      {
        kind: 'pointer',
        id: `${id}.next`,
        name: 'next',
        type: 'entry_t *',
        target: nextTarget,
        display: nextTarget ? ENTRY_ADDR[nextTarget] : 'NULL',
        address: nextAddr,
      },
    ],
  };
}

/** The populated heap: cat alone in bucket 0, chain owl -> dog in bucket 2. */
const HEAP: HeapBlock[] = [
  entry('e_cat', 'cat', 4, null),
  entry('e_owl', 'owl', 2, 'e_dog'),
  entry('e_dog', 'dog', 9, null),
];

/** The `get` activation. `i`/`eTarget` are null until computed/assigned. */
function getFrame(i: number | null, eTarget: string | null): StackFrame {
  return {
    id: 'get',
    name: 'get',
    callId: 0,
    address: '0x7ffe0080',
    variables: [
      { kind: 'scalar', id: 'get.key', name: 'key', type: 'const char *', value: '"dog"', address: '0x7ffe0080' },
      { kind: 'scalar', id: 'get.i', name: 'i', type: 'unsigned int', value: i, address: '0x7ffe0088' },
      {
        kind: 'pointer',
        id: 'get.e',
        name: 'e',
        type: 'entry_t *',
        target: eTarget,
        display: eTarget ? ENTRY_ADDR[eTarget] : 'NULL',
        address: '0x7ffe0090',
      },
    ],
  };
}

const STRCMP = 'strcmp(e->key, key) == 0';

const rawSteps: Step[] = [
  {
    id: 'start',
    index: 0,
    narration:
      'The table is already populated: "cat" sits alone in bucket 0, and bucket 2 holds the collision chain owl -> dog. We will look up "dog".',
    highlightedLines: [9],
    stack: [globalsFrame()],
    heap: HEAP,
    activeId: 'table',
  },
  {
    id: 'call-get',
    index: 1,
    narration: 'get("dog"): find the value stored under the key "dog".',
    highlightedLines: [18],
    stack: [globalsFrame(), getFrame(null, null)],
    heap: HEAP,
    activeId: 'get',
  },
  {
    id: 'hash',
    index: 2,
    narration:
      'hash("dog") sums 100+111+103 = 314, then 314 % 8 = 2. Lookup goes straight to bucket 2 — the same bucket insert chose.',
    highlightedLines: [19],
    stack: [globalsFrame(), getFrame(2, null)],
    heap: HEAP,
    activeId: 'table.2',
    annotations: [
      { id: 'map-dog', fromId: 'get.key', toId: 'table.2', label: 'hash("dog") = 100+111+103 = 314; 314 % 8 = 2' },
    ],
  },
  {
    id: 'head',
    index: 3,
    narration: 'e = table[2] starts the walk at the bucket head, which is "owl".',
    highlightedLines: [20],
    stack: [globalsFrame(), getFrame(2, 'e_owl')],
    heap: HEAP,
    activeId: 'e_owl',
  },
  {
    id: 'loop-owl',
    index: 4,
    narration: 'e is not NULL, so the loop body runs and we compare this entry’s key.',
    highlightedLines: [21],
    stack: [globalsFrame(), getFrame(2, 'e_owl')],
    heap: HEAP,
    activeId: 'e_owl',
    condition: { expr: 'e != NULL', result: true },
  },
  {
    id: 'compare-owl',
    index: 5,
    narration: 'strcmp("owl", "dog") is not 0 — the keys differ, so this is not the entry. Keep walking.',
    highlightedLines: [22],
    stack: [globalsFrame(), getFrame(2, 'e_owl')],
    heap: HEAP,
    activeId: 'e_owl.key',
    condition: { expr: STRCMP, result: false },
  },
  {
    id: 'advance',
    index: 6,
    narration: 'e = e->next advances along the chain to the next entry, "dog".',
    highlightedLines: [24],
    stack: [globalsFrame(), getFrame(2, 'e_dog')],
    heap: HEAP,
    activeId: 'e_dog',
  },
  {
    id: 'loop-dog',
    index: 7,
    narration: 'e is still not NULL, so compare this entry’s key too.',
    highlightedLines: [21],
    stack: [globalsFrame(), getFrame(2, 'e_dog')],
    heap: HEAP,
    activeId: 'e_dog',
    condition: { expr: 'e != NULL', result: true },
  },
  {
    id: 'compare-dog',
    index: 8,
    narration: 'strcmp("dog", "dog") is 0 — the keys match. This is the entry we were looking for.',
    highlightedLines: [22],
    stack: [globalsFrame(), getFrame(2, 'e_dog')],
    heap: HEAP,
    activeId: 'e_dog.key',
    condition: { expr: STRCMP, result: true },
  },
  {
    id: 'return',
    index: 9,
    narration: 'return e->value gives 9 — the value stored under "dog". Lookup is hash, then walk the chain.',
    highlightedLines: [23],
    stack: [globalsFrame(), getFrame(2, 'e_dog')],
    heap: HEAP,
    activeId: 'e_dog.value',
  },
];

/** Globals (the bucket array) live in the static `.bss` segment, not on the stack (Phase 24). */
const steps: Step[] = rawSteps.map(liftGlobalsToStatic);

export const hashLookupTrace: Trace = {
  id: 'se201-hash-lookup',
  title: 'Hash table — lookup walks the chain',
  course: 'SE 201',
  topic: 'Hash Tables',
  file: 'get.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Hash Tables'],
  heapLayout: 'row',
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: hashLookupTrace,
  label: 'Lookup walks the chain',
  summary: 'get(key) hashes to a bucket, then walks the chain comparing keys until a match.',
  order: 71,
};
export default contentModule;
