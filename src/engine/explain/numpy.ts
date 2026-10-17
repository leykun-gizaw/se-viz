/**
 * Derived explanations for NumPy statements (Phase 34): creating arrays, indexing and slicing (which
 * cells), elementwise arithmetic and broadcasting (both shapes and the result's), aggregation with
 * `axis`, reshape, transpose, boolean masks (which cells are `True`), and views versus copies
 * (including a write through a view, and the lack of one through a copy).
 *
 * The rule is the Phase 32 one: say only what the trace shows. Shapes, dtypes, values, which array
 * a view shares memory with and which elements it shares (`ndarray.ts`) are all read from the
 * recorded states; nothing is evaluated here. What a NumPy function *does* (`np.zeros` fills with
 * zeros, `sum` adds) is stated only for the functions named below, and checked against the result
 * where it can be. Anything else gets the generic text of `python.ts`.
 *
 * @packageDocumentation
 */
import {
  elementCells,
  fullyCaptured,
  isArray,
  memoryOwner,
  sharedCells,
  shapeText,
  unravel,
  writeThrough,
  type ArrayBlock,
} from '../trace/ndarray.ts';
import type { Cell, PyExpr, PyStatement, Step, Trace } from '../trace/types.ts';
import type { ConceptKey } from './glossary.ts';
import { exprText, lookupName, namesFor, objectPaths, readExpr, targetBlock } from './pyState.ts';
import { code, count } from './text.ts';

/** What the NumPy templates need about a step (a subset of `python.ts`'s context). */
export interface NpCtx {
  trace: Trace;
  step: Step;
  /** The state before the line ran. */
  pre: Step | null;
  frame: string | null;
  complete: boolean;
  resumed: boolean;
}

/** The NumPy reading of a statement: its breakdown, the sentence that names it, and its concept. */
export interface NumpyDid {
  did: string[];
  /** The one sentence for the step's narration. */
  lead: string;
  concept: ConceptKey;
}

/* ───────────────────────── reading ───────────────────────── */

/** The array an expression names (a name, or `d[k]` / `obj.attr` holding one), in `step`. */
function arrayAt(
  step: Step | null,
  frame: string | null,
  e: PyExpr | undefined,
): ArrayBlock | null {
  if (!step || !e) return null;
  const r = readExpr(step, frame, e);
  const b = r ? targetBlock(step, r.cell) : undefined;
  return isArray(b) ? b : null;
}

/** A NumPy scalar's dtype (`np.int32` cell → `int32`), or null for a plain Python value. */
const npDtype = (cell: Cell | null | undefined) =>
  cell?.kind === 'scalar' && cell.type.startsWith('np.') ? cell.type.slice(3) : null;

const scalarText = (cell: Cell) => (cell.kind === 'scalar' ? String(cell.value) : '?');

/** An integer constant as written (`1`, `-1`), or null. */
function intConst(e: PyExpr | undefined): number | null {
  if (!e) return null;
  if (e.type === 'const' && /^\d+$/.test(e.repr)) return Number(e.repr);
  if (
    e.type === 'unary' &&
    e.op === '-' &&
    e.operand.type === 'const' &&
    /^\d+$/.test(e.operand.repr)
  ) {
    return -Number(e.operand.repr);
  }
  return null;
}

/** An integer index as the line read it: a constant, or a name holding an int. */
function intIndex(ctx: NpCtx, e: PyExpr): number | null {
  const c = intConst(e);
  if (c !== null) return c;
  if (e.type !== 'name' || !ctx.pre) return null;
  const cell = lookupName(ctx.pre, ctx.frame, e.id);
  return cell?.kind === 'scalar' && /^-?\d+$/.test(String(cell.value)) ? Number(cell.value) : null;
}

/** The module a call goes through (`np.zeros` → `zeros`), when `np` is no name in the program. */
function numpyFunction(ctx: NpCtx, e: PyExpr): string | null {
  if (e.type !== 'call' || e.func.type !== 'attribute' || e.func.value.type !== 'name') return null;
  const mod = e.func.value.id;
  // Modules are left out of frames, so an imported `np` is not a name the trace shows.
  if (!ctx.pre || lookupName(ctx.pre, ctx.frame, mod) !== null) return null;
  return mod === 'np' || mod === 'numpy' ? e.func.attr : null;
}

/** The `axis` of an aggregation: `axis=k`, or the given positional argument; null for none. */
function axisOf(
  call: Extract<PyExpr, { type: 'call' }>,
  positional: number,
): number | 'unknown' | null {
  const kw = call.kwargs?.find((k) => k.name === 'axis');
  const e = kw?.value ?? call.args[positional];
  if (!e) return null;
  if (e.type === 'const' && e.repr === 'None') return null;
  return intConst(e) ?? 'unknown';
}

/** How the program names an array: `` `a` `` (the line's own name first), else `ndarray o6`. */
function arrayName(step: Step, block: ArrayBlock, prefer: ReadonlySet<string> = new Set()): string {
  const path = objectPaths(step, prefer).get(block.id);
  return path !== undefined ? code(path) : `ndarray ${block.id}`;
}

