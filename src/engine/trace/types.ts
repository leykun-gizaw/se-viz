/**
 * SE-Viz trace format — the public data contract every concept module produces and
 * the generic engine consumes.
 *
 * ## Design principles
 *
 * 1. **One generic engine, every concept is just data.** A {@link Trace} is metadata plus an
 *    ordered array of {@link Step}s. The engine never knows about "recursion" or "linked lists";
 *    it only renders memory state and animates the transitions between adjacent steps.
 *
 * 2. **Each step carries the FULL memory state** (not a delta). The engine derives animations by
 *    diffing adjacent steps (see `diff.ts`). Authoring full snapshots keeps traces deterministic
 *    and verifiable: you can look at any single step and know exactly what memory looks like.
 *
 * 3. **Everything is referenced by a stable id.** Cells, heap blocks, and frames keep the same id
 *    across steps for the same logical entity. This is what lets the renderer draw a pointer arrow
 *    that follows its target, and animate a frame from "pushed" to "popped", across steps.
 *
 * Phase 0 only exercises scalars and stack frames, but the model below is intentionally wide
 * enough for the entire roadmap: pointers, arrays, strings, heap blocks, structs (linked-list
 * nodes), and hash buckets. Later phases extend the engine, not this contract — change it only
 * when genuinely necessary, and document the change.
 *
 * @packageDocumentation
 */

/** Stable identifier for a {@link Cell}, unique within a trace and stable across steps. */
export type CellId = string;

/** Stable identifier for a {@link HeapBlock}, unique within a trace and stable across steps. */
export type BlockId = string;

/** Stable identifier for a {@link StackFrame}, unique within a trace and stable across steps. */
export type FrameId = string;

/**
 * Anything a pointer can point at: another cell (e.g. `&x`), a heap block (e.g. the result of
 * `malloc`), or `null` for a `NULL` / uninitialized pointer.
 */
export type PointerTarget = CellId | BlockId | null;

/** Discriminant for the {@link Cell} union. */
export type CellKind = 'scalar' | 'pointer' | 'array' | 'struct';

/** Fields shared by every {@link Cell} variant. */
export interface CellBase {
  /** Stable id for this logical cell across the whole trace. */
  id: CellId;
  /** Source-level name, e.g. `"x"`, `"head"`, `"buckets"`. May be empty for anonymous elements. */
  name: string;
  /** C type label shown to the learner, e.g. `"int"`, `"int *"`, `"char[6]"`, `"struct node"`. */
  type: string;
  /** Optional displayed address of this cell, e.g. `"0x7ffeefbff5a8"`. Purely cosmetic. */
  address?: string;
}

/**
 * A single scalar value cell: an `int`, `char`, `float`, etc.
 *
 * `value` is the *displayed* representation (the author decides formatting, e.g. `7`, `'a'`,
 * `3.14`). `null` means uninitialized / indeterminate ("garbage") and should render as such.
 */
export interface ScalarCell extends CellBase {
  kind: 'scalar';
  value: string | number | boolean | null;
}

/**
 * A pointer cell. It {@link PointerCell.target | targets} another cell or heap block by **stable
 * id**, which is how the renderer draws (and animates) an arrow from this cell to its target.
 *
 * `display` is the optional textual address the pointer holds (e.g. `"0x7ffeefbff5a8"`); the
 * arrow is driven by `target`, not by this string.
 */
export interface PointerCell extends CellBase {
  kind: 'pointer';
  target: PointerTarget;
  display?: string | null;
}

/**
 * A fixed-length, contiguous array of element cells (arrays and C strings). Elements are stored
 * in index order. Strings are modeled as an `ArrayCell` of `char` {@link ScalarCell}s.
 */
export interface ArrayCell extends CellBase {
  kind: 'array';
  elements: Cell[];
}

/**
 * An aggregate of named field cells (a `struct`). Used for linked-list nodes, hash-table entries,
 * etc. The fields themselves may be scalars, pointers, arrays, or nested structs.
 */
export interface StructCell extends CellBase {
  kind: 'struct';
  fields: Cell[];
}

