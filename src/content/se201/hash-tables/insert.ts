/**
 * SE 201 · Hash Tables (week 7) — insert with separate chaining.
 *
 * Builds a `table[8]` of bucket head pointers and inserts three string keys. The hash function is
 * **explicit and verifiable**: `hash(key) = (sum of the key's char codes) % 8`. Two keys collide
 * in bucket 2 ("dog" and "owl"), and the collision is resolved by **prepending** the new entry to
 * the bucket's chain (`e->next = table[i]; table[i] = e;`) — shown as two distinct pointer rewires,
 * so the existing entry is never overwritten.
 *
 * Hand-verified hashes (char codes summed, then % 8):
 *   "cat" = 99 + 97 + 116 = 312 ; 312 % 8 = 0
 *   "dog" = 100 + 111 + 103 = 314 ; 314 % 8 = 2
 *   "owl" = 111 + 119 + 108 = 338 ; 338 % 8 = 2  (collides with "dog" -> chain owl -> dog)
 *
 * The engine has no dedicated "process box" view (concept views are deferred per
 * docs/TRACE_FORMAT.md), so the hash(key) % N -> index mapping is drawn with an azure `Annotation`
 * arc from the key to the chosen bucket, carrying the arithmetic, while that bucket gets the amber
 * active ring. This stays entirely within the existing trace format.
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

entry_t *table[N];   /* global: all NULL at startup */

unsigned int hash(const char *key) {
    unsigned int sum = 0;
    for (int i = 0; key[i] != '\\0'; i++)
        sum += key[i];
    return sum % N;
}