/** `` `(2, 3)` ``. */
const shp = (shape: readonly number[]) => code(shapeText(shape));

/** "1-D", "2-D", …; "0-d" for a single value. */
const dims = (shape: readonly number[]) => (shape.length === 0 ? '0-d' : `${shape.length}-D`);

/** The element indices of `cellIds` in `block`, as `[i, j]`. */
function indicesOf(block: ArrayBlock, cellIds: readonly string[]): number[][] {
  const cells = elementCells(block);
  const at = new Map(cells.map((c, i) => [c.id, i]));
  return cellIds
    .map((id) => at.get(id))
    .filter((i): i is number => i !== undefined)
    .sort((a, b) => a - b)
    .map((i) => unravel(i, block.ndarray.shape));
}

/** "1, 2 and 3". */
function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Which cells of `block` these are, in words: "index 2", "indices 1 to 3", "row 1", "column 2",
 * "the elements (0, 1) and (1, 2)", or "6 elements" when there are many scattered ones.
 */
function whichCells(block: ArrayBlock, idx: readonly number[][]): string {
  const { shape } = block.ndarray;
  if (idx.length === 0) return 'no elements';
  if (idx.length === block.ndarray.size && fullyCaptured(block))
    return `all ${count(idx.length, 'element')}`;
  if (shape.length === 1) {
    const flat = idx.map((i) => i[0]);
    const run = flat.every((v, k) => k === 0 || v === flat[k - 1] + 1);
    if (flat.length === 1) return `index ${flat[0]}`;
    if (run && flat.length > 3) return `indices ${flat[0]} to ${flat[flat.length - 1]}`;
    if (flat.length <= 6) return `indices ${list(flat.map(String))}`;
    return count(flat.length, 'element');
  }
  if (shape.length === 2) {
    const [rows, cols] = shape;
    const sameRow = idx.every((i) => i[0] === idx[0][0]);
    const sameCol = idx.every((i) => i[1] === idx[0][1]);
    if (sameRow && idx.length === cols && cols > 1) return `row ${idx[0][0]}`;
    if (sameCol && idx.length === rows && rows > 1) return `column ${idx[0][1]}`;
  }
  if (idx.length === 1) return `the element at ${code(`[${idx[0].join(', ')}]`)}`;
  if (idx.length <= 6) return `the elements ${list(idx.map((i) => code(`[${i.join(', ')}]`)))}`;
  return count(idx.length, 'element');
}

/** Up to 8 values of an array, as `[5, 7, 9]`; null if it has more or wasn't fully recorded. */
function valuesText(block: ArrayBlock): string | null {
  const cells = elementCells(block);
  if (!fullyCaptured(block) || cells.length > 8 || block.ndarray.shape.length !== 1) return null;
  return code(`[${cells.map(scalarText).join(', ')}]`);
}

/* ───────────────────────── operands ───────────────────────── */

interface Operand {
  /** How it reads: `` `a` ``, `` `2` ``. */
  text: string;
  /** Its shape (`[]` for a single number). */
  shape: number[];
  array: ArrayBlock | null;
}

function operandOf(ctx: NpCtx, e: PyExpr): Operand | null {
  const t = exprText(e);
  if (t === null) return null;
  const arr = arrayAt(ctx.pre, ctx.frame, e);
  if (arr) return { text: code(t), shape: arr.ndarray.shape, array: arr };
  if (e.type === 'const' && /^-?[\d.]+(e-?\d+)?$/i.test(e.repr))
    return { text: code(e.repr), shape: [], array: null };
  if (intConst(e) !== null) return { text: code(t), shape: [], array: null };
  if (e.type === 'name' && ctx.pre) {
    const cell = lookupName(ctx.pre, ctx.frame, e.id);
    if (cell?.kind === 'scalar' && /^-?[\d.]+(e-?\d+)?$/i.test(String(cell.value))) {
      return { text: `${code(e.id)} (${code(String(cell.value))})`, shape: [], array: null };
    }
  }
  return null;
}

/** The axes of `result` along which an operand of `shape` is repeated (right-aligned, NumPy's rule). */
function stretchedAxes(shape: readonly number[], result: readonly number[]): number[] {
  const out: number[] = [];
  const pad = result.length - shape.length;
  result.forEach((n, d) => {
    const mine = d < pad ? 1 : shape[d - pad];
    if (mine === 1 && n > 1) out.push(d);
  });
  return out;
}

const axesWords = (axes: readonly number[]) =>
  axes.length === 1 ? `axis ${axes[0]}` : `axes ${list(axes.map(String))}`;

const ELEMENTWISE: Record<string, [verb: string, joiner: string]> = {
  '+': ['Added', 'and'],
  '-': ['Subtracted', 'minus'],
  '*': ['Multiplied', 'by'],
  '/': ['Divided', 'by'],
  '//': ['Divided (rounding down)', 'by'],
  '%': ['Took the remainder of', 'divided by'],
  '**': ['Raised', 'to the power'],
};

