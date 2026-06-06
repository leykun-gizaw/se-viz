# SE-Viz Trace Format

This is the **public data contract** between content modules (which author traces) and the generic
engine (which plays them). The authoritative, typed definition lives in
[`src/engine/trace/types.ts`](../src/engine/trace/types.ts) with full TSDoc; this document explains
the shape in prose and works through the Phase 0 example.

> If you change the format, update both the types and this file, and call it out in your phase
> report. Later phases and the reviewer depend on this contract.

---

## Core idea: one generic engine, every concept is just data

The engine knows nothing about "recursion" or "linked lists". It renders **memory state** and
animates the **transitions between adjacent steps**. A concept is taught purely by authoring the
right sequence of memory snapshots.

Two rules make this work:

1. **Every step is a FULL snapshot of memory** — not a delta. You can look at any single step and
   know exactly what the stack and heap contain. The engine derives animations by _diffing_ a step
   against the previous one (see [`diff.ts`](../src/engine/trace/diff.ts)).
2. **Everything has a stable id.** Cells, heap blocks, and frames keep the same id across steps for
   the same logical entity. Stable ids are what let the renderer follow a pointer's arrow to its
   target and animate a frame from pushed → popped across steps.

---

## The shape

### `Trace`

The unit a content module exports and the engine plays.

| Field      | Type       | Notes                                                        |
| ---------- | ---------- | ------------------------------------------------------------ |
| `id`       | `string`   | Stable id, e.g. `"phase0-add"`.                              |
| `title`    | `string`   | Shown in the UI.                                             |
| `language` | `'c'`      | Only C is in scope for SE 200 / SE 201.                      |
| `source`   | `string`   | Full source, `\n`-separated. Line numbers are **1-based**.   |
| `steps`    | `Step[]`   | Ordered execution steps; `steps[i].index === i`.             |
| `covers?`  | `string[]` | Optional curriculum rows covered (see `docs/CURRICULUM.md`). |

### `Step`

One point in execution: a complete memory snapshot plus presentation metadata.

| Field              | Type           | Notes                                                               |
| ------------------ | -------------- | ------------------------------------------------------------------- |
| `id`               | `string`       | Stable, human-readable, unique within the trace, e.g. `"add-call"`. |
| `index`            | `number`       | Zero-based; must equal the array index.                             |
| `narration`        | `string`       | Plain-language description for the narration panel.                 |
| `highlightedLines` | `number[]`     | 1-based source line(s) currently executing.                         |
| `stack`            | `StackFrame[]` | **Bottom-first**: `stack[0]` = `main`; last element = top of stack. |
| `heap`             | `HeapBlock[]`  | Heap allocations live at this step (empty `[]` in Phase 0).         |

> **Stack ordering convention:** `stack` is bottom-first. A call **appends** a frame; a return
> **pops** the last element. The renderer reverses this for display so the most recent call is on
> top.

### `StackFrame`

One function activation.

| Field       | Type     | Notes                                                                         |
| ----------- | -------- | ----------------------------------------------------------------------------- |
| `id`        | `string` | Stable per activation. Recursion → distinct ids (`"factorial#1"`, `"#2"`, …). |
| `name`      | `string` | Function name shown in the header.                                            |
| `callId`    | `number` | Monotonic counter distinguishing invocations of the same function (0, 1, …).  |
| `variables` | `Cell[]` | Locals + parameters, in declaration order.                                    |

### `Cell` (the recursive memory model)

A `Cell` is the unit the engine renders and diffs. It is a discriminated union on `kind`. Every
variant shares `id`, `name`, `type` (C type label), and optional `address`.

| `kind`      | Extra fields                                    | Represents                                  |
| ----------- | ----------------------------------------------- | ------------------------------------------- |
| `'scalar'`  | `value: string \| number \| boolean \| null`    | An `int`, `char`, … `null` = uninitialized. |
| `'pointer'` | `target: CellId \| BlockId \| null`, `display?` | A pointer; `target` drives the drawn arrow. |
| `'array'`   | `elements: Cell[]`                              | Arrays and C strings (`char[]`).            |
| `'struct'`  | `fields: Cell[]`                                | `struct`s: linked-list nodes, hash entries. |

**Pointers reference targets by stable id**, never by object reference. `target` is the `id` of
another cell (`&x`) or a heap block (`malloc`), or `null` for `NULL`. `display` is the optional
textual address the pointer holds; the _arrow_ is driven by `target`.

### `HeapBlock`

A heap allocation. Empty in Phase 0, but the type exists so the heap region and the diff/renderer
contracts are stable from the start.

| Field      | Type     | Notes                                              |
| ---------- | -------- | -------------------------------------------------- |
| `id`       | `string` | Stable; pointer cells reference this for arrows.   |
| `label?`   | `string` | e.g. `"node"`, `"malloc(8)"`.                      |
| `type?`    | `string` | e.g. `"struct node"`.                              |
| `address?` | `string` | Displayed base address.                            |
| `size?`    | `number` | Size in bytes, for display.                        |
| `cells`    | `Cell[]` | Cells inside the block (struct fields / elements). |

