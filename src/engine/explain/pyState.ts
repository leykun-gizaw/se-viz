/**
 * Reading a Python trace for derived explanations (Phase 32): which frame a step's line ran in,
 * whether the line finished, which loop pass this is, what a name or `d[k]` held, and a readable
 * path for every object (`counts`, `fields['south']`, `red.fuel`).
 *
 * Everything here reads recorded state only. Nothing evaluates Python: a value is reported only when
 * it is in a snapshot, and anything that can't be read reliably comes back as `null`.
 *
 * @packageDocumentation
 */
import type {
  Cell,
  HeapBlock,
  PyBlockRange,
  PyExpr,
  PyStatement,
  StackFrame,
  Step,
  Trace,
} from '../trace/types.ts';

/** Code objects that run part of one statement: the line's statement facts don't apply to them. */
const EXPRESSION_SCOPES = new Set(['<genexpr>', '<listcomp>', '<dictcomp>', '<setcomp>', '<lambda>']);

export const isExpressionScope = (name: string) => EXPRESSION_SCOPES.has(name);

export const inRange = (line: number, r: PyBlockRange | undefined) =>
  r !== undefined && line >= r.first && line <= r.last;

/** The highlighted line of a step (Python steps highlight exactly one). */
export const lineOf = (step: Step): number => step.highlightedLines[0] ?? 0;

export const topFrame = (step: Step): StackFrame | undefined => step.stack[step.stack.length - 1];

export function frameIn(step: Step, id: string | null): StackFrame | undefined {
  return id === null ? undefined : step.stack.find((f) => f.id === id);
}

export function blockIn(step: Step, id: string | null): HeapBlock | undefined {
  return id === null ? undefined : step.heap.find((b) => b.id === id);
}

/** A loop header's pass, as counted from the loop's latest entry (nested loops restart at 1). */
export interface LoopPass {
  kind: 'For' | 'While';
  /** Passes started so far, this one included when `entered`. */
  iteration: number;
  /** The body runs next (for: an item was taken; while: the test was true). */
  entered: boolean;
}

/** Per-trace facts computed once (see {@link analyze}). */
export interface PyAnalysis {
  /** The frame each step's highlighted line ran in. */
  ran: (string | null)[];
  /** Whether the highlighted line's statement finished in that step. */
  complete: boolean[];
  /** The latest earlier step in the same frame whose statement finished (or `null`). */
  prevInFrame: (number | null)[];
  /** Loop passes at `for` / `while` header steps. */
  loops: (LoopPass | null)[];
  /** The step where each frame id first appears (its call). */
  pushedAt: Map<string, number>;
}

/** The frame a step's line ran in: the caller on a call step, else the top frame. */
function ranIn(step: Step): string | null {
  if (step.py?.event === 'call') return step.stack[step.stack.length - 2]?.id ?? null;
  return topFrame(step)?.id ?? null;
}

/** The statement on the step's highlighted line, unless the line ran inside an expression scope. */
export function statementOf(trace: Trace, step: Step, frameId: string | null): PyStatement | null {
  const frame = frameIn(step, frameId);
  if (!frame || isExpressionScope(frame.name)) return null;
  return trace.statements?.[String(lineOf(step))] ?? null;
}

function isComplete(trace: Trace, step: Step): boolean {
  const py = step.py;
  if (!py || py.ending) return false;
  if (py.event === 'line') {
    // Execution moved on to another statement (a continuation line of the same statement, or the
    // same line again — a comprehension's next pass — means it is still running).
    return py.at !== lineOf(step) && trace.statements?.[String(py.at)] !== undefined;
  }
  if (py.event === 'return') return !py.unwinding && !py.yielded;
  return false;
}

/**
 * Whether step `k` follows an exception event: it highlights the raising line again and shows
 * Python leaving it for a handler (or for the caller), not the line finishing.
 */
export function afterRaise(trace: Trace, k: number): boolean {
  return k > 0 && trace.steps[k - 1].py?.event === 'exception';
}

const cache = new WeakMap<Trace, { length: number; analysis: PyAnalysis }>();