/** An operation with one array and one single value, in words. */
const SCALAR: Record<string, (arr: string, value: string) => string> = {
  '+': (a, v) => `Added ${v} to every element of ${a}`,
  '-': (a, v) => `Subtracted ${v} from every element of ${a}`,
  '*': (a, v) => `Multiplied every element of ${a} by ${v}`,
  '/': (a, v) => `Divided every element of ${a} by ${v}`,
  '//': (a, v) => `Divided every element of ${a} by ${v}, rounding down`,
  '%': (a, v) => `Took the remainder of every element of ${a} divided by ${v}`,
  '**': (a, v) => `Raised every element of ${a} to the power ${v}`,
};

/**
 * The broadcasting sentence for two operands and a result: both shapes, the result's, and which
 * operand is repeated along which axes. Null when the shapes are all the same (no broadcasting).
 */
export function broadcastSentence(
  left: { text: string; shape: readonly number[] },
  right: { text: string; shape: readonly number[] },
  result: readonly number[],
): string | null {
  const same = (a: readonly number[], b: readonly number[]) =>
    a.join() === b.join() && a.length === b.length;
  if (same(left.shape, right.shape) && same(left.shape, result)) return null;
  const scalar = [left, right].find((o) => o.shape.length === 0);
  if (scalar) {
    const arr = scalar === left ? right : left;
    if (arr.shape.length === 0) return null;
    return (
      `Broadcasting: ${arr.text} has shape ${shp(arr.shape)} and ${scalar.text} is a single value ` +
      `(shape ${code('()')}), so the result has shape ${shp(result)}: ${scalar.text} is used for every element.`
    );
  }
  const parts: string[] = [];
  for (const o of [left, right]) {
    const axes = stretchedAxes(o.shape, result);
    if (axes.length > 0) parts.push(`${o.text} is repeated along ${axesWords(axes)}`);
  }
  const how = parts.length > 0 ? `: lined up from the right, ${list(parts)}` : '';
  return (
    `Broadcasting: ${left.text} has shape ${shp(left.shape)} and ${right.text} has shape ` +
    `${shp(right.shape)}, so the result has shape ${shp(result)}${how}.`
  );
}

/** The `True` cells of a boolean array: where, and how many; null if not all were recorded. */
function trueCells(block: ArrayBlock): { where: string; n: number } | null {
  if (!fullyCaptured(block)) return null;
  const ids = elementCells(block)
    .filter((c) => c.kind === 'scalar' && c.value === 'True')
    .map((c) => c.id);
  return {
    where: ids.length === 0 ? 'no element' : whichCells(block, indicesOf(block, ids)),
    n: ids.length,
  };
}

/** "`True` at indices 1, 2 and 4 (3 of 5)". */
function trueText(block: ArrayBlock): string | null {
  const t = trueCells(block);
  if (!t) return null;
  if (t.n === 0) return `${code('False')} everywhere: no element is ${code('True')}`;
  return `${code('True')} at ${t.where} (${t.n} of ${block.ndarray.size})`;
}

/* ───────────────────────── views and copies ───────────────────────── */

/** "`view` is a view of `base`" / "… shares memory with …", for two arrays that share elements. */
function relation(step: Step, a: ArrayBlock, b: ArrayBlock, prefer: ReadonlySet<string>): string {
  const an = arrayName(step, a, prefer);
  const bn = arrayName(step, b, prefer);
  if (a.ndarray.base === b.id) return `${an} is a view of ${bn}`;
  if (b.ndarray.base === a.id) return `${bn} is a view of ${an}`;
  return `${an} and ${bn} share memory`;
}

/** The element path of a cell: `` `base[1]` ``, `` `grid[1, 2]` ``. */
function cellPath(
  step: Step,
  block: ArrayBlock,
  cellId: string,
  prefer: ReadonlySet<string>,
): string {
  const cell = block.cells.find((c) => c.id === cellId);
  const path = objectPaths(step, prefer).get(block.id);
  if (!cell) return '?';
  return path !== undefined
    ? code(`${path}[${cell.name}]`)
    : `${code(`[${cell.name}]`)} of ndarray ${block.id}`;
}