---

## The diff

`diffSteps(prev, next)` ([`diff.ts`](../src/engine/trace/diff.ts)) is a pure function of two
snapshots. It flattens every cell (recursing into arrays/structs) into an id-keyed map and reports:

- `framesPushed` / `framesPopped` — frames present in only one of the two steps.
- `cellsAdded` / `cellsRemoved` — cell ids that appeared / disappeared.
- `valuesChanged` — `{ id, from, to }` for scalar cells whose value changed.
- `pointersRetargeted` — `{ id, from, to }` for pointer cells whose target changed.

`prev` may be `null` for the first step. The renderer uses this to decide what to animate (frame
push/pop, value pulse, pointer arrow retarget).

---

## Worked example — the Phase 0 `add` trace

Source ([`src/content/phase0/source.ts`](../src/content/phase0/source.ts)):

```c
int add(int a, int b)      // line 1
{                          // line 2
    int sum = a + b;       // line 3
    return sum;            // line 4
}                          // line 5
                           // line 6
int main(void)             // line 7
{                          // line 8
    int x = 3;             // line 9
    int y = 4;             // line 10
    int z = add(x, y);     // line 11
    return 0;              // line 12
}                          // line 13
```

The full trace is [`src/content/phase0/addTrace.ts`](../src/content/phase0/addTrace.ts). Its eight
steps:

| #   | `id`               | Lines | Stack (bottom→top)                     | What happens                               |
| --- | ------------------ | ----- | -------------------------------------- | ------------------------------------------ |
| 0   | `main-enter`       | 7     | `main[]`                               | `main` frame created.                      |
| 1   | `decl-x`           | 9     | `main[x=3]`                            | Declare `x = 3`.                           |
| 2   | `decl-y`           | 10    | `main[x=3, y=4]`                       | Declare `y = 4`.                           |
| 3   | `add-call`         | 11, 1 | `main[x=3, y=4, z=?]`, `add[a=3, b=4]` | **Push `add`**; copy args; `z` declared.   |
| 4   | `add-sum`          | 3     | `main[…]`, `add[a=3, b=4, sum=7]`      | `sum = a + b = 7`.                         |
| 5   | `add-return`       | 4     | `main[…]`, `add[a=3, b=4, sum=7]`      | `add` returns 7.                           |
| 6   | `add-pop-assign-z` | 11    | `main[x=3, y=4, z=7]`                  | **Pop `add`**; assign return value to `z`. |
| 7   | `main-return`      | 12    | `main[x=3, y=4, z=7]`                  | `main` returns 0.                          |

A single step, abbreviated, looks like this:

```ts
{
  id: 'add-call',
  index: 3,
  narration: 'Call add(x, y). A new frame for add is pushed …',
  highlightedLines: [11, 1],
  stack: [
    { id: 'main#0', name: 'main', callId: 0, variables: [
      { kind: 'scalar', id: 'main.x', name: 'x', type: 'int', value: 3, address: '0x7ffeefbff5a8' },
      { kind: 'scalar', id: 'main.y', name: 'y', type: 'int', value: 4, address: '0x7ffeefbff5a4' },
      { kind: 'scalar', id: 'main.z', name: 'z', type: 'int', value: null, address: '0x7ffeefbff5a0' },
    ]},
    { id: 'add#0', name: 'add', callId: 0, variables: [
      { kind: 'scalar', id: 'add.a', name: 'a', type: 'int', value: 3, address: '0x7ffeefbff584' },
      { kind: 'scalar', id: 'add.b', name: 'b', type: 'int', value: 4, address: '0x7ffeefbff580' },
    ]},
  ],
  heap: [],
}
```

Diffing step 2 (`decl-y`) → step 3 (`add-call`) yields `framesPushed: [add#0]` (with cells `a`,
`b`) and `cellsAdded: ['main.z', 'add.a', 'add.b']` — exactly the animation the renderer plays, and
exactly what the Vitest test in [`diff.test.ts`](../src/engine/trace/diff.test.ts) locks down.

---

## Phase 1 additions (additive — Phase 0 traces remain valid)

Phase 1 extended the format **additively**: every field below is optional, so existing traces keep
working unchanged. All are TSDoc'd in [`types.ts`](../src/engine/trace/types.ts).

### Breadcrumb metadata (`Trace`)

| Field         | Type                | Notes                                                                                                          |
| ------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `course?`     | `string`            | Top-bar breadcrumb course. **Source from `docs/CURRICULUM.md`** — never fabricate a code.                      |
| `topic?`      | `string`            | Breadcrumb topic, e.g. `"Recursion"`.                                                                          |
| `file?`       | `string`            | Breadcrumb file, e.g. `"factorial.c"`. Also used as the code-panel title.                                      |
| `heapLayout?` | `'row' \| 'column'` | Data-region layout: `row` = a chain (linked list); `column` = independent allocations (malloc). Default `row`. |