/** Analyze a Python trace once (cached per trace and step count). */
export function analyze(trace: Trace): PyAnalysis {
  const hit = cache.get(trace);
  if (hit && hit.length === trace.steps.length) return hit.analysis;
  const steps = trace.steps;
  const ran = steps.map(ranIn);
  // The step after an exception event shows Python leaving the raising line (see `afterRaise`): the
  // line didn't finish.
  const complete = steps.map((s, k) => isComplete(trace, s) && !afterRaise(trace, k));
  const prevInFrame: (number | null)[] = [];
  const loops: (LoopPass | null)[] = [];
  const pushedAt = new Map<string, number>();
  const last = new Map<string, number>();
  const passes = new Map<string, number>();
  steps.forEach((step, k) => {
    for (const f of step.stack) if (!pushedAt.has(f.id)) pushedAt.set(f.id, k);
    const frame = ran[k];
    const prev = frame === null ? undefined : last.get(frame);
    prevInFrame.push(prev ?? null);
    loops.push(null);
    const stmt = statementOf(trace, step, frame);
    if (complete[k] && stmt && (stmt.kind === 'For' || stmt.kind === 'While') && step.py) {
      const key = `${frame}:${stmt.line}`;
      // A pass comes back from the loop's own body; anything else is a fresh entry.
      const back = prev !== undefined && inRange(lineOf(steps[prev]), stmt.body);
      const entered = inRange(step.py.at, stmt.body);
      const n = (back ? (passes.get(key) ?? 0) : 0) + (entered ? 1 : 0);
      passes.set(key, n);
      loops[k] = { kind: stmt.kind, iteration: n, entered };
    }
    if (frame !== null && complete[k]) last.set(frame, k);
  });
  const analysis = { ran, complete, prevInFrame, loops, pushedAt };
  cache.set(trace, { length: steps.length, analysis });
  return analysis;
}

/* ───────────────────────── values ───────────────────────── */

/** A value read from a snapshot: the cell, and the path it was read through. */
export interface Read {
  cell: Cell;
  path: string;
}

/** The text of an expression as written (`counts[crop]`), or `null` when it wasn't kept. */
export function exprText(e: PyExpr): string | null {
  if (e.type === 'name') return e.id;
  // A constant written exactly as its repr carries no separate text.
  if (e.type === 'const') return e.src ?? e.repr;
  return e.src ?? null;
}

/** A name as the line sees it: its own frame first, then the global frame. */
export function lookupName(step: Step, frameId: string | null, name: string): Cell | null {
  const frame = frameIn(step, frameId);
  if (!frame) return null;
  const own = frame.variables.find((v) => v.name === name);
  if (own) return own;
  const global = step.stack[0];
  if (global && global !== frame && global.name === '<module>') {
    return global.variables.find((v) => v.name === name) ?? null;
  }
  return null;
}

/** The object a cell refers to, if it is a reference to a recorded object. */
export function targetBlock(step: Step, cell: Cell | null): HeapBlock | undefined {
  return cell?.kind === 'pointer' ? blockIn(step, cell.target) : undefined;
}

/** The slot `key` (an item index or a key's `repr`) of a dict / list / tuple. */
export function slotOf(block: HeapBlock, key: string): Cell | undefined {
  if (block.objectKind === 'dict') return block.cells.find((c) => c.id === `${block.id}[${key}]`);
  if (block.objectKind === 'list' || block.objectKind === 'tuple') {
    if (!/^-?\d+$/.test(key)) return undefined;
    const items = block.cells.filter((c) => c.name !== '…');
    // Indexing past the recorded items (the container cap) can't be read.
    if (items.length !== block.cells.length && Number(key) < 0) return undefined;
    const i = Number(key) < 0 ? items.length + Number(key) : Number(key);
    return items[i];
  }
  return undefined;
}

/**
 * Read an expression's value from a snapshot, without evaluating anything: a name, a constant,
 * `container[key]` (dict / list / tuple, key read the same way) and `obj.attr` (an instance
 * attribute). Anything else is `null`.
 */
export function readExpr(step: Step, frameId: string | null, e: PyExpr): Read | null {
  switch (e.type) {
    case 'name': {
      const cell = lookupName(step, frameId, e.id);
      return cell ? { cell, path: e.id } : null;
    }
    case 'const':
      return {
        cell: { kind: 'scalar', id: '', name: '', type: 'const', value: e.repr },
        path: exprText(e) ?? e.repr,
      };
    case 'subscript': {
      const container = readExpr(step, frameId, e.value);
      const key = readExpr(step, frameId, e.index);
      const block = container ? targetBlock(step, container.cell) : undefined;
      if (!container || !block || key?.cell.kind !== 'scalar' || key.cell.value === null) return null;
      const keyText = String(key.cell.value);
      const cell = slotOf(block, keyText);
      return cell ? { cell, path: `${container.path}[${keyText}]` } : null;
    }
    case 'attribute': {
      const owner = readExpr(step, frameId, e.value);
      const block = owner ? targetBlock(step, owner.cell) : undefined;
      if (!owner || block?.objectKind !== 'instance') return null;
      const cell = block.cells.find((c) => c.id === `${block.id}.${e.attr}`);
      return cell ? { cell, path: `${owner.path}.${e.attr}` } : null;
    }
    default:
      return null;
  }
}