void put(const char *key, int value) {
    unsigned int i = hash(key);
    entry_t *e = malloc(sizeof(entry_t));
    e->key = key;
    e->value = value;
    e->next = table[i];   /* prepend: point at old head */
    table[i] = e;         /* new head of the bucket */
}
`;

/** Displayed base address of each heap entry, keyed by block id. */
const ENTRY_ADDR: Record<string, string> = {
  e_cat: '0x5a00',
  e_dog: '0x5a20',
  e_owl: '0x5a40',
};

/** Displayed address of each bucket slot (8-byte pointers from 0x6000). */
const BUCKET_ADDR = Array.from({ length: 8 }, (_, i) => `0x${(0x6000 + i * 8).toString(16)}`);

/** One bucket slot: a head pointer to a chain (or NULL). */
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

/** The whole bucket array, given a map of slot index -> head block id. */
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

/** The base "globals" frame that owns the file-scope bucket array. */
function globalsFrame(heads: Record<number, string | null>): StackFrame {
  return {
    id: 'globals',
    name: 'globals',
    callId: 0,
    address: '0x601000',
    variables: [tableCell(heads)],
  };
}

/**
 * A heap entry block. `nextTarget` is the block this entry's `next` points at (or null = NULL);
 * pass `nextDisplay` to render an uninitialised `next` as `?` right after malloc.
 */
function entry(
  id: string,
  key: string,
  value: number,
  nextTarget: string | null,
  nextDisplay?: string,
): HeapBlock {
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
        display: nextDisplay ?? (nextTarget ? ENTRY_ADDR[nextTarget] : 'NULL'),
        address: nextAddr,
      },
    ],
  };
}

/** The `put` activation. `i`/`eTarget` are null until computed/allocated. */
function putFrame(
  key: string,
  value: number,
  i: number | null,
  eTarget: string | null,
  callId: number,
): StackFrame {
  return {
    id: 'put',
    name: 'put',
    callId,
    address: '0x7ffe0040',
    variables: [
      { kind: 'scalar', id: 'put.key', name: 'key', type: 'const char *', value: `"${key}"`, address: '0x7ffe0040' },
      { kind: 'scalar', id: 'put.value', name: 'value', type: 'int', value, address: '0x7ffe0048' },
      { kind: 'scalar', id: 'put.i', name: 'i', type: 'unsigned int', value: i, address: '0x7ffe004c' },
      {
        kind: 'pointer',
        id: 'put.e',
        name: 'e',
        type: 'entry_t *',
        target: eTarget,
        display: eTarget ? ENTRY_ADDR[eTarget] : 'NULL',
        address: '0x7ffe0050',
      },
    ],
  };
}

const steps: Step[] = [
  {
    id: 'init',
    index: 0,
    narration:
      'The bucket array table[8] is the hash table. At startup every head pointer is NULL — the table is empty.',
    highlightedLines: [9],
    stack: [globalsFrame({})],
    heap: [],
    activeId: 'table',
  },

  // ---- put("cat", 4) -> bucket 0 (empty) ----
  {
    id: 'call-cat',
    index: 1,
    narration: 'put("cat", 4): insert the key "cat" with value 4.',
    highlightedLines: [18],
    stack: [globalsFrame({}), putFrame('cat', 4, null, null, 0)],
    heap: [],
    activeId: 'put',
  },
  {
    id: 'hash-cat',
    index: 2,
    narration:
      'hash("cat") sums the char codes 99+97+116 = 312, then 312 % 8 = 0. The key maps to bucket 0.',
    highlightedLines: [19],
    stack: [globalsFrame({}), putFrame('cat', 4, 0, null, 0)],
    heap: [],
    activeId: 'table.0',
    annotations: [
      { id: 'map-cat', fromId: 'put.key', toId: 'table.0', label: 'hash("cat") = 99+97+116 = 312; 312 % 8 = 0' },
    ],
  },
  {
    id: 'alloc-cat',
    index: 3,
    narration: 'malloc a new entry and fill in key = "cat", value = 4. Its next is still uninitialised.',
    highlightedLines: [20, 21, 22],
    stack: [globalsFrame({}), putFrame('cat', 4, 0, 'e_cat', 0)],
    heap: [entry('e_cat', 'cat', 4, null, '?')],
    activeId: 'e_cat',
  },
  {
    id: 'link-cat',
    index: 4,
    narration:
      'Prepend: e->next = table[0] (NULL, the bucket was empty), then table[0] = e. Bucket 0 now heads a one-entry chain.',
    highlightedLines: [23, 24],
    stack: [globalsFrame({ 0: 'e_cat' }), putFrame('cat', 4, 0, 'e_cat', 0)],
    heap: [entry('e_cat', 'cat', 4, null)],
    activeId: 'table.0',
  },

  // ---- put("dog", 9) -> bucket 2 (empty) ----
  {
    id: 'call-dog',
    index: 5,
    narration: 'put("dog", 9): insert the key "dog" with value 9.',
    highlightedLines: [18],
    stack: [globalsFrame({ 0: 'e_cat' }), putFrame('dog', 9, null, null, 1)],
    heap: [entry('e_cat', 'cat', 4, null)],
    activeId: 'put',
  },
  {
    id: 'hash-dog',
    index: 6,
    narration:
      'hash("dog") sums 100+111+103 = 314, then 314 % 8 = 2. The key maps to bucket 2, which is still empty.',
    highlightedLines: [19],
    stack: [globalsFrame({ 0: 'e_cat' }), putFrame('dog', 9, 2, null, 1)],
    heap: [entry('e_cat', 'cat', 4, null)],
    activeId: 'table.2',
    annotations: [
      { id: 'map-dog', fromId: 'put.key', toId: 'table.2', label: 'hash("dog") = 100+111+103 = 314; 314 % 8 = 2' },
    ],
  },
  {
    id: 'alloc-dog',
    index: 7,
    narration: 'malloc a new entry and fill in key = "dog", value = 9.',
    highlightedLines: [20, 21, 22],
    stack: [globalsFrame({ 0: 'e_cat' }), putFrame('dog', 9, 2, 'e_dog', 1)],
    heap: [entry('e_cat', 'cat', 4, null), entry('e_dog', 'dog', 9, null, '?')],
    activeId: 'e_dog',
  },
  {
    id: 'link-dog',
    index: 8,
    narration: 'Prepend: e->next = table[2] (NULL), then table[2] = e. Bucket 2 now heads the chain "dog".',
    highlightedLines: [23, 24],
    stack: [globalsFrame({ 0: 'e_cat', 2: 'e_dog' }), putFrame('dog', 9, 2, 'e_dog', 1)],
    heap: [entry('e_cat', 'cat', 4, null), entry('e_dog', 'dog', 9, null)],
    activeId: 'table.2',
  },

  // ---- put("owl", 2) -> bucket 2 (COLLISION) ----
  {
    id: 'call-owl',
    index: 9,
    narration: 'put("owl", 2): insert the key "owl" with value 2.',
    highlightedLines: [18],
    stack: [globalsFrame({ 0: 'e_cat', 2: 'e_dog' }), putFrame('owl', 2, null, null, 2)],
    heap: [entry('e_cat', 'cat', 4, null), entry('e_dog', 'dog', 9, null)],
    activeId: 'put',
  },
  {
    id: 'hash-owl',
    index: 10,
    narration:
      'hash("owl") sums 111+119+108 = 338, then 338 % 8 = 2 — the SAME bucket as "dog". This is a collision; chaining handles it.',
    highlightedLines: [19],
    stack: [globalsFrame({ 0: 'e_cat', 2: 'e_dog' }), putFrame('owl', 2, 2, null, 2)],
    heap: [entry('e_cat', 'cat', 4, null), entry('e_dog', 'dog', 9, null)],
    activeId: 'table.2',
    annotations: [
      { id: 'map-owl', fromId: 'put.key', toId: 'table.2', label: 'hash("owl") = 111+119+108 = 338; 338 % 8 = 2' },
    ],
  },
  {
    id: 'alloc-owl',
    index: 11,
    narration: 'malloc a new entry and fill in key = "owl", value = 2. The existing "dog" entry is untouched.',
    highlightedLines: [20, 21, 22],
    stack: [globalsFrame({ 0: 'e_cat', 2: 'e_dog' }), putFrame('owl', 2, 2, 'e_owl', 2)],
    heap: [
      entry('e_cat', 'cat', 4, null),
      entry('e_owl', 'owl', 2, null, '?'),
      entry('e_dog', 'dog', 9, null),
    ],
    activeId: 'e_owl',
  },
  {
    id: 'rewire-owl-next',
    index: 12,
    narration:
      'First rewire: e->next = table[2], so the new entry "owl" points at the old head "dog". No data is lost.',
    highlightedLines: [23],
    stack: [globalsFrame({ 0: 'e_cat', 2: 'e_dog' }), putFrame('owl', 2, 2, 'e_owl', 2)],
    heap: [
      entry('e_cat', 'cat', 4, null),
      entry('e_owl', 'owl', 2, 'e_dog'),
      entry('e_dog', 'dog', 9, null),
    ],
    activeId: 'e_owl.next',
  },
  {
    id: 'rewire-owl-head',
    index: 13,
    narration:
      'Second rewire: table[2] = e, so the bucket head now points at "owl". Bucket 2 heads the chain owl -> dog.',
    highlightedLines: [24],
    stack: [globalsFrame({ 0: 'e_cat', 2: 'e_owl' }), putFrame('owl', 2, 2, 'e_owl', 2)],
    heap: [
      entry('e_cat', 'cat', 4, null),
      entry('e_owl', 'owl', 2, 'e_dog'),
      entry('e_dog', 'dog', 9, null),
    ],
    activeId: 'table.2',
  },
  {
    id: 'done',
    index: 14,
    narration:
      'Final table: bucket 0 holds "cat"; bucket 2 holds the collision chain owl -> dog; all other buckets are NULL.',
    highlightedLines: [9],
    stack: [globalsFrame({ 0: 'e_cat', 2: 'e_owl' })],
    heap: [
      entry('e_cat', 'cat', 4, null),
      entry('e_owl', 'owl', 2, 'e_dog'),
      entry('e_dog', 'dog', 9, null),
    ],
    activeId: 'table',
  },
];

export const hashInsertTrace: Trace = {
  id: 'se201-hash-insert',
  title: 'Hash table — insert with chaining',
  course: 'SE 201',
  topic: 'Hash Tables',
  file: 'put.c',
  language: 'c',
  source: SOURCE,
  steps,
  covers: ['SE201: Hash Tables'],
  heapLayout: 'row',
};

/** Sidebar registration (auto-discovered by the catalog). */
const contentModule: ContentModule = {
  trace: hashInsertTrace,
  label: 'Insert with chaining',
  summary: 'hash(key) % N maps keys to buckets; a collision prepends into a chain.',
  order: 70,
};
export default contentModule;