/** Sentences for a write into `target`: which other arrays saw it, or that none did. */
function writeEffects(
  ctx: NpCtx,
  target: ArrayBlock,
  written: readonly string[],
  prefer: ReadonlySet<string>,
): string[] {
  const { step, pre } = ctx;
  if (!pre) return [];
  const changed = new Set<string>();
  for (const b of step.heap) {
    if (!isArray(b)) continue;
    const before = pre.heap.find((x) => x.id === b.id);
    if (!before) continue;
    const old = new Map(before.cells.map((c) => [c.id, c]));
    for (const c of b.cells) {
      const was = old.get(c.id);
      if (was && was.kind === 'scalar' && c.kind === 'scalar' && was.value !== c.value)
        changed.add(c.id);
    }
  }
  const mine = new Set(written);
  const others = new Map<string, string[]>();
  for (const [a, b] of writeThrough(step, changed)) {
    if (!mine.has(a)) continue;
    const owner = step.heap.find((x) => x.cells.some((c) => c.id === b));
    if (!isArray(owner) || owner.id === target.id) continue;
    others.set(owner.id, [...(others.get(owner.id) ?? []), b]);
  }
  const out: string[] = [];
  for (const [id, cells] of others) {
    const other = step.heap.find((x) => x.id === id);
    if (!isArray(other)) continue;
    const paths = cells.map((c) => cellPath(step, other, c, prefer));
    out.push(
      `${capitalizeCode(relation(step, target, other, prefer))}, so ${list(paths)} changed too: ` +
        `the two arrays share ${cells.length === 1 ? 'that element' : 'those elements'}.`,
    );
  }
  if (out.length === 0) {
    // Nothing else shares these elements: say so, as that is the copy's whole point.
    const sharing = step.heap.some(
      (b) =>
        isArray(b) &&
        b.id !== target.id &&
        [...sharedCells(step, target, b).keys()].some((c) => mine.has(c)),
    );
    if (!sharing) {
      const name = arrayName(step, target, prefer);
      out.push(
        target.ndarray.ownsData
          ? `No other array shares these elements (${name} owns its data), so only ${name} changed.`
          : `No other array on screen shares these elements, so only ${name} changed.`,
      );
    }
  }
  return out;
}

/** "`view` is a view of `a`: …" for a new array, or that it is a copy; null if neither is known. */
function viewOrCopy(
  ctx: NpCtx,
  made: ArrayBlock,
  source: ArrayBlock | null,
  name: string,
  prefer: ReadonlySet<string>,
): string | null {
  const { step } = ctx;
  if (
    source &&
    memoryOwner(step, made) !== null &&
    memoryOwner(step, made) === memoryOwner(step, source)
  ) {
    const src = arrayName(step, source, prefer);
    return made.ndarray.base === source.id
      ? `${name} is a view of ${src}: no data was copied, so a change made through either one shows in both.`
      : `${name} shares memory with ${src} (both use the data of ${ownerName(step, made, prefer)}): no data was copied.`;
  }
  if (made.ndarray.ownsData) {
    return source
      ? `${name} is a copy: it owns its data, so changing it won't change ${arrayName(step, source, prefer)}.`
      : null;
  }
  return null;
}

/** The array owning a view's data, as the program names it. */
function ownerName(step: Step, made: ArrayBlock, prefer: ReadonlySet<string>): string {
  const id = memoryOwner(step, made);
  const owner = id === null ? undefined : step.heap.find((b) => b.id === id);
  return isArray(owner) ? arrayName(step, owner, prefer) : `ndarray ${id ?? '?'}`;
}

/** "Function `np.linspace` returned a view of an array it made inside": a base no name refers to. */
function hiddenBase(ctx: NpCtx, made: ArrayBlock): string | null {
  const base = made.ndarray.base;
  if (base === null) return null;
  if (namesFor(ctx.step, base).length > 0) return null;
  return `It is a view of ndarray ${base}, an array NumPy made along the way that no name refers to.`;
}

const capitalizeCode = (s: string) =>
  s.length > 0 && s[0] !== '`' ? s[0].toUpperCase() + s.slice(1) : s;

/* ───────────────────────── statements ───────────────────────── */

const AGGREGATES: Record<string, [all: string, along: string]> = {
  sum: ['Summed all', 'Summed'],
  mean: ['Averaged all', 'Averaged'],
  max: ['Found the largest of the', 'Took the largest value of'],
  min: ['Found the smallest of the', 'Took the smallest value of'],
};

/** `m.sum()`, `m.mean(axis=1)`, `np.max(m, axis=0)`. */
function aggregate(
  ctx: NpCtx,
  fn: string,
  source: ArrayBlock,
  call: Extract<PyExpr, { type: 'call' }>,
  positional: number,
  target: string,
  stored: Cell,
  prefer: ReadonlySet<string>,
): NumpyDid | null {
  const words = AGGREGATES[fn];
  if (!words) return null;
  const src = arrayName(ctx.pre ?? ctx.step, source, prefer);
  const axis = axisOf(call, positional);
  const { shape, size } = source.ndarray;
  if (axis === null) {
    if (stored.kind !== 'scalar') return null;
    const v = code(scalarText(stored));
    const bools =
      source.ndarray.dtype === 'bool' && fn === 'sum' ? ` (each ${code('True')} counts as 1)` : '';
    const lead = `${words[0]} ${count(size, 'element')} of ${src}${bools}: ${v}.`;
    const dt = npDtype(stored);
    const set = `Set ${code(target)} to ${v}${dt ? `, a NumPy ${code(dt)} value` : ''}.`;
    return { did: [lead, set], lead, concept: 'np-aggregate' };
  }
  const made = targetBlock(ctx.step, stored);
  if (axis === 'unknown' || !isArray(made)) return null;
  const k = axis < 0 ? axis + shape.length : axis;
  if (k < 0 || k >= shape.length) return null;
  const how = shape.length === 2 ? (k === 0 ? ', down each column' : ', across each row') : '';
  const per =
    shape.length === 2
      ? k === 0
        ? 'one result per column'
        : 'one result per row'
      : `axis ${k} disappears`;
  const values = valuesText(made);
  const lead =
    `${words[1]} ${src} along axis ${k}${how}: ${per}, so shape ${shp(shape)} becomes ` +
    `${shp(made.ndarray.shape)}.`;
  const set = `${code(target)} now refers to the result, a new ndarray${values ? `: ${values}` : ''}.`;
  return { did: [lead, set], lead, concept: 'np-aggregate-axis' };
}

