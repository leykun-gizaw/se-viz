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
  /**
   * The Python object this block shows (Phase 30, additive; see `docs/PYTHON_TRACE_FORMAT.md`).
   * Present only on Python traces (`trace.language === 'python'`), where every object is a block
   * whose id is the object's stable id (`o1`, `o2`, ...). A block with `objectKind` renders as a
   * Python object (no allocation-state badge), not as a malloc block. Absent on C traces.
   *
   * @remarks Added in Phase 30.
   */
  objectKind?: PyObjectKind;
  /**
   * A NumPy array's facts (Phase 34, additive): set exactly when `objectKind` is `'ndarray'`. The
   * block's cells are its captured values, flat in C order (`o3[0,1]`, named `0, 1`), at most
   * {@link NdarrayInfo.size} of them, plus an `o3[…]` cell (`N more`) when the cap cut some off.
   *
   * @remarks Added in Phase 34.
   */
  ndarray?: NdarrayInfo;
}

/**
 * Shape, dtype and memory of a NumPy array block (Phase 34). See `docs/PYTHON_TRACE_FORMAT.md`,
 * "NumPy arrays".
 *
 * @remarks Added in Phase 34.
 */
export interface NdarrayInfo {
  /** `arr.shape`; `ndim` is its length (`[]` for a 0-d array). */
  shape: number[];
  /** `str(arr.dtype)`, e.g. `int64`, `float64`, `bool`, `<U5`. */
  dtype: string;
  /** Number of elements (the product of `shape`); cells hold the first 200 of them. */
  size: number;
  /** `arr.flags.owndata`: false for a view of another array's memory. */
  ownsData: boolean;
  /** The block `arr.base` refers to (the array this one is a view of), or `null`. */
  base: BlockId | null;
  /**
   * Where the elements sit in the owning array's memory (the end of the `base` chain), in bytes:
   * element `(i, j, …)` is at `offset + i·strides[0] + j·strides[1] + …`. Two arrays with the same
   * owner share exactly the elements at equal positions. Absent when it isn't known.
   */
  layout?: { offset: number; strides: number[]; itemsize: number };
}

/**
 * The kind of Python object a {@link HeapBlock} shows (Phase 30, additive). Present only on Python
 * traces. `summary` is a NumPy / pandas object shown as type, shape and dtype (since Phase 34 only
 * pandas objects and arrays of a dtype without primitive values); `ndarray` (Phase 34) is a NumPy
 * array with its values. `other` is any object shown by its `repr`.
 *
 * @remarks Added in Phase 30; `ndarray` in Phase 34.
 */
export type PyObjectKind =
  | 'list'
  | 'tuple'
  | 'set'
  | 'frozenset'
  | 'dict'
  | 'instance'
  | 'function'
  | 'class'
  | 'summary'
  | 'ndarray' // Phase 34: a NumPy array with its values (`HeapBlock.ndarray`)
  | 'other';

/**
 * The static / data segment — a C program's static storage, split into the three textbook
 * sub-segments. It sits alongside the {@link Step.stack | stack} and {@link Step.heap | heap} as a
 * distinct memory region: globals and `static`s live here for the **whole program**, not on the
 * stack. A *local* array is therefore stack memory, while a *global* array is static memory.
 *
 * - `data`   — initialized, **nonzero** globals & `static`s (`.data`).
 * - `bss`    — **zero / uninitialized** globals & `static`s (`.bss`); zeroed at load.
 * - `rodata` — **read-only** data (`.rodata`): string literals and `const` values.
 *
 * Each sub-segment is a list of ordinary {@link Cell}s, reusing the full scalar/pointer/array/struct
 * union — so a `.data` global can be a `struct`, a `.rodata` entry a string `ArrayCell`, and a
 * pointer (on the stack or in `.data`) can target a `.rodata` string. Like frames and heap blocks,
 * every cell keeps a **stable id across steps** (e.g. `g@<addr>` / `s@<name>`), unique across the
 * whole step (frames + heap + static together) so arrows and animations follow it.
 *
 * @remarks Added in Phase 24 (additive). A step without {@link Step.staticData} is unchanged — the
 * static region simply isn't drawn, so existing traces render identically. The **canonical mirror**
 * in `se-viz-tracer` `docs/trace-contract.ts`, plus the tracer mapper/oracle that will populate
 * these segments for live-coding, must be synced in the **backend phase** (not edited here).
 */
