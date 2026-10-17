# SE-Viz Trace Format

This is the **public data contract** between content modules (which author traces) and the generic
engine (which plays them). The authoritative, typed definition lives in
[`src/engine/trace/types.ts`](../src/engine/trace/types.ts) with full TSDoc; this document explains
the shape in prose and works through the Phase 0 example.

> If you change the format, update both the types and this file, and call it out in your phase
> report. Later phases and the reviewer depend on this contract.

> **Not a trace:** *theory documents* (Phase 19) are a separate, additive content type — read-first
> Markdown prose per topic, not played by the engine and not subject to this format. See
> [`THEORY_AUTHORING.md`](./THEORY_AUTHORING.md).

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

Content modules live under `src/content/<course>/<topic>/…`, grouped course → topic by
[`catalog.ts`](../src/content/catalog.ts). `allCatalogTraces()` feeds the validation test; the
workbench lists modules from the catalog. This is the single source of truth a future navigation
shell will consume.

#### Auto-discovery (Phase 05) — the one rule

The catalog is **not** hand-edited. It auto-discovers modules with Vite `import.meta.glob` (eager)
over `src/content/<course>/<topic>/<module>.ts` and `src/content/fixtures/*.ts`. **The one rule a
content file must follow to be registered:** `export default` a
[`ContentModule`](../src/content/module.ts):

```ts
import type { Trace } from '../../../engine/trace/types.ts';
import type { ContentModule } from '../../module.ts';

export const myTrace: Trace = {
  /* … course/topic/file set per docs/CURRICULUM.md … */
};

const contentModule: ContentModule = {
  trace: myTrace,
  summary: 'One line on what this module teaches.', // required (sidebar tooltip)
  label: 'Short label', // optional; defaults to trace.title
  order: 70, // optional ordering hint (≈ 10 × week)
};
export default contentModule;
```

- **Grouping** is read from the trace's own `course` / `topic` breadcrumb metadata (so set them
  from `docs/CURRICULUM.md`). The `ContentModule.course` / `.topic` override fields exist only for
  the engine-fixtures bucket — curriculum content leaves them unset.
- **Ordering** is deterministic and independent of glob order: courses by an explicit rank
  (`COURSE_META` in `catalog.ts`; unknown courses still appear, sorted last), topics by the minimum
  `order` of their modules, modules by `order` then `label`. `order` is **additive** — Phases 0–4
  traces (no `order`) remain valid; they just sort last within their topic.
- **No shared-file edit.** Dropping a conforming file into a topic folder registers it in the
  sidebar and in the validation test with zero edits to `catalog.ts`, `App.tsx`, `types.ts`, or any
  test. Any `*.ts` placed in a discovered folder **must** default-export a `ContentModule`, or the
  catalog throws a clear error at load (put pure helpers outside topic folders).

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

---

## Phase 11 additions — concept views (additive; memory traces unchanged)

Three curriculum screens are **not** about live memory: the static-library **build pipeline**, the
preprocessor **before→after**, and **dual-trace** debugging. Phase 11 adds an **additive `view`
discriminator** so these render in the same player + chrome (top bar, breadcrumb, transport,
keyboard, presentation) as memory traces. **A trace with no `view` (or `view: 'memory'`) behaves
exactly as before** — Phases 0–10 are untouched. The `Stage` component switches on `view`; the
memory canvas keeps its own renderer.

A concept-view trace sets `Trace.view` and each step carries the **one** matching payload (full
per-step snapshot, same principle as memory steps). `stack`/`heap` stay empty; `highlightedLines` is
`[]` (the code lives in the payloads). `validateTrace` checks the payloads (edges resolve, highlight
lines in range, columns present, the matching payload exists on every step).

### `view: 'pipeline'` — build pipeline (screen 07)

Each step: `Step.pipeline = { nodes, edges }`.

- `PipelineNode`: `{ id, kind: 'artifact' | 'process', label, sublabel?, state?: 'idle'|'active'|'done', accent? }`.
  `artifact` = solid file card (`.c`/`.o`/`.a`/binary); `process` = dashed tool box (`cc`/`ar`/`ld`).
  Set `accent: true` on the **final** output artifact only. `state` drives the per-step reveal
  (idle → active → done). `Step.activeId` may point at the active node id.
- `PipelineEdge`: `{ from, to }` (node ids). The renderer draws an azure connector between adjacent
  declared nodes joined by an edge, so **declare nodes left→right in pipeline order**.

### `view: 'before-after'` — preprocessor (screen 08)

Each step: `Step.beforeAfter = { before, after, beforeHighlights?, afterHighlights?, processLabel? }`.

- `before`/`after` are the full source strings (with directives) and the post-`cpp` translation unit;
  restate them every step. `beforeHighlights`/`afterHighlights` are **1-based line numbers** marked
  in the value-changed green (the lines substituted this step). `processLabel` defaults to `'cpp'`.

### `view: 'dual-trace'` — debugging (screen 09)

Trace sets `leftSource` and `rightSource` (the two programs). Each step: `Step.dualTrace = { left,
right, diverged? }`.