/** `np.array([...])`, `np.arange(6)`, `np.zeros((2, 3))`, `np.ones(4)`, `np.linspace(0, 1, 5)`. */
function creation(
  ctx: NpCtx,
  fn: string,
  call: Extract<PyExpr, { type: 'call' }>,
  target: string,
  made: ArrayBlock,
): NumpyDid | null {
  const { shape, dtype } = made.ndarray;
  const cells = elementCells(made);
  const facts = `shape ${shp(shape)}, dtype ${code(dtype)}`;
  const first = cells[0] && code(scalarText(cells[0]));
  const last =
    fullyCaptured(made) && cells.length > 0 ? code(scalarText(cells[cells.length - 1])) : null;
  const callText = call.src ? code(call.src) : null;
  let lead: string | null = null;
  switch (fn) {
    case 'array':
    case 'asarray': {
      const arg = call.args[0];
      const from =
        arg?.type === 'display'
          ? `the ${arg.of}${arg.items?.some((i) => i.type === 'display') ? ' of lists' : ''} written in the code`
          : arg?.type === 'name'
            ? code(arg.id)
            : null;
      if (!from) return null;
      lead = `${code(target)} now refers to a new ${dims(shape)} ndarray made from ${from}: ${facts}.`;
      break;
    }
    case 'arange':
      if (!callText || !first) return null;
      lead =
        `${callText} made ${count(made.ndarray.size, 'evenly spaced number')}` +
        `${last && cells.length > 1 ? `, from ${first} to ${last}` : ''}: ${facts}. ${code(target)} now refers to it.`;
      break;
    case 'linspace':
      if (!callText || !first) return null;
      lead =
        `${callText} made ${count(made.ndarray.size, 'evenly spaced number')}` +
        `${last && cells.length > 1 ? ` from ${first} to ${last}` : ''}: ${facts}. ${code(target)} now refers to it.`;
      break;
    case 'zeros':
    case 'ones': {
      if (!callText || !first || !cells.every((c) => scalarText(c) === scalarText(cells[0])))
        return null;
      lead = `${callText} made a ${dims(shape)} ndarray filled with ${first}: ${facts}. ${code(target)} now refers to it.`;
      break;
    }
    default:
      return null;
  }
  return { did: [lead, hiddenBase(ctx, made) ?? ''], lead, concept: 'np-create' };
}

/** `a[1]`, `m[0, 2]`, `a[-1]`: one element read out as a NumPy scalar. */
function elementRead(
  ctx: NpCtx,
  source: ArrayBlock,
  index: PyExpr,
  target: string,
  stored: Cell,
  prefer: ReadonlySet<string>,
): NumpyDid | null {
  const { shape } = source.ndarray;
  const parts = index.type === 'display' && index.of === 'tuple' ? (index.items ?? []) : [index];
  if (parts.length !== shape.length) return null;
  const idx: number[] = [];
  for (const [d, p] of parts.entries()) {
    const i = intIndex(ctx, p);
    if (i === null) return null;
    idx.push(i < 0 ? i + shape[d] : i);
  }
  if (idx.some((i, d) => i < 0 || i >= shape[d])) return null;
  const pre = ctx.pre;
  const cell = pre
    ? (pre.heap.find((b) => b.id === source.id)?.cells.find((c) => c.name === idx.join(', ')) ??
      null)
    : null;
  if (!cell || cell.kind !== 'scalar' || stored.kind !== 'scalar' || cell.value !== stored.value)
    return null;
  const src = arrayName(pre ?? ctx.step, source, prefer);
  const v = code(scalarText(stored));
  const where =
    shape.length === 1
      ? intIndex(ctx, parts[0])! < 0
        ? `index ${intIndex(ctx, parts[0])} (counted from the end: index ${idx[0]})`
        : `index ${idx[0]}`
      : shape.length === 2
        ? `row ${idx[0]}, column ${idx[1]}`
        : code(`[${idx.join(', ')}]`);
  const lead = `Read the element at ${where} of ${src}: ${v}.`;
  const dt = npDtype(stored);
  return {
    did: [
      lead,
      `Set ${code(target)} to ${v}${dt ? `, a NumPy ${code(dt)} value (not an array)` : ''}.`,
    ],
    lead,
    concept: 'np-index',
  };
}