export interface StaticSegment {
  /** `.data` — initialized nonzero globals & statics. */
  data: Cell[];
  /** `.bss` — zero / uninitialized globals & statics. */
  bss: Cell[];
  /** `.rodata` — read-only: string literals and `const` data. */
  rodata: Cell[];
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
 * An evaluated boolean condition shown as a chip alongside the narration (e.g. `i <= n → true`).
 * Makes branches and loop tests legible: the learner sees the exact expression and its result this
 * step, rather than inferring it. Optional/additive.
 *
 * @remarks Added in Phase 2.
 */
export interface StepCondition {
  /** The condition expression exactly as written in the source, e.g. `"i <= n"`, `"n % 2 == 0"`. */
  expr: string;
  /** The expression's evaluated result this step. Renders green when `true`, muted when `false`. */
  result: boolean;
}

/** The four kinds of coach note (à la chess.com move labels), each with its own icon + token color. */
export type CoachVariant = 'idea' | 'watch-out' | 'predict' | 'recap';

/**
 * A contextual teaching pop-up for a step (Phase 17, additive) — a "coach" that steps in at a moment
 * that matters, points at the relevant element, and says one sharp thing. Distinct from the
 * always-on one-line {@link Step.narration}: a coach note is **occasional** and **typed**.
 *
 * Authoring convention (see `docs/CONTENT_AUTHORING.md`): selective (only steps that add insight),
 * **1–3 sentences, one idea**, the right variant, anchored to what it's about. At most one per step.
 *
 * @remarks Added in Phase 17.
 */
export interface CoachNote {
  /** Which kind of note — drives the icon and color. */
  variant: CoachVariant;
  /** The explanation, in the voice of a coach. SHORT: 1–3 sentences, one idea. */
  body: string;
  /** Optional short heading. */
  title?: string;
  /**
   * A frame / cell / heap-block id (or a pipeline-node id) to point the bubble at. When it resolves
   * to an on-screen element the bubble anchors to it with a tail; otherwise it falls back.
   */
  anchorId?: string;
  /** Alternatively, anchor to a 1-based source line (mutually exclusive with `anchorId` in practice). */
  anchorLine?: number;
  /**
   * When two-beat stepping (Phase 16) is active, which beat to show the note on: `predict` notes
   * read naturally on `arrive` ("what will happen here?"), explanations on `apply`. Defaults to
   * `apply`. Ignored when two-beat stepping is not present (the note shows on the step).
   */
  beat?: 'arrive' | 'apply';
}

/**
 * Authored content for the step explanation panel (Phase 28, additive). Every field is optional;
 * the panel falls back to data it can derive from the trace (the step's {@link Step.narration} for
 * "What this step did", the step diff for "What changed"). Authored text always wins over a
 * fallback.
 *
 * Strings may use **inline Markdown** only: `` `code` ``, `**bold**`, `*italic*` and `[links](…)`
 * (the same inline subset as theory decks). No block Markdown (lists, headings, fences).
 *
 * @remarks Added in Phase 28.
 */
export interface StepExplanation {
  /**
   * "What this step did", as an ordered breakdown (one short sentence or clause per entry, in the
   * order it happens). When absent or empty the panel shows the step's `narration` instead.
   */
  did?: string[];
  /**
   * The idea this step illustrates, shown in the panel's "Concept" section (closed by default).
   * When absent the panel shows a derived glossary entry (Phase 32), or hides the section.
   */
  concept?: string;
  /**
   * Phase 32 (additive): authored text for the derived sections. Each one, when present and not
   * empty, replaces that section's derived text (authored wins section by section): "What changed"
   * (`changed`, shown instead of the derived rows), "Branch taken", "Loop iteration", "Calls and
   * returns" and "Exceptions". One short sentence per entry, inline Markdown.
   */
  changed?: string[];
  branch?: string[];
  loop?: string[];
  calls?: string[];
  exceptions?: string[];
}

/* ───────────────────────── Python statement facts (Phase 32, additive) ─────────────────────────
 * What the recorder reads from Python's `ast` about each line that runs, so the explanation panel
 * can say what a step did without guessing (see `docs/PYTHON_TRACE_FORMAT.md`, "Statement facts").
 * Present only on Python traces; C traces never set them.
 */

/**
 * A Python expression, simplified from `ast`. `src` is the expression as written, when it is on
 * one line and at most 80 characters (a bare name has no `src`: its text is its `id`). Anything the
 * explanation can't use is `other` (or `fstring`, `yield`, `comprehension`).
 */
export type PyExpr = { src?: string } & (
  | { type: 'name'; id: string }
  | { type: 'const'; repr: string }
  /** Phase 34: `index` may be a `slice` or a tuple `display` of indices (`m[0, 1]`, `m[:, 1]`). */
  | { type: 'subscript'; value: PyExpr; index: PyExpr }
  /** Phase 34: `lower:upper:step` inside a subscript; absent parts were left out in the code. */
  | { type: 'slice'; lower?: PyExpr; upper?: PyExpr; step?: PyExpr }
  | { type: 'attribute'; value: PyExpr; attr: string }
  | { type: 'binop'; op: string; left: PyExpr; right: PyExpr }
  | { type: 'unary'; op: string; operand: PyExpr }
  | { type: 'compare'; ops: string[]; left: PyExpr; comparators: PyExpr[] }
  | { type: 'boolop'; op: 'and' | 'or'; values: PyExpr[] }
  /**
   * `keywords`: the names of keyword arguments, when there are any; `kwargs` (Phase 34): the same
   * arguments with their values (`m.sum(axis=0)`).
   */
  | {
      type: 'call';
      func: PyExpr;
      args: PyExpr[];
      keywords?: string[];
      kwargs?: { name: string; value: PyExpr }[];
    }
  /** A tuple / list / set / dict display; `items` for a tuple or list of at most 8 plain items. */
  | { type: 'display'; of: 'tuple' | 'list' | 'set' | 'dict'; items?: PyExpr[] }
  | { type: 'comprehension'; of: 'list' | 'set' | 'dict' | 'generator' }
  | { type: 'fstring' }
  | { type: 'yield' }
  | { type: 'other' }
);

/** A clause body's line range (first line of its first statement to last line of its last). */
export interface PyBlockRange {
  first: number;
  last: number;
}

/** An `elif` / `else` clause: its header line and its body. An `elif`'s body is the whole `elif`. */
export interface PyElseClause extends PyBlockRange {
  kind: 'elif' | 'else';
  line: number;
}

/** One `except` clause of a `try`. `type` is the clause's exception expression as written. */
export interface PyHandler extends PyBlockRange {
  line: number;
  type: string | null;
}

/** Facts shared by every statement: its first and last line. */
interface PyStatementBase {
  line: number;
  end: number;
}

/**
 * The statement that starts on a line, from Python's `ast` (Phase 32). `Multiple` is a line that
 * starts more than one statement (`a = 1; b = 2`, `if x: y = 1`): nothing more is claimed about it.
 * `Except` is an `except` clause header (Python runs a line event there to test the exception).
 * There is no `Else` statement: an `else:` line never runs a line event; it appears as the
 * {@link PyElseClause} of an `if` / `elif` / `for` / `while` / `try`.
 */
export type PyStatement =
  | { kind: 'Multiple'; line: number }
  | (PyStatementBase &
      (
        | { kind: 'Assign'; targets: PyExpr[]; value: PyExpr }
        | { kind: 'AugAssign'; target: PyExpr; op: string; value: PyExpr }
        | { kind: 'AnnAssign'; target: PyExpr; annotation: string | null; value?: PyExpr }
        | {
            kind: 'If' | 'Elif';
            test: PyExpr;
            body: PyBlockRange;
            orelse?: PyElseClause;
          }
        | {
            kind: 'For';
            target: PyExpr;
            iter: PyExpr;
            body: PyBlockRange;
            orelse?: PyElseClause;
          }
        | { kind: 'While'; test: PyExpr; body: PyBlockRange; orelse?: PyElseClause }
        | { kind: 'Return'; value?: PyExpr }
        | { kind: 'Expr'; value: PyExpr }
        | { kind: 'Import'; names: string[]; module?: string }
        | { kind: 'FunctionDef'; name: string; params: string[] }
        | { kind: 'ClassDef'; name: string }
        | {
            kind: 'Try';
            body: PyBlockRange;
            handlers: PyHandler[];
            orelse?: PyElseClause;
            finalbody?: PyBlockRange & { line: number };
          }
        | { kind: 'Except'; type: string | null; name?: string; body: PyBlockRange }
        | { kind: 'Raise'; value?: PyExpr }
        | { kind: 'Pass' | 'Break' | 'Continue' }
        | { kind: 'With'; body: PyBlockRange }
        | { kind: 'Delete'; targets: PyExpr[] }
        | { kind: 'Global' | 'Nonlocal'; names: string[] }
        | { kind: 'Assert'; test: PyExpr }
        | { kind: 'Other'; name: string }
      ));

export type PyStatementKind = PyStatement['kind'];

/**
 * What the recorder knew about the event behind one Python step (Phase 32, additive). Present on
 * every step of a recorded Python trace; absent on C.
 */
export interface PyStepInfo {
  /** The `sys.settrace` event this step's snapshot was taken on. */
  event: 'line' | 'call' | 'return' | 'exception';
  /**
   * The line that snapshot was taken at: for a `line` event the line about to run next, for `call`
   * the function's `def` line, for `return` / `exception` the line that returned or raised.
   */
  at: number;
  /** `call` events: the function's qualified name, its parameters in order, and its kind. */
  call?: {
    function: string;
    params: string[];
    scope: 'function' | 'generator' | 'coroutine' | 'class' | 'lambda' | 'comprehension';
    /** A generator (or coroutine) resuming, not a new call. */
    resumed?: true;
  };
  /** `return` events: the qualified name of the function returning. */
  function?: string;
  /** `return` events: the frame is exiting because an exception propagates through it. */
  unwinding?: true;
  /** `return` events of a generator suspended at a `yield` (it will resume). */
  yielded?: true;
  /** `exception` events: the exception raised (or passing through) at `at`. */
  exception?: { type: string; message: string };
  /**
   * An extra final step added by Python live coding (Phase 31): `uncaught` ends on an uncaught
   * exception (its output lines added this step are the traceback, not printed output), `stopped`
   * on a limit or Stop.
   */
  ending?: 'uncaught' | 'stopped';
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
   * The static / data segment for this step (Phase 24, additive): file-scope globals and `static`s,
   * split into `.data` / `.bss` / `.rodata` (see {@link StaticSegment}). Globals/statics live here
   * for the program's whole lifetime, **not** on the stack — so a *local* array reads as stack and a
   * *global* reads as static. Omit for traces with no statics; the static region is then not drawn
   * and the step renders exactly as before.
   *
   * @remarks Added in Phase 24. The `se-viz-tracer` contract mirror + mapper + oracle are synced in
   * the backend phase.
   */
  staticData?: StaticSegment;
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
  /**
   * An evaluated condition chip (branch test / loop condition) shown beside the narration.
   * Optional/additive.
   *
   * @remarks Added in Phase 2.
   */
  condition?: StepCondition;
  /**
   * Concept-view payload for this step (Phase 11, additive). A step carries **at most one**, and
   * only the kind matching its trace's {@link Trace.view}; memory traces set none of these. The full
   * per-step snapshot principle still holds — each step restates its view's full state. See
   * {@link PipelineStep}, {@link BeforeAfterStep}, {@link DualTraceStep}.
   *
   * @remarks Added in Phase 11.
   */
  pipeline?: PipelineStep;
  /** Before→after concept-view payload (preprocessor). Set only when `trace.view === 'before-after'`. */
  beforeAfter?: BeforeAfterStep;
  /** Dual-trace concept-view payload (debugging). Set only when `trace.view === 'dual-trace'`. */
  dualTrace?: DualTraceStep;
  /**
   * An optional contextual teaching pop-up for this step (Phase 17). At most one per step; omit on
   * steps that don't add insight. A step without `coach` behaves exactly as before.
   *
   * @remarks Added in Phase 17 (additive).
   */
  coach?: CoachNote;
  /**
   * Optional authored content for the step explanation panel (Phase 28). A step without `explain`
   * renders exactly as before; the panel falls back to the narration and the derived diff. See
   * {@link StepExplanation}.
   *
   * @remarks Added in Phase 28 (additive).
   */
  explain?: StepExplanation;
  /**
   * Python only (Phase 32, additive): the recorder event behind this step, used to derive the
   * explanation panel's text. See {@link PyStepInfo}.
   */
  py?: PyStepInfo;
}

/**
 * Supported source languages. C is SE 200 / SE 201; Python (Phase 30, additive) maps a recorded
 * run onto the same model: names are cells, every object is a {@link HeapBlock} tagged with
 * {@link HeapBlock.objectKind} (see `docs/PYTHON_TRACE_FORMAT.md`).
 */
export type TraceLanguage = 'c' | 'python';

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
  /**
   * Hint for the static / data region (Phase 24): `'full'` shows all three sub-trays —
   * `.data`/`.bss`/`.rodata` — **even when empty**, so a *memory-layout lesson* can teach the
   * complete map. Absent or `'auto'` shows only the non-empty sub-trays (and the whole static
   * region is hidden when a step has no {@link Step.staticData}). Optional/additive.
   *
   * @remarks Added in Phase 24.
   */
  staticLayout?: 'auto' | 'full';
  /**
   * Which renderer plays this trace (Phase 11, additive). Absent or `'memory'` selects the
   * live-memory canvas (Phases 0–10), **unchanged**. The other kinds are non-memory "concept views";
   * each step then carries the matching payload ({@link Step.pipeline} / {@link Step.beforeAfter} /
   * {@link Step.dualTrace}) and the memory `stack`/`heap` stay empty.
   *
   * @remarks Added in Phase 11.
   */
  view?: TraceView;
  /**
   * For `view: 'dual-trace'` only — the left and right column source code. Each step's
   * {@link DualColumn.line} highlights a 1-based line into the matching source. Optional/additive.
   *
   * @remarks Added in Phase 11.
   */
  leftSource?: string;
  rightSource?: string;
  /**
   * Python only (Phase 32, additive): the statement that starts on each line that ran, keyed by the
   * 1-based line number (as a string, for JSON). Lines that never ran, or start no statement, are
   * absent. See {@link PyStatement}.
   */
  statements?: Record<string, PyStatement>;
}