/** The path a store targets (`counts['corn']`, `self.fuel`, `x`), resolving keys in `step`. */
export function targetPath(step: Step, frameId: string | null, e: PyExpr): string | null {
  switch (e.type) {
    case 'name':
      return e.id;
    case 'subscript': {
      const container = targetPath(step, frameId, e.value);
      const key = readExpr(step, frameId, e.index);
      if (container === null || key?.cell.kind !== 'scalar' || key.cell.value === null) return null;
      return `${container}[${String(key.cell.value)}]`;
    }
    case 'attribute': {
      const owner = targetPath(step, frameId, e.value);
      return owner === null ? null : `${owner}.${e.attr}`;
    }
    default:
      return null;
  }
}

/** What kind of object a block is, in words: `list`, `dict`, `Tractor` instance, … */
export function kindWord(block: HeapBlock): string {
  switch (block.objectKind) {
    case 'instance':
      return `${block.type ?? 'object'} object`;
    case 'function':
      return 'function';
    case 'class':
      return 'class';
    case 'summary':
      return block.label ?? block.type ?? 'object';
    default:
      return block.type ?? block.objectKind ?? 'object';
  }
}

/** "a list", "an int". */
export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

/** Every name (bound in a frame) that refers to the object `id`, top frame first. */
export function namesFor(step: Step, id: string): { name: string; frame: StackFrame }[] {
  const out: { name: string; frame: StackFrame }[] = [];
  for (let i = step.stack.length - 1; i >= 0; i--) {
    const frame = step.stack[i];
    for (const v of frame.variables) {
      if (v.kind === 'pointer' && v.target === id && v.name !== 'return') out.push({ name: v.name, frame });
    }
  }
  return out;
}

/**
 * A readable path for every object reachable from the frames: `counts`, `fields['south']`,
 * `animals[1]`, `red.fuel`. Breadth-first from the top frame down, so the shortest path (and the
 * current function's own names) wins.
 */
export function objectPaths(step: Step, prefer: ReadonlySet<string> = new Set()): Map<string, string> {
  const paths = new Map<string, string>();
  const blocks = new Map(step.heap.map((b) => [b.id, b]));
  // Names the current line uses, and what they lead to, come first (`b.append(3)` names the list
  // `b`, not `a`; `self.crops.append(…)` names it `self.crops`, not a caller's name).
  for (const preferred of [true, false]) {
    const queue: string[] = [];
    for (let i = step.stack.length - 1; i >= 0; i--) {
      for (const v of step.stack[i].variables) {
        if (v.kind !== 'pointer' || v.target === null || v.name === 'return') continue;
        if (prefer.has(v.name) !== preferred || paths.has(v.target)) continue;
        paths.set(v.target, v.name);
        queue.push(v.target);
      }
    }
    while (queue.length > 0) {
      const id = queue.shift()!;
      const block = blocks.get(id);
      const base = paths.get(id)!;
      if (!block) continue;
      for (const c of block.cells) {
        if (c.kind !== 'pointer' || c.target === null || paths.has(c.target)) continue;
        const path = slotPath(block, c, base);
        if (path === null) continue;
        paths.set(c.target, path);
        queue.push(c.target);
      }
    }
  }
  return paths;
}

/** `base[0]`, `base['k']`, `base.attr`; `null` for a set member (it has no path). */
export function slotPath(block: HeapBlock, cell: Cell, base: string): string | null {
  switch (block.objectKind) {
    case 'list':
    case 'tuple':
    case 'dict':
      return cell.name === '…' ? null : `${base}[${cell.name}]`;
    case 'instance':
      return `${base}.${cell.name}`;
    default:
      return null;
  }
}

/** A cell's value as shown: a primitive's `repr`, or `list o3` for a reference. */
export function valueText(step: Step, cell: Cell): string {
  if (cell.kind === 'scalar') return cell.value === null ? '?' : String(cell.value);
  if (cell.kind === 'pointer') {
    const block = blockIn(step, cell.target);
    return block ? `${block.type ?? 'object'} ${block.id}` : '…';
  }
  return cell.type;
}

/** Display name of a recorded function: `Tractor.drive`, `inner` (not `outer.<locals>.inner`). */
export function functionName(qualname: string): string {
  if (qualname.includes('<locals>')) return qualname.slice(qualname.lastIndexOf('.') + 1);
  return qualname;
}