/** `x = a[...]` that made a new array: a view (slice, row, column) or a copy (mask, fancy index). */
function subscriptArray(
  ctx: NpCtx,
  source: ArrayBlock,
  e: Extract<PyExpr, { type: 'subscript' }>,
  target: string,
  made: ArrayBlock,
  prefer: ReadonlySet<string>,
): NumpyDid | null {
  const step = ctx.step;
  const src = arrayName(step, source, prefer);
  const name = code(target);
  const shared = sharedCells(step, made, source);
  const sub = e.src ? code(e.src) : null;
  if (shared.size > 0) {
    const idx = indicesOf(source, [...shared.values()]);
    const lead =
      `${sub ? `${sub} picks` : 'Picked'} ${whichCells(source, idx)} of ${src}, as a new array ` +
      `${name} of shape ${shp(made.ndarray.shape)}.`;
    return {
      did: [lead, viewOrCopy(ctx, made, source, name, prefer) ?? ''],
      lead,
      concept: 'np-slice-view',
    };
  }
  // A boolean mask: a bool array of the same shape, by name, or a comparison written inline.
  const mask = arrayAt(ctx.pre, ctx.frame, e.index);
  if (
    mask &&
    mask.ndarray.dtype === 'bool' &&
    mask.ndarray.shape.join() === source.ndarray.shape.join()
  ) {
    const t = trueCells(mask);
    const lead =
      `Kept the elements of ${src} where ${code(exprText(e.index) ?? '?')} is ${code('True')}` +
      `${t && t.n > 0 ? ` (${t.where})` : ''}: ${name} is a new ndarray of shape ${shp(made.ndarray.shape)}.`;
    return {
      did: [lead, viewOrCopy(ctx, made, source, name, prefer) ?? ''],
      lead,
      concept: 'np-mask',
    };
  }
  if (e.index.type === 'compare') {
    const lead =
      `Kept the elements of ${src} where ${code(exprText(e.index) ?? '?')} is ${code('True')}: ` +
      `${count(made.ndarray.size, 'element')} of ${source.ndarray.size}, in a new ndarray ${name} of shape ${shp(made.ndarray.shape)}.`;
    return {
      did: [lead, viewOrCopy(ctx, made, source, name, prefer) ?? ''],
      lead,
      concept: 'np-mask',
    };
  }
  const lead = `${sub ?? 'The index'} made a new ndarray ${name} of shape ${shp(made.ndarray.shape)} from ${src}.`;
  return {
    did: [lead, viewOrCopy(ctx, made, source, name, prefer) ?? ''],
    lead,
    concept: 'np-copy',
  };
}

/** `a + b`, `m * 2`, `col + row`, `a > 2`: elementwise, with broadcasting when the shapes differ. */
function elementwise(
  ctx: NpCtx,
  e: PyExpr,
  target: string,
  made: ArrayBlock,
  inPlace: boolean,
  op?: string,
): NumpyDid | null {
  let left: Operand | null;
  let right: Operand | null;
  let symbol: string;
  if (inPlace) {
    left = { text: code(target), shape: made.ndarray.shape, array: made };
    right = operandOf(ctx, e);
    symbol = op ?? '?';
  } else if (e.type === 'binop') {
    left = operandOf(ctx, e.left);
    right = operandOf(ctx, e.right);
    symbol = e.op;
  } else if (e.type === 'compare' && e.ops.length === 1) {
    left = operandOf(ctx, e.left);
    right = operandOf(ctx, e.comparators[0]);
    symbol = e.ops[0];
  } else return null;
  if (!left || !right || (!left.array && !right.array)) return null;
  const result = made.ndarray.shape;
  const name = code(target);
  const did: string[] = [];
  let lead: string;
  let concept: ConceptKey;
  if (e.type === 'compare' && !inPlace) {
    lead = `Compared ${left.text} with ${right.text} element by element using ${code(symbol)}: ${name} is a new ${code(made.ndarray.dtype)} ndarray of shape ${shp(result)}.`;
    did.push(lead);
    const t = made.ndarray.dtype === 'bool' ? trueText(made) : null;
    if (t) did.push(`${name} is ${t}.`);
    concept = 'np-mask';
  } else {
    const words = ELEMENTWISE[symbol];
    if (!words) return null;
    const scalar = left.shape.length === 0 ? left : right.shape.length === 0 ? right : null;
    const still = `, in place: ${name} still refers to the same ndarray.`;
    const made_ = `: ${name} is a new ndarray of shape ${shp(result)}.`;
    if (scalar === right && SCALAR[symbol]) {
      lead = `${SCALAR[symbol](left.text, right.text)}${inPlace ? still : made_}`;
    } else if (scalar === left) {
      lead = `Worked out ${left.text} ${code(symbol)} x for each element x of ${right.text}${made_}`;
    } else {
      lead = `${words[0]} ${left.text} ${words[1]} ${right.text} element by element${inPlace ? still : made_}`;
    }
    did.push(lead);
    concept = 'np-elementwise';
  }
  const b = broadcastSentence(left, right, result);
  if (b) {
    did.push(b);
    concept = 'np-broadcast';
  }
  return { did, lead, concept };
}