/**
 * The recursive cell model. A cell is the unit of memory the engine renders and diffs. The
 * `kind` discriminant selects the variant.
 */
export type Cell = ScalarCell | PointerCell | ArrayCell | StructCell;

/**
 * Allocation lifecycle of a {@link HeapBlock}, rendered as the four visually-distinct states from
 * the design (PDF screen 04 + legend):
 * - `allocated` — live, reachable, owned by a pointer (teal).
 * - `freed` — returned to the allocator, no live references (desaturated + hatched).
 * - `dangling` — freed, but a pointer still aims at it; reading it is UB (flagged red).
 * - `leaked` — still allocated but unreachable; no incoming pointer (warning marker, no arrow).
 *
 * @remarks Added in Phase 1 (additive; omit to default to `allocated`).
 */
export type AllocationState = 'allocated' | 'freed' | 'dangling' | 'leaked';

/**
 * A heap allocation (the result of a `malloc`/`calloc`). Empty in Phase 0; fully rendered in
 * Phase 1 with its {@link AllocationState}.
 */
export interface HeapBlock {
  /** Stable id; pointer cells reference this to draw arrows into the heap. */
  id: BlockId;
  /** Optional short label, e.g. `"node"`, `"malloc(8)"`, `"32 BYTES"`. */
  label?: string;
  /** Optional C type label, e.g. `"struct node"`, `"int[4]"`. */
  type?: string;
  /** Optional displayed base address, e.g. `"0x600000abcd00"`. */
  address?: string;
  /** Optional size in bytes, for display. */
  size?: number;
  /** The cells living inside this block (struct fields, array elements, or a single scalar). */
  cells: Cell[];
  /**
   * Allocation lifecycle state. Optional and additive — when omitted the block renders as
   * `allocated`. Phase 0 traces (no heap) are unaffected.
   */
  state?: AllocationState;
}

/**
 * One stack frame (one function activation). The engine treats {@link StackFrame.stack | the
 * stack} as an ordered array; see {@link Step.stack} for the ordering convention.
 */
export interface StackFrame {
  /**
   * Stable id for this activation. Must be unique per call so recursion works: two simultaneous
   * `factorial` frames have distinct ids (e.g. `"factorial#1"`, `"factorial#2"`).
   */
  id: FrameId;
  /** Function name shown in the frame header, e.g. `"main"`, `"add"`. */
  name: string;
  /**
   * Monotonic call counter distinguishing invocations of the same function. The first call is
   * `0`, the next `1`, and so on. Combined with `name` it explains recursion to learners.
   */
  callId: number;
  /** Local variables and parameters, in declaration order (top = first declared). */
  variables: Cell[];
  /**
   * Optional displayed base address of the frame, shown in its header (e.g. `"0x7ffee540"`). For
   * recursion, descending addresses per nested call read as the stack growing downward (PDF screen
   * 01). Optional/additive.
   *
   * @remarks Added in Phase 1.
   */
  address?: string;
}

/** Severity of a {@link WatchEntry} line in the console / heap-watch panel. */
export type WatchLevel = 'info' | 'dangling' | 'leak';

/**
 * A heap-watch / diagnostic line shown in the console panel (PDF screen 04). Distinct from
 * {@link Step.stdout} program output: these are the engine's annotations about memory safety.
 *
 * @remarks Added in Phase 1 (additive).
 */
export interface WatchEntry {
  /** Severity; `dangling`/`leak` render in the danger hue. */
  level: WatchLevel;
  /** Human-readable message, e.g. `"dangling: read through old → 0x9040 was freed at heap.c:5"`. */
  message: string;
}

/**
 * A labeled connector drawn over the memory canvas between two entities (by stable id), used for
 * the pointer-arithmetic visual (PDF screen 03): an arc from the base element to `*(p + n)` with
 * the byte-offset annotation. More general than a pointer cell's own arrow, so the same overlay
 * can host future annotations.
 *
 * @remarks Added in Phase 1 (additive).
 */
export interface Annotation {
  /** Stable id for this annotation within the step. */
  id: string;
  /** Source anchor: a {@link Cell} or {@link HeapBlock} id. */
  fromId: string;
  /** Destination anchor: a {@link Cell} or {@link HeapBlock} id. */
  toId: string;
  /** Chip label, e.g. `"p + 2 = 0x5004 + 2×4 = 0x500c"`. */
  label: string;
}