/* ───────────────────────── Concept views (Phase 11, additive) ─────────────────────────
 * Three non-memory screens that live in the same player/chrome as memory traces: the static-library
 * build pipeline, the preprocessor before→after, and dual-trace debugging. A trace opts in via
 * {@link Trace.view}; each step then carries the matching payload below. Memory traces are
 * unaffected (they leave `view` and these payloads unset).
 */

/** The renderer a trace selects. `memory` (or absent) is the Phases 0–10 live-memory canvas. */
export type TraceView = 'memory' | 'pipeline' | 'before-after' | 'dual-trace';

/**
 * One node in a build-pipeline graph. `artifact` nodes are solid cards (a file: `.c`/`.o`/`.a`/the
 * linked binary); `process` nodes are dashed boxes (a tool: `cc`/`ar`/`ld`). Reuses the design's
 * "process box = dashed neutral" treatment.
 */
export interface PipelineNode {
  /** Stable id, referenced by {@link PipelineEdge} endpoints. Unique within the step. */
  id: string;
  /** Solid file card vs dashed tool/process box. */
  kind: 'artifact' | 'process';
  /** Primary label, e.g. `"main.c"`, `"cc"`, `"libutil.a"`. */
  label: string;
  /** Muted secondary label, e.g. `"source"`, `"compile"`, `"archive"`. */
  sublabel?: string;
  /** Visual state this step: not-yet (`idle`), the current focus (`active`), or completed (`done`). */
  state?: 'idle' | 'active' | 'done';
  /** The final output artifact carries the accent (per the design: only the last artifact is accented). */
  accent?: boolean;
}