/** `a.reshape(2, 3)` / `np.reshape(a, …)`, `a.T` / `a.transpose()` / `np.transpose(a)`, `a.copy()`. */
function restructure(
  ctx: NpCtx,
  kind: 'reshape' | 'transpose' | 'copy',
  source: ArrayBlock,
  target: string,
  made: ArrayBlock,
  prefer: ReadonlySet<string>,
): NumpyDid | null {
  const step = ctx.step;
  const src = arrayName(step, source, prefer);
  const name = code(target);
  const from = source.ndarray.shape;
  const to = made.ndarray.shape;
  if (made.ndarray.size !== source.ndarray.size) return null;
  let lead: string;
  let concept: ConceptKey;
  if (kind === 'reshape') {
    lead =
      `Reshaped ${src} from shape ${shp(from)} to ${shp(to)}: the same ${count(made.ndarray.size, 'value')} ` +
      `in the same order, filled in row by row.`;
    concept = 'np-reshape';
  } else if (kind === 'transpose') {
    lead = `Transposed ${src} from shape ${shp(from)} to ${shp(to)}: ${from.length === 2 ? 'row i becomes column i' : 'the order of the axes is reversed'}.`;
    concept = 'np-transpose';
  } else {
    if (!made.ndarray.ownsData) return null;
    lead = `Copied ${src} into a new ndarray ${name} with its own data: shape ${shp(to)}.`;
    concept = 'np-copy';
    return {
      did: [
        lead,
        `Changing ${name} won't change ${src}, and changing ${src} won't change ${name}.`,
      ],
      lead,
      concept,
    };
  }
  return { did: [lead, viewOrCopy(ctx, made, source, name, prefer) ?? ''], lead, concept };
}

/** `x[...] = v` into an array: which cells changed, and whether any other array saw it. */
function store(
  ctx: NpCtx,
  t: Extract<PyExpr, { type: 'subscript' }>,
  value: PyExpr | null,
  prefer: ReadonlySet<string>,
): NumpyDid | null {
  const { step, pre } = ctx;
  const target = arrayAt(step, ctx.frame, t.value);
  if (!target || !pre) return null;
  const before = pre.heap.find((b) => b.id === target.id);
  if (!isArray(before)) return null;
  const old = new Map(before.cells.map((c) => [c.id, c]));
  const changed = elementCells(target).filter((c) => {
    const was = old.get(c.id);
    return was && was.kind === 'scalar' && c.kind === 'scalar' && was.value !== c.value;
  });
  const name = arrayName(step, target, prefer);
  const v =
    value?.type === 'const'
      ? code(value.repr)
      : value
        ? exprText(value)
          ? code(exprText(value)!)
          : null
        : null;
  const where = whichCells(
    target,
    indicesOf(
      target,
      changed.map((c) => c.id),
    ),
  );
  let lead: string;
  const mask =
    t.index.type === 'compare' || arrayAt(pre, ctx.frame, t.index)?.ndarray.dtype === 'bool';
  if (changed.length === 0) {
    lead = `Stored ${v ?? 'the value'} in ${t.src ? code(t.src) : name}: no element's value changed (it already held that value).`;
    return { did: [lead], lead, concept: 'np-index' };
  }
  const fromTo =
    changed.length === 1
      ? ` (${code(scalarText(old.get(changed[0].id)!))} → ${code(scalarText(changed[0]))})`
      : '';
  if (mask) {
    lead =
      `Stored ${v ?? 'a value'} in the elements of ${name} where ${code(exprText(t.index) ?? '?')} is ${code('True')}: ` +
      `${where} changed${fromTo}.`;
  } else if (changed.length === 1 && t.src) {
    lead = `Stored ${v ?? code(scalarText(changed[0]))} in ${code(t.src)}: ${where} of ${name}${fromTo}.`;
  } else {
    lead = `Stored ${v ?? 'values'} in ${where} of ${name}.`;
  }
  const effects = writeEffects(
    ctx,
    target,
    changed.map((c) => c.id),
    prefer,
  );
  const through = effects.some((s) => s.includes('changed too'));
  return {
    did: [lead, ...effects],
    lead,
    concept: through ? 'np-view-write' : mask ? 'np-mask' : 'np-index',
  };
}

/**
 * The NumPy reading of the statement a step ran, or null when it isn't a NumPy statement this file
 * knows (the generic Phase 32 text applies then). Only for a line that finished in this step.
 */
