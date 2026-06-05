# SE-Viz — Visual Coverage Matrix

Confirms that the visual system + trace format are designed for **every** SE 200 / SE 201
concept, not just pointers and lists. Each coding project maps to one or more reusable visual
primitives. The engine renders the primitives; each content phase supplies the trace data.

## The reusable visual primitives (the whole vocabulary)
1. **Stack frame** — a function's activation record holding its locals.
2. **Scalar cell** — name, type, value, address; pulses when its value changes.
3. **Array region** — contiguous indexed cells with addresses (basis for pointer arithmetic).
4. **String** — a char array with a visible `\0` null terminator.
5. **Heap block / node** — a malloc'd allocation with its own address and fields.
6. **Pointer + arrow** — a cell holding an address, drawing an arrow to its target (single,
   `next`/`prev`, pointer-to-pointer).
7. **Console / output stream** — a panel showing `printf` output as it happens.
8. **Control-flow highlight** — branch taken vs not, loop iteration counter.
9. **Allocation state** — allocated / freed / dangling / leaked indicators on heap blocks.
10. **Index-mapping box** — a function box mapping an input to a slot (used for hashing).
11. **Dual-trace / diff** — two runs side by side, highlighting where state diverges (debugging).
12. **Concept view** — a non-runtime diagram mode for things that aren't about live memory.

## SE 200 — C Programming I

| Concept (project) | What you see | Primitives | Phase |
|---|---|---|---|
| Hello, World | Single frame + console output | 1, 2, 7 | 2 |
| Variables, if/else/while | Locals updating, branch + loop highlight | 1, 2, 8 | 2 |
| Functions & nested loops | Call/return between frames, nested counters | 1, 2, 8 | 2 |
| More functions / more loops | Same, deeper nesting + return values | 1, 2, 8 | 2 |
| Pointers, arrays, strings | Arrays as cells, pointers→targets, `\0` strings | 3, 4, 6 | 3 |
| More pointers/arrays/strings | **Pointer arithmetic** (`*(p+i)`→address), 2D arrays | 3, 4, 6 | 3 |
| Even more pointers/arrays/strings | Pointer-to-pointer, string fns walking memory | 3, 4, 6 | 3 |
| Recursion | Stack **grows then unwinds**, return-value flow | 1, 2 (deep) | 4 |
| Static libraries | Build pipeline: .c → .o → .a → linked binary | 12 (concept view) | 5 |
| argc / argv | `argv` as an array of `char*` pointing to arg strings | 3, 4, 6, 7 | 5 |
| Preprocessor | Macro expansion: source **before → after** substitution | 12 (concept view) | 5 |
| Debugging | Buggy vs fixed run side by side, divergence flagged | 11 + any | 5 |

## SE 201 — Data Structures & Algorithms I

| Concept (project) | What you see | Primitives | Phase |
|---|---|---|---|
| malloc & free | Heap blocks appear/free; dangling + leak states | 5, 6, 9 | 6 |
| More malloc & free | `realloc`/`sizeof`, copy-on-grow in the heap | 5, 6, 9 | 6 |
| Singly linked lists | Heap nodes + `next` arrows, traversal | 5, 6 | 7 |
| More SLL part 1 | Insert/delete at head, pointer rewiring | 5, 6 | 7 |
| More SLL part 2 | Insert/delete at middle/tail, edge cases | 5, 6 | 7 |
| Doubly linked lists | Nodes with `next` **and** `prev`, bidirectional arrows | 5, 6 | 7 |
| Stacks/queues part 1 | push/pop, top pointer, **LIFO** ordering | 3 or 5/6, 6 | 8 |
| Stacks/queues part 2 | enqueue/dequeue, front/rear, **FIFO** ordering | 3 or 5/6, 6 | 8 |
| Hash tables | Hash fn maps key→bucket; collision chains in buckets | 3, 5, 6, 10 | 9 |

## Two concepts need more than a memory picture — handled deliberately
- **Static libraries** and the **preprocessor** aren't about runtime memory. They get a
  **concept view** (primitive 12): static libraries as a compile/archive/link pipeline diagram;
  the preprocessor as a before→after textual-substitution view. The engine supports a
  non-memory trace/step type for these so they live in the same player and presentation flow.
- **Debugging** is best taught as a **dual trace** (primitive 11): the same program run two
  ways, with the step where state first diverges highlighted.

## Why this is safe to commit to now
The Phase 0 trace format is explicitly required to be generic enough to express heap blocks,
arrays, strings, pointers, and hash buckets even though the Phase 0 slice only uses frames and
cells. Each later phase adds the *rendering* and *content* for its primitives without changing
the core contract. The two concept-view cases (static libraries, preprocessor) and the
dual-trace case (debugging) are folded into the Phase 1 engine design and the Phase 5 prompt so
they aren't an afterthought.