- `DualColumn`: `{ label, line?, rows: { name, value, changed? }[], stdout? }`. `line` is a 1-based
  highlight into that column's source; `rows` is the compact state table (set `changed` to pulse a
  row green); `stdout` is cumulative output.
- `diverged` is `true` from the **first divergent step onward**; that first step is the flagged
  divergence point (both columns show a "diverges here" marker). The single steps array drives both
  columns, so they advance in lockstep.

**Authoring (Wave 2 needs zero engine edits):** create a module under
`src/content/<course>/<topic>/<module>.ts`, set `view` + per-step payloads as above, and
`export default` a `ContentModule` like any other. The minimal fixtures
[`buildPipeline.ts`](../src/content/fixtures/buildPipeline.ts),
[`preprocessor.ts`](../src/content/fixtures/preprocessor.ts), and
[`dualTrace.ts`](../src/content/fixtures/dualTrace.ts) are the copy-from exemplars.

## Phase 17 additions — coach notes (additive)

A step may carry **one** optional `coach` note — a chess.com-style contextual teaching pop-up,
separate from (and rarer than) the always-on one-line `narration`. A step without `coach` behaves
exactly as before.

```ts
type CoachVariant = 'idea' | 'watch-out' | 'predict' | 'recap';

interface CoachNote {
  variant: CoachVariant; // idea (neutral) · watch-out (amber) · predict (azure) · recap (teal)
  body: string; // the explanation — SHORT: 1–3 sentences, one idea
  title?: string; // optional short heading (defaults to the variant label)
  anchorId?: string; // a frame / cell / heap-block / pipeline-node id to point the bubble at
  anchorLine?: number; // alternatively, a 1-based source line to point at
  beat?: 'arrive' | 'apply'; // with two-beat stepping (Phase 16): predict→arrive, explain→apply. Default 'apply'.
}
// on Step:  coach?: CoachNote
```

- The `CoachBubble` overlay (rendered in the stage content box) resolves `anchorId`/`anchorLine` to
  an on-screen element via `data-coach-anchor` / `data-coach-line` attributes and points a tail at
  it, **collision-aware** (flips side / clamps to stay in view). With no resolvable anchor it sits in
  a consistent fallback corner. It auto-appears, is dismissable (close / `Esc` / click-away) without
  blocking stepping, and reappears on step-back.
- **Validation** (`validateTrace`, additive): `anchorId` must resolve to an element present in that
  step (memory id or pipeline node); `anchorLine` must be within the source. No anchor is fine.
- Works in the memory and dual-trace views; pipeline/before-after show a fallback bubble.
- Authoring convention: see `docs/CONTENT_AUTHORING.md § Coach notes`.

## Phase 28 additions — step explanations (additive)

A step may carry an optional `explain` object with authored content for the Studio's **step
explanation panel**. Both fields are optional; a step without `explain` behaves exactly as before.

```ts
interface StepExplanation {
  did?: string[]; // "What this step did": an ordered breakdown, one short sentence per entry
  concept?: string; // "Concept": the idea this step illustrates (section hidden when absent)
}
// on Step:  explain?: StepExplanation
```

- Strings may use **inline Markdown only** (`` `code` ``, `**bold**`, `*italic*`, `[link](…)`), the
  same inline subset as theory decks.
- **Authored text always wins.** Without `explain.did` (or with an empty list) the panel shows the
  step's `narration`. Without `explain.concept` the Concept section is hidden.
- Everything else in the panel is **derived** (`src/engine/trace/explain.ts`, `explainBeat`):
  - the header: step number, highlighted line(s) and their source text;
  - "What changed": from `diffSteps(prev, step)` — values (old → new), pointer retargets, frames
    pushed / popped (labelled `factorial(3)` when every parameter is a known scalar, see
    `labels.ts`), new variables in an existing frame, heap blocks allocated / freed / leaked, and new
    `stdout` lines. The first step has nothing to compare against and says so. Concept views:
    dual-trace lists the rows flagged `changed`; pipeline and before-after point at their own
    highlighted stage / lines;
  - "Previous step" / "Coming next": the neighbouring steps' lines and narration.
- **Two-beat stepping:** on an `arrive` beat the step hasn't run, so `did`, "What changed" and the
  next step's narration are withheld until `apply`.
- **Validation** (`validateTrace`, additive): an empty `explain.did` entry or an empty
  `explain.concept` string is flagged.
- Exemplars: `se200/recursion/factorial.ts` and `se201/linked-lists/insertHead.ts` (every step).

### Timeline markers (derived, no format change)

The timeline under the stage shows labeled event markers computed by `deriveTimelineMarkers`
(`src/engine/trace/timeline.ts`): a frame pushed or popped (`factorial(3) called`,
`factorial(1) returns`) and a loop back-edge — execution jumping backwards to a `for` / `while`
header in the same frame, on a step that carries the loop's `condition` (`loop iteration k`, or
`loop exits` when it is false). No marker is shown when the label can't be derived reliably (no
condition on the back-edge, concept views). There is no authored marker field: the Phase 16
"beats" are the arrive / apply halves of every step, not events.