export function numpyStatement(ctx: NpCtx, stmt: PyStatement | null): NumpyDid | null {
  if (!stmt || !ctx.complete || ctx.resumed || !ctx.pre) return null;
  const prefer = new Set<string>();
  const visit = (e: PyExpr | undefined) => {
    if (!e) return;
    if (e.type === 'name') prefer.add(e.id);
    else if (e.type === 'subscript' || e.type === 'attribute') visit(e.value);
    else if (e.type === 'binop') {
      visit(e.left);
      visit(e.right);
    } else if (e.type === 'compare') {
      visit(e.left);
      e.comparators.forEach(visit);
    } else if (e.type === 'call') {
      visit(e.func);
      e.args.forEach(visit);
    }
  };

  if (stmt.kind === 'AugAssign') {
    if (stmt.target.type !== 'name') return null;
    visit(stmt.target);
    visit(stmt.value);
    const made = arrayAt(ctx.step, ctx.frame, stmt.target);
    const was = arrayAt(ctx.pre, ctx.frame, stmt.target);
    if (!made || !was || made.id !== was.id) return null;
    const ew = elementwise(ctx, stmt.value, stmt.target.id, made, true, stmt.op);
    if (!ew) return null;
    const changed = elementCells(made)
      .filter((c) => {
        const old = was.cells.find((x) => x.id === c.id);
        return old && old.kind === 'scalar' && c.kind === 'scalar' && old.value !== c.value;
      })
      .map((c) => c.id);
    const effects = writeEffects(ctx, made, changed, prefer).filter((s) =>
      s.includes('changed too'),
    );
    return {
      ...ew,
      did: [...ew.did, ...effects],
      concept: effects.length > 0 ? 'np-view-write' : ew.concept,
    };
  }

  if (stmt.kind !== 'Assign' || stmt.targets.length !== 1) return null;
  const t = stmt.targets[0];
  const v = stmt.value;
  visit(v);
  visit(t);

  if (t.type === 'subscript')
    return arrayAt(ctx.pre, ctx.frame, t.value) ? store(ctx, t, v, prefer) : null;

  if (t.type === 'attribute' && t.attr === 'shape') {
    const arr = arrayAt(ctx.step, ctx.frame, t.value);
    const was = arrayAt(ctx.pre, ctx.frame, t.value);
    if (!arr || !was || arr.id !== was.id || arr.ndarray.shape.join() === was.ndarray.shape.join())
      return null;
    const name = arrayName(ctx.step, arr, prefer);
    const lead =
      `Changed the shape of ${name} in place, from ${shp(was.ndarray.shape)} to ${shp(arr.ndarray.shape)}: ` +
      `the same ${count(arr.ndarray.size, 'value')}, still in the same order in memory.`;
    return {
      did: [
        lead,
        `${name} is still the same ndarray; only how its values are laid out in rows changed.`,
      ],
      lead,
      concept: 'np-reshape',
    };
  }

  if (t.type !== 'name') return null;
  const stored = lookupName(ctx.step, ctx.frame, t.id);
  if (!stored) return null;
  const made = targetBlock(ctx.step, stored);
  const madeArr = isArray(made) ? made : null;
  // Only a new array (or a NumPy scalar) is explained here; `b = a` stays the generic aliasing text.
  if (madeArr && ctx.pre.heap.some((b) => b.id === madeArr.id)) return null;
  if (!madeArr && npDtype(stored) === null) return null;

  if (v.type === 'call') {
    const fn = numpyFunction(ctx, v);
    if (fn !== null) {
      const first = arrayAt(ctx.pre, ctx.frame, v.args[0]);
      if (first && AGGREGATES[fn]) return aggregate(ctx, fn, first, v, 1, t.id, stored, prefer);
      if (!madeArr) return null;
      if (first && fn === 'reshape')
        return restructure(ctx, 'reshape', first, t.id, madeArr, prefer);
      if (first && fn === 'transpose')
        return restructure(ctx, 'transpose', first, t.id, madeArr, prefer);
      if (first && fn === 'copy') return restructure(ctx, 'copy', first, t.id, madeArr, prefer);
      return creation(ctx, fn, v, t.id, madeArr);
    }
    if (v.func.type === 'attribute') {
      const owner = arrayAt(ctx.pre, ctx.frame, v.func.value);
      if (!owner) return null;
      const m = v.func.attr;
      if (AGGREGATES[m]) return aggregate(ctx, m, owner, v, 0, t.id, stored, prefer);
      if (!madeArr) return null;
      if (m === 'reshape') return restructure(ctx, 'reshape', owner, t.id, madeArr, prefer);
      if (m === 'transpose') return restructure(ctx, 'transpose', owner, t.id, madeArr, prefer);
      if (m === 'copy') return restructure(ctx, 'copy', owner, t.id, madeArr, prefer);
    }
    return null;
  }
  if (v.type === 'attribute' && v.attr === 'T') {
    const owner = arrayAt(ctx.pre, ctx.frame, v.value);
    return owner && madeArr ? restructure(ctx, 'transpose', owner, t.id, madeArr, prefer) : null;
  }
  if (v.type === 'subscript') {
    const source = arrayAt(ctx.pre, ctx.frame, v.value);
    if (!source) return null;
    if (!madeArr) return elementRead(ctx, source, v.index, t.id, stored, prefer);
    return subscriptArray(ctx, source, v, t.id, madeArr, prefer);
  }
  if ((v.type === 'binop' || v.type === 'compare') && madeArr)
    return elementwise(ctx, v, t.id, madeArr, false);
  return null;
}