When `course`/`topic`/`file` are absent the chrome falls back to `title`, so Phase 0 traces render.

### Active element + annotations + output (`Step`)

| Field          | Type           | Notes                                                                                                    |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `activeId?`    | `string`       | Id of the one "current" element this step → amber ring + badge.                                          |
| `annotations?` | `Annotation[]` | Labeled connector overlays (pointer arithmetic). See below.                                              |
| `stdout?`      | `string[]`     | Cumulative `printf` output; renders the console panel.                                                   |
| `watch?`       | `WatchEntry[]` | Heap-watch diagnostics (`{ level: 'info' \| 'dangling' \| 'leak'; message }`); dangling/leak render red. |

`Annotation = { id, fromId, toId, label }` — draws an azure arc from `fromId` to `toId` (both
stable ids) with a chip, e.g. `"p + 2 = 0x5004 + 2×4 = 0x500c"`.

### Frames and heap blocks

| Field                 | Type                                               | Notes                                                                |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| `StackFrame.address?` | `string`                                           | Displayed frame base address (recursion shows descending addresses). |
| `HeapBlock.state?`    | `'allocated' \| 'freed' \| 'dangling' \| 'leaked'` | The four allocation states; omit ⇒ `allocated`.                      |

**Derived, not authored:** the green value-changed **pulse**, the pointer-arrow **retarget glide**,
and the **danger** (red dashed) arrow into a freed/dangling block are all computed from the data —
`pulsedCellIds` / `retargetedPointerIds` (in [`diff.ts`](../src/engine/trace/diff.ts)) and
`resolvePointers` (in [`pointers.ts`](../src/engine/pointers.ts)). Content modules never hard-code an
animation; they just author correct snapshots and `state`s.

### Not yet modeled — concept views (deferred)

Static-library pipelines, preprocessor before→after, and dual-trace debugging are **non-memory**
views. They are deliberately _not_ bolted on in Phase 1. A later phase will add an additive `view`
discriminator on `Step`/`Trace` (memory vs concept-diagram vs dual-trace); the `process`-box token
already exists in the design system for them.

---

## Phase 2 additions (additive — Phase 0/1 traces remain valid)

### Condition chip (`Step`)

| Field        | Type            | Notes                                                              |
| ------------ | --------------- | ------------------------------------------------------------------ |
| `condition?` | `StepCondition` | A branch/loop test shown as a chip beside the narration. Optional. |

`StepCondition = { expr: string; result: boolean }`. The narration bar renders it as
`expr → result` — green when `true`, muted when `false` — with ligatures off so operators read
literally (`i <= n`, not `i ≤ n`), matching the code panel. Used to make `if`/`else` branches and
`while`/`for` loop tests legible: each pass shows the exact condition and its result this step.
Example: `{ expr: 'i <= n', result: true }`.

### Validation

`validateTrace(trace)` ([`validate.ts`](../src/engine/trace/validate.ts)) checks the structural
invariants every trace must hold — `steps[i].index === i`; `highlightedLines` within the source;
ids unique within a step; `activeId`, pointer `target`s, and annotation `fromId`/`toId` all resolve
to ids present in that step. A Vitest test runs it over **every** trace in the catalog, so a future
authoring error fails CI. It validates structure, not arithmetic — authors still hand-verify values.

### Content catalog

Content modules live under `src/content/se<course>/<topic>/…` and are registered in
[`catalog.ts`](../src/content/catalog.ts), grouped course → topic. `allCatalogTraces()` feeds the
validation test; the workbench lists modules from the catalog. This is the single source of truth a
future navigation shell will consume.

---

## Phase 3 notes (no trace-format change)

Phase 3 (pointers, arrays, strings) added **no new trace-format field** — pointers, arrays, the
pointer-arithmetic `Annotation` arc, cross-frame arrows, and `Step.condition` already covered
everything. Two authoring conventions and one tiny rendering touch are worth recording:

- **Strings** are authored as `char` `ArrayCell`s whose element values are char literals: `"'h'"`,
  `"'i'"`, and the terminator `"'\\0'"`. Chars are 1 byte, so element addresses ascend by 1.
- **NUL-terminator rendering touch** (additive, no token/restyle, no format change): an array
  element whose displayed value is `'\0'` renders with a dashed border and muted text
  ([`CellView.tsx`](../src/components/memory/CellView.tsx), `isNulTerminator`) so the end of a string
  reads clearly. It only affects how a terminator _looks_; the data is an ordinary scalar cell.
- **Cross-frame & pointer→pointer arrows** need no new mechanism: a pointer cell's `target` is just a
  stable id, so a parameter in one frame can target a cell in another (e.g. `swap`'s `a` → `main`'s
  `x`), and a `pp` cell can target a `p` cell that itself targets `x` (a two-hop chain). The overlay
  resolves all of these by id.