/**
 * A single point in execution: the **complete** memory snapshot plus presentation metadata.
 * The engine renders exactly this and animates the diff against the previous step.
 */
export interface Step {
  /** Stable, human-readable id, e.g. `"add-call"`. Unique within the trace. */
  id: string;
  /** Zero-based position of this step within {@link Trace.steps}. Must equal the array index. */
  index: number;
  /** Plain-language description of what this step does, shown in the narration panel. */
  narration: string;
  /**
   * 1-based source line number(s) currently executing, highlighted in the code panel. Multiple
   * lines are allowed (e.g. a call site and the entered function's signature).
   */
  highlightedLines: number[];
  /**
   * The call stack, **bottom-first**: `stack[0]` is the oldest frame (`main`) and the last
   * element is the top of stack (most recent call). Pushing a call appends; returning pops the
   * last element.
   */
  stack: StackFrame[];
  /** Heap allocations live at this step. Empty array in Phase 0. */
  heap: HeapBlock[];
  /**
   * Id of the single element (frame, cell, or heap block) that is "current" this step — it gets
   * the amber active ring + badge. Exactly one element is current per step (design law). Optional
   * and additive; omit for steps with no focal element.
   *
   * @remarks Added in Phase 1.
   */
  activeId?: string;
  /**
   * Labeled connector overlays for this step (e.g. pointer arithmetic). Optional/additive.
   *
   * @remarks Added in Phase 1.
   */
  annotations?: Annotation[];
  /**
   * Cumulative program output (`printf`) visible at this step, one entry per line. Rendered in the
   * console panel when present. Optional/additive.
   *
   * @remarks Added in Phase 1.
   */
  stdout?: string[];
  /**
   * Heap-watch / diagnostic lines for this step (dangling reads, leaks). Optional/additive.
   *
   * @remarks Added in Phase 1.
   */
  watch?: WatchEntry[];
}

/** Supported source languages. Only C is in scope for SE 200 / SE 201. */
export type TraceLanguage = 'c';

/**
 * A complete, self-contained visualization: source code plus the ordered steps that walk through
 * its execution. This is the unit a content module exports and the engine plays.
 */
export interface Trace {
  /** Stable id for the trace, e.g. `"phase0-add"`. */
  id: string;
  /** Human title shown in the UI, e.g. `"add(x, y) — call stack basics"`. */
  title: string;
  /** Language of {@link Trace.source}; drives syntax presentation. */
  language: TraceLanguage;
  /**
   * The full source as a single string with `\n` line breaks. Line numbers referenced by
   * {@link Step.highlightedLines} are 1-based against this string.
   */
  source: string;
  /** The ordered execution steps. `steps[i].index === i` must hold. */
  steps: Step[];
  /**
   * Optional curriculum rows this trace covers (see `docs/CURRICULUM.md`), e.g.
   * `["SE200: Functions and Nested Loops"]`. Used for coverage tracking.
   */
  covers?: string[];
  /**
   * Breadcrumb metadata for the top bar: `course · topic · file`. **Must be sourced from
   * `docs/CURRICULUM.md` — never fabricate a course code** (the design exploration wrongly invented
   * "SE 220"; static libraries is SE 200). Optional/additive; the chrome falls back to {@link
   * Trace.title} / {@link Trace.id} when absent so Phase 0 traces still render.
   *
   * @remarks Added in Phase 1.
   */
  course?: string;
  /** Breadcrumb topic segment, e.g. `"Recursion"`, `"Linked lists"`. */
  topic?: string;
  /** Breadcrumb file segment, e.g. `"factorial.c"`. */
  file?: string;
  /**
   * Hint for how the heap / data region lays out its blocks: a horizontal `row` (a linked-list
   * chain) or a vertical `column` (independent allocations, as in malloc/free). Defaults to `row`.
   * Optional/additive.
   *
   * @remarks Added in Phase 1.
   */
  heapLayout?: 'row' | 'column';
}