/** A directed left→right edge between two {@link PipelineNode}s by id. */
export interface PipelineEdge {
  from: string;
  to: string;
}

/** A build-pipeline snapshot for one step: the nodes (with per-step state) and the edges. */
export interface PipelineStep {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

/**
 * A before→after snapshot for one step (preprocessor). `before` is the source with directives;
 * `after` is the translation unit after `cpp`. The highlighted lines (1-based) mark the text
 * transformed this step, rendered in the value-changed green.
 */
export interface BeforeAfterStep {
  before: string;
  after: string;
  /** 1-based line numbers in `before` to highlight this step. */
  beforeHighlights?: number[];
  /** 1-based line numbers in `after` to highlight this step. */
  afterHighlights?: number[];
  /** The process box label bridging the two panels (default `"cpp"`). */
  processLabel?: string;
}

/** One row in a {@link DualColumn} state table: a named value, optionally flagged as just-changed. */
export interface DualColumnRow {
  name: string;
  value: string;
  /** When true, the row pulses in the value-changed green this step. */
  changed?: boolean;
}

/** One side of a dual-trace step: a labeled run with its current line, state rows, and output. */
export interface DualColumn {
  /** Column heading, e.g. `"buggy"`, `"fixed"`. */
  label: string;
  /** 1-based line to highlight in this column's source ({@link Trace.leftSource}/{@link Trace.rightSource}). */
  line?: number;
  /** The column's visible state this step (locals/watch values). */
  rows: DualColumnRow[];
  /** Cumulative console output for this column at this step. */
  stdout?: string[];
}

/**
 * A dual-trace snapshot for one step: two synchronized runs side by side. `diverged` is true from
 * the **first divergent step onward**; that first step is the flagged divergence point.
 */
export interface DualTraceStep {
  left: DualColumn;
  right: DualColumn;
  diverged?: boolean;
}
