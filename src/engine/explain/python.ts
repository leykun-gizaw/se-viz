/**
 * Derived explanations for Python steps (Phase 32), from the recorder's statement facts
 * ({@link Trace.statements}, {@link Step.py}) and the recorded states. Deterministic templates only.
 *
 * The rule throughout: say only what the trace shows. A value is quoted only when it was read from a
 * snapshot (a name, `d[k]`, `obj.attr`, a constant, or the value a line stored); nothing is computed
 * here. When a line paused for a call, raised, or is still running (a comprehension), only what is
 * certain is said. Anything else is left out.
 *
 * @packageDocumentation
 */
import { isArray, shapeText } from '../trace/ndarray.ts';
import {
  derivedTables,
  displayText,
  isGroupBy,
  isTable,
  shapeWords,
  thousands,
} from '../trace/pandas.ts';
import { diffObjects, type PyEvent } from '../trace/objectDiff.ts';
import type {
  Cell,
  PyExpr,
  PyStatement,
  StackFrame,
  Step,
  StepCondition,
  Trace,
} from '../trace/types.ts';
import { GLOSSARY, type ConceptKey } from './glossary.ts';
import {
  afterRaise,
  analyze,
  article,
  blockIn,
  exprText,
  frameIn,
  functionName,
  inRange,
  kindWord,
  lineOf,
  lookupName,
  namesFor,
  objectPaths,
  readExpr,
  slotPath,
  statementOf,
  targetBlock,
  targetPath,
  topFrame,
  valueText,
  type PyAnalysis,
  type Read,
} from './pyState.ts';
import { registerPythonDeriver } from './derive.ts';
import { numpyStatement, type NumpyDid } from './numpy.ts';
import { pandasStatement } from './pandas.ts';
import { capitalize, code, count, isAre, lineRange, plain, sentences } from './text.ts';
import { emptyDerived, type ChangeRow, type DerivedExplanation } from './types.ts';

/** Everything the templates need about one step. */
interface Ctx {
  trace: Trace;
  k: number;
  step: Step;
  /** The step before (its state is this line's pre-state), or `null` at the first step. */
  prev: Step | null;
  a: PyAnalysis;
  /** The frame the highlighted line ran in. */
  frame: string | null;
  stmt: PyStatement | null;
  line: number;
  complete: boolean;
  /** The line is continuing after a call it made returned (the previous step was that return). */
  resumed: boolean;
  /** Where the line's reads come from: the state before the line started, or `null`. */
  pre: Step | null;
  /**
   * On a resumed line, the one call in the statement and the value it gave back — only when the
   * statement makes exactly one call and it is the function that just returned.
   */
  callResult: { call: PyExpr; cell: Cell } | null;
}

/** The call nodes in an expression. */
function callsIn(e: PyExpr | undefined, out: PyExpr[] = []): PyExpr[] {
  if (!e) return out;
  switch (e.type) {
    case 'call':
      out.push(e);
      callsIn(e.func, out);
      e.args.forEach((x) => callsIn(x, out));
      break;
    case 'subscript':
      callsIn(e.value, out);
      callsIn(e.index, out);
      break;
    case 'attribute':
      callsIn(e.value, out);
      break;
    case 'binop':
      callsIn(e.left, out);
      callsIn(e.right, out);
      break;
    case 'unary':
      callsIn(e.operand, out);
      break;
    case 'compare':
      callsIn(e.left, out);
      e.comparators.forEach((x) => callsIn(x, out));
      break;
    case 'boolop':
      e.values.forEach((x) => callsIn(x, out));
      break;
    case 'display':
      (e.items ?? []).forEach((x) => callsIn(x, out));
      break;
    default:
      break;
  }
  return out;
}

/** The expressions a statement evaluates (its value, test, iterable, and target sub-expressions). */
function statementExprs(stmt: PyStatement): PyExpr[] {
  switch (stmt.kind) {
    case 'Assign':
      return [stmt.value, ...stmt.targets];
    case 'AugAssign':
      return [stmt.target, stmt.value];
    case 'AnnAssign':
      return stmt.value ? [stmt.value, stmt.target] : [stmt.target];
    case 'If':
    case 'Elif':
    case 'While':
    case 'Assert':
      return [stmt.test];
    case 'For':
      return [stmt.iter];
    case 'Return':
    case 'Raise':
      return stmt.value ? [stmt.value] : [];
    case 'Expr':
      return [stmt.value];
    default:
      return [];
  }
}

/** Every name a statement's expressions mention. */
function namesIn(stmt: PyStatement | null): Set<string> {
  const out = new Set<string>();
  const visit = (e: PyExpr | undefined): void => {
    if (!e) return;
    switch (e.type) {
      case 'name':
        out.add(e.id);
        return;
      case 'subscript':
        visit(e.value);
        visit(e.index);
        return;
      case 'attribute':
        visit(e.value);
        return;
      case 'binop':
        visit(e.left);
        visit(e.right);
        return;
      case 'unary':
        visit(e.operand);
        return;
      case 'compare':
        visit(e.left);
        e.comparators.forEach(visit);
        return;
      case 'boolop':
        e.values.forEach(visit);
        return;
      case 'call':
        visit(e.func);
        e.args.forEach(visit);
        return;
      case 'display':
        (e.items ?? []).forEach(visit);
        return;
      default:
        return;
    }
  };
  if (stmt && stmt.kind !== 'Multiple') {
    statementExprs(stmt).forEach(visit);
    if (stmt.kind === 'For') visit(stmt.target);
  }
  return out;
}

/** Whether a call expression names the function `name` (`f(…)` or `obj.f(…)`). */
function callsFunction(call: PyExpr, name: string): boolean {
  if (call.type !== 'call') return false;
  return (
    (call.func.type === 'name' && call.func.id === name) ||
    (call.func.type === 'attribute' && call.func.attr === name)
  );
}

/** The sentence for the program's last step. */
export const PROGRAM_END = 'The program has finished.';

const BOOL_OPS = new Set(['==', '!=', '<', '<=', '>', '>=', 'is', 'is not', 'in', 'not in']);

/* ───────────────────────── reading ───────────────────────── */

/**
 * The state before a resumed line started: walk back over the call it made (and anything that call
 * did) to the step just before it. `null` if that can't be found.
 */
function lineStart(trace: Trace, a: PyAnalysis, k: number, frame: string | null): Step | null {
  let j = k - 1;
  while (j > 0 && topFrame(trace.steps[j - 1])?.id !== frame) j--;
  const call = trace.steps[j];
  if (j < 1 || call.py?.event !== 'call' || a.ran[j] !== frame) return null;
  if (lineOf(call) !== lineOf(trace.steps[k])) return null;
  return trace.steps[j - 1];
}

function sameValue(a: Cell, b: Cell): boolean {
  if (a.kind === 'scalar' && b.kind === 'scalar') return a.value === b.value;
  if (a.kind === 'pointer' && b.kind === 'pointer') return a.target === b.target;
  return false;
}

/**
 * What an expression held when the line read it. On a resumed line, only values that are the same
 * before the line started and now count (a call in between could have changed them).
 */
function read(ctx: Ctx, e: PyExpr): Read | null {
  if (!ctx.pre) return null;
  const before = readExpr(ctx.pre, ctx.frame, e);
  if (!ctx.resumed || !before) return before;
  const now = readExpr(ctx.step, ctx.frame, e);
  return now && sameValue(before.cell, now.cell) ? now : null;
}

/** `` `'corn'` `` for a primitive; "a list" for a reference. */
function valuePhrase(step: Step, cell: Cell): string {
  if (cell.kind === 'scalar') return code(cell.value === null ? '?' : String(cell.value));
  const block = targetBlock(step, cell);
  return block ? article(kindWord(block)) : 'an object';
}

/** The code of an expression, or `null` when its text wasn't kept. */
function codeOf(e: PyExpr | undefined): string | null {
  const t = e ? exprText(e) : null;
  return t === null ? null : code(t);
}

/** The frame a cell lives in, for a name: what the line just bound. */
function nameCell(step: Step, frame: string | null, name: string): Cell | null {
  return lookupName(step, frame, name);
}

/** Lookups and reads, in the order Python evaluates them (short-circuiting operators: first operand). */
function evaluation(ctx: Ctx, e: PyExpr | undefined, out: string[]): void {
  if (!e) return;
  switch (e.type) {
    case 'name': {
      const r = read(ctx, e);
      if (r?.cell.kind === 'scalar')
        out.push(`Looked up ${code(e.id)}: ${valuePhrase(ctx.step, r.cell)}.`);
      return;
    }
    case 'subscript':
    case 'attribute': {
      evaluation(ctx, e.value, out);
      if (e.type === 'subscript') evaluation(ctx, e.index, out);
      const r = read(ctx, e);
      if (r) out.push(`Read ${code(r.path)}: ${valuePhrase(ctx.pre ?? ctx.step, r.cell)}.`);
      return;
    }
    case 'binop':
      evaluation(ctx, e.left, out);
      evaluation(ctx, e.right, out);
      return;
    case 'unary':
      evaluation(ctx, e.operand, out);
      return;
    case 'compare':
      evaluation(ctx, e.left, out);
      evaluation(ctx, e.comparators[0], out);
      return;
    case 'boolop':
      evaluation(ctx, e.values[0], out);
      return;
    case 'call':
      if (e.func.type === 'attribute') evaluation(ctx, e.func.value, out);
      for (const arg of e.args) evaluation(ctx, arg, out);
      // A call that ran in this step without a traced frame: a builtin or library function.
      if (!ctx.resumed && e.src) out.push(`Called ${code(e.src)}.`);
      return;
    case 'display':
      for (const item of e.items ?? []) evaluation(ctx, item, out);
      return;
    default:
      return;
  }
}

const VERBS: Record<string, [number: string, text?: string]> = {
  '+': ['Added', 'Joined'],
  '-': ['Subtracted'],
  '*': ['Multiplied by'],
  '/': ['Divided by'],
  '//': ['Divided (rounding down) by'],
  '%': ['Took the remainder after dividing by'],
  '**': ['Raised it to the power'],
};

/** How an operand reads in a sentence: `` `10` ``, or `` `bonus` (`10`) ``. */
function operand(ctx: Ctx, e: PyExpr): string | null {
  if (e.type === 'const') return code(e.repr);
  if (ctx.callResult?.call === e && e.src) {
    return `${code(e.src)} (${valuePhrase(ctx.prev ?? ctx.step, ctx.callResult.cell)})`;
  }
  const r = read(ctx, e);
  const t = exprText(e);
  if (r?.cell.kind === 'scalar' && t !== null)
    return `${code(t)} (${valuePhrase(ctx.step, r.cell)})`;
  return t === null ? null : code(t);
}

const isSimple = (e: PyExpr) =>
  e.type === 'name' || e.type === 'const' || e.type === 'subscript' || e.type === 'attribute';

/**
 * The sentence for the operation at the top of an expression whose result the line stored or
 * returned (`result` is that stored value, read from the state after the line).
 */
function operation(ctx: Ctx, e: PyExpr, result: Cell | null): string | null {
  if (!result || result.kind !== 'scalar' || result.value === null) return null;
  const value = code(String(result.value));
  if (e.type === 'binop') {
    const verbs = VERBS[e.op];
    const right = operand(ctx, e.right);
    const isText = result.type === 'str';
    const number = result.type === 'int' || result.type === 'float';
    // The verb form ("Added `1`, giving `2`") only when the left operand's value was shown.
    const left = e.left.type === 'const' || read(ctx, e.left)?.cell.kind === 'scalar';
    if (verbs && right && isSimple(e.left) && left && (number || (isText && verbs[1]))) {
      return isText
        ? `${verbs[1]} ${right} onto it, giving ${value}.`
        : `${verbs[0]} ${right}, giving ${value}.`;
    }
  }
  // A negative literal (`-1`) is a value, not a computation.
  if (e.type === 'unary' && e.operand.type === 'const') return null;
  if (e.type === 'binop' || e.type === 'compare' || e.type === 'boolop' || e.type === 'unary') {
    return e.src ? `Computed ${code(e.src)}: ${value}.` : null;
  }
  return null;
}

/* ───────────────────────── labels ───────────────────────── */

/** `factorial(3)`, `add_crop(basket, 'wheat')`, `Tractor.__init__(…, 'Red', 100)`: the call as made. */
function callLabel(trace: Trace, a: PyAnalysis, frameId: string): string {
  const at = a.pushedAt.get(frameId);
  const callStep = at === undefined ? undefined : trace.steps[at];
  const frame = callStep ? frameIn(callStep, frameId) : undefined;
  if (!callStep || !frame) return code(frameId);
  const info = topFrame(callStep)?.id === frameId ? callStep.py?.call : undefined;
  if (frame.name === '<module>') return 'the program';
  if (info?.scope === 'class') return `the body of class ${code(functionName(info.function))}`;
  if (info?.scope === 'comprehension') return 'the generator expression';
  const name = info ? functionName(info.function) : frame.name;
  const caller = callStep.stack[callStep.stack.length - 2];
  const params = info?.params ?? frame.variables.map((v) => v.name);
  const args = params.map((p) => {
    const cell = frame.variables.find((v) => v.name === p);
    if (cell?.kind === 'scalar') return String(cell.value);
    if (cell?.kind === 'pointer' && caller) {
      const same = caller.variables.filter((v) => v.kind === 'pointer' && v.target === cell.target);
      if (same.length === 1) return same[0].name;
    }
    return '…';
  });
  return code(`${info?.scope === 'lambda' ? 'lambda' : name}(${args.join(', ')})`);
}

/** How a frame was entered (from its call step): a function, generator, class body, … */
function scopeOf(ctx: Ctx, frameId: string): string | undefined {
  const at = ctx.a.pushedAt.get(frameId);
  const s = at === undefined ? undefined : ctx.trace.steps[at];
  return s && topFrame(s)?.id === frameId ? s.py?.call?.scope : undefined;
}

const isGenerator = (scope: string | undefined) =>
  scope === 'generator' || scope === 'comprehension';

/** The value a frame returned, from its `return` cell in `step`. */
function returned(step: Step, frameId: string): Cell | undefined {
  return frameIn(step, frameId)?.variables.find((v) => v.name === 'return');
}

/** The name a frame shows in a row: `x` in the current frame, else `x` in its frame's label. */
function nameLabel(ctx: Ctx, step: Step, frame: StackFrame, name: string): string {
  if (name === 'return') {
    // A generator's `return` cell holds the value it yielded while it is paused at a `yield`.
    const yielded = step.py?.yielded && topFrame(step)?.id === frame.id;
    return `${yielded ? 'Value yielded by' : 'Return value of'} ${callLabel(ctx.trace, ctx.a, frame.id)}`;
  }
  if (frame.id === topFrame(step)?.id) return code(name);
  const owner =
    frame.name === '<module>' ? 'the global frame' : callLabel(ctx.trace, ctx.a, frame.id);
  return `${code(name)} in ${owner}`;
}

/* ───────────────────────── "What this step did" ───────────────────────── */

/** The sentence for one assignment target, after the line stored into it. */
function store(ctx: Ctx, t: PyExpr, opts: { aug?: boolean; from?: PyExpr } = {}): string | null {
  const { step, frame, prev } = ctx;
  // Whether an object is new to this line: compare with the state before the line started.
  const base = ctx.resumed ? ctx.pre : prev;
  if (t.type === 'name') {
    const cell = nameCell(step, frame, t.id);
    if (!cell) return null;
    if (cell.kind === 'scalar') {
      return opts.aug
        ? `Stored ${valuePhrase(step, cell)} back in ${code(t.id)}.`
        : `Set ${code(t.id)} to ${valuePhrase(step, cell)}.`;
    }
    const block = targetBlock(step, cell);
    if (cell.kind !== 'pointer' || !block) return null;
    const kind = kindWord(block);
    const was = prev ? nameCell(prev, frame, t.id) : null;
    if (opts.aug && was?.kind === 'pointer' && was.target === cell.target) {
      return `Changed the ${kind} in place: ${code(t.id)} still refers to the same ${kind}.`;
    }
    if ((base === null && ctx.k === 0) || (base !== null && !blockIn(base, block.id))) {
      return `${code(t.id)} now refers to a new ${kind}.`;
    }
    const from = opts.from && exprText(opts.from);
    if (opts.from && from && opts.from.type !== 'call') {
      const source = readExpr(step, frame, opts.from);
      if (source?.cell.kind === 'pointer' && source.cell.target === cell.target) {
        return `${code(t.id)} now refers to the same ${kind} as ${code(from)}.`;
      }
    }
    const others = namesFor(step, block.id).filter((n) => n.name !== t.id);
    if (others.length > 0 && others.every((n) => n.frame.id === frame)) {
      return `${code(t.id)} now refers to the same ${kind} as ${others.map((n) => code(n.name)).join(' and ')}.`;
    }
    return `${code(t.id)} now refers to ${article(kind)}.`;
  }
  if (t.type === 'subscript' || t.type === 'attribute') {
    const path = targetPath(step, frame, t);
    const now = readExpr(step, frame, t);
    if (path === null || !now) return null;
    const value = valuePhrase(step, now.cell);
    const before = prev ? readExpr(prev, frame, t) : null;
    if (t.type === 'subscript') {
      const container = readExpr(step, frame, t.value);
      const block = container ? targetBlock(step, container.cell) : undefined;
      const key = readExpr(step, frame, t.index);
      if (
        block?.objectKind === 'dict' &&
        !before &&
        container &&
        key?.cell.kind === 'scalar' &&
        prev
      ) {
        return `Added the key ${code(String(key.cell.value))} to ${code(container.path)}, with the value ${value}.`;
      }
    } else if (!before && prev) {
      return `Set ${code(path)} to ${value} (a new attribute).`;
    }
    if (t.type === 'attribute') return `Set ${code(path)} to ${value}.`;
    return opts.aug
      ? `Stored ${value} back in ${code(path)}.`
      : `Stored ${value} in ${code(path)}.`;
  }
  if (t.type === 'display' && t.items && t.items.every((i) => i.type === 'name')) {
    const parts = t.items.map((i) => {
      const cell = i.type === 'name' ? nameCell(step, frame, i.id) : null;
      return cell && i.type === 'name' ? `${code(i.id)} is now ${valuePhrase(step, cell)}` : null;
    });
    if (parts.some((p) => p === null)) return null;
    return `Unpacked the values: ${parts.join(', ')}.`;
  }
  return null;
}

/** The value a single, simple assignment target holds after the line. */
function storedValue(ctx: Ctx, t: PyExpr | undefined): Cell | null {
  if (!t) return null;
  return readExpr(ctx.step, ctx.frame, t)?.cell ?? null;
}

/** Whether the line ran in the body frame of the class `name` (pushed by its `class` statement). */
function inClassBody(ctx: Ctx, name: string): boolean {
  const at = ctx.frame === null ? undefined : ctx.a.pushedAt.get(ctx.frame);
  const call = at === undefined ? undefined : ctx.trace.steps[at].py?.call;
  return call?.scope === 'class' && functionName(call.function) === name;
}

/** "Got `1` back from `factorial(n - 1)`" for the call a resumed line was waiting on. */
function gotBack(ctx: Ctx): string | null {
  const prev = ctx.prev;
  if (!prev || !ctx.resumed) return null;
  const callee = topFrame(prev);
  if (!callee || callee.id === ctx.frame) return null;
  const label = callLabel(ctx.trace, ctx.a, callee.id);
  if (prev.py?.yielded) {
    const v = returned(prev, callee.id);
    return v ? `${capitalize(label)} yielded ${valuePhrase(prev, v)}.` : null;
  }
  if (prev.py?.unwinding) return null;
  if (isGenerator(scopeOf(ctx, callee.id)))
    return `${capitalize(label)} finished: it has no more values.`;
  const v = returned(prev, callee.id);
  // `__init__` always gives back None; the call `Tractor(…)` itself gives back the new object.
  if (v && callee.name === '__init__')
    return `${capitalize(label)} finished setting up the new object.`;
  return v ? `Got ${valuePhrase(prev, v)} back from ${label}.` : null;
}

/** The test's result as the branch went: `true` when the body (or loop body) runs next. */
function testResult(ctx: Ctx): boolean | null {
  const { stmt, step } = ctx;
  if (!ctx.complete || !step.py || !stmt) return null;
  if (stmt.kind !== 'If' && stmt.kind !== 'Elif' && stmt.kind !== 'While') return null;
  // The frame returned straight after the test: the body didn't run, and nothing followed.
  if (step.py.event === 'return') return false;
  if (inRange(step.py.at, stmt.body)) return true;
  // Anything else means the test was false: an elif / else clause, or the line after the statement.
  return step.py.at < stmt.body.first || step.py.at > stmt.body.last ? false : null;
}

/**
 * "is `False`" for a test whose value is a bool (a comparison, `not …`); "counts as true" for any
 * other value, whose truthiness decided the branch (`if counts:`, `a or b`).
 */
function resultWords(test: PyExpr, result: boolean): string {
  const isBool =
    (test.type === 'compare' && test.ops.every((o) => BOOL_OPS.has(o))) ||
    (test.type === 'unary' && test.op === 'not') ||
    (test.type === 'const' && (test.repr === 'True' || test.repr === 'False'));
  return isBool
    ? `is ${code(result ? 'True' : 'False')}`
    : `counts as ${result ? 'true' : 'false'}`;
}

/** "`crop in counts` is `False`"; a constant test (`while True:`) is "always" so. */
function conditionPhrase(test: PyExpr, result: boolean): string {
  if (test.type === 'const') {
    const truth =
      test.repr === 'True' || test.repr === 'False' ? code(test.repr) : result ? 'true' : 'false';
    return `the condition ${code(test.repr)} is always ${truth}`;
  }
  return `${codeOf(test) ?? 'the condition'} ${resultWords(test, result)}`;
}

function forDid(ctx: Ctx, stmt: Extract<PyStatement, { kind: 'For' }>): string[] {
  const pass = ctx.a.loops[ctx.k];
  if (!pass) return [];
  const from = codeOf(stmt.iter) ?? 'the sequence';
  if (!pass.entered) {
    return [
      pass.iteration === 0
        ? `${capitalize(from)} gave no items, so the loop body doesn't run.`
        : `There are no items left in ${from}, so the loop is done.`,
    ];
  }
  const which = pass.iteration === 1 ? 'first' : 'next';
  const bound = loopBinding(ctx, stmt.target);
  return [
    bound
      ? `Took the ${which} item from ${from}: ${bound}.`
      : `Took the ${which} item from ${from}.`,
  ];
}

/** "`crop` is now `'corn'`" (or every name of `for k, v in …`), read after the step. */
function loopBinding(ctx: Ctx, target: PyExpr): string | null {
  const names =
    target.type === 'name' ? [target] : target.type === 'display' ? (target.items ?? []) : [];
  if (names.length === 0) return null;
  const parts: string[] = [];
  for (const n of names) {
    if (n.type !== 'name') return null;
    const cell = nameCell(ctx.step, ctx.frame, n.id);
    if (!cell) return null;
    parts.push(`${code(n.id)} is now ${valuePhrase(ctx.step, cell)}`);
  }
  return parts.join(' and ');
}

/** The output lines this step added (stdout is cumulative), unless they are a traceback. */
function printed(ctx: Ctx): string[] {
  if (ctx.step.py?.ending === 'uncaught') return [];
  const before = ctx.prev?.stdout ?? [];
  const after = ctx.step.stdout ?? [];
  if (after.length <= before.length || !before.every((l, i) => l === after[i])) return [];
  return after.slice(before.length);
}

/**
 * The library reading of the step's statement, once per step: pandas (Phase 35) first, then NumPy
 * (Phase 34). Each returns null for a line that isn't about its objects.
 */
const numpyCache = new WeakMap<Step, NumpyDid | null>();
function numpyFor(ctx: Ctx): NumpyDid | null {
  let hit = numpyCache.get(ctx.step);
  if (hit === undefined) {
    hit = ctx.stmt ? (pandasStatement(ctx, ctx.stmt) ?? numpyStatement(ctx, ctx.stmt)) : null;
    numpyCache.set(ctx.step, hit);
  }
  return hit;
}

function statementDid(ctx: Ctx, stmt: PyStatement): string[] {
  const out: string[] = [];
  const np = numpyFor(ctx);
  if (np) return np.did;
  switch (stmt.kind) {
    case 'Assign': {
      evaluation(ctx, stmt.value, out);
      const single = stmt.targets.length === 1 ? stmt.targets[0] : undefined;
      // A lookup of the target's own key comes after the value is worked out.
      if (single?.type === 'subscript') evaluation(ctx, single.index, out);
      out.push(operation(ctx, stmt.value, storedValue(ctx, single)) ?? '');
      for (const t of stmt.targets) out.push(store(ctx, t, { from: stmt.value }) ?? '');
      return out;
    }
    case 'AugAssign': {
      const t = stmt.target;
      // `x[k] op= v`: the container and key, then the current value, then the right-hand side.
      if (t.type === 'subscript') {
        evaluation(ctx, t.value, out);
        evaluation(ctx, t.index, out);
      } else if (t.type === 'attribute') evaluation(ctx, t.value, out);
      const current = read(ctx, t);
      if (current && current.cell.kind === 'scalar') {
        out.push(`Read ${code(current.path)}: ${valuePhrase(ctx.step, current.cell)}.`);
      }
      evaluation(ctx, stmt.value, out);
      const after = storedValue(ctx, t);
      if (current?.cell.kind === 'scalar' && after) {
        const op: PyExpr = { type: 'binop', op: stmt.op, left: t, right: stmt.value };
        out.push(operation(ctx, op, after) ?? '');
      }
      out.push(store(ctx, t, { aug: true }) ?? '');
      return out;
    }
    case 'AnnAssign':
      if (!stmt.value) {
        const t = codeOf(stmt.target);
        return [
          t && stmt.annotation
            ? `Annotated ${t} as ${code(stmt.annotation)}; no value is stored.`
            : '',
        ];
      }
      evaluation(ctx, stmt.value, out);
      out.push(operation(ctx, stmt.value, storedValue(ctx, stmt.target)) ?? '');
      out.push(store(ctx, stmt.target, { from: stmt.value }) ?? '');
      return out;
    case 'If':
    case 'Elif':
    case 'While': {
      evaluation(ctx, stmt.test, out);
      const r = testResult(ctx);
      const t = codeOf(stmt.test);
      // A constant test (`while True:`) has nothing to check; "Branch taken" says what it means.
      if (stmt.test.type === 'const') return out;
      if (t && r !== null) out.push(`Checked ${t}: it ${resultWords(stmt.test, r)}.`);
      else if (t) out.push(`Checked ${t}.`);
      return out;
    }
    case 'For':
      return forDid(ctx, stmt);
    case 'Return': {
      const frame = topFrame(ctx.step);
      if (!frame || ctx.step.py?.event !== 'return') return [];
      evaluation(ctx, stmt.value, out);
      const v = returned(ctx.step, frame.id);
      if (stmt.value) out.push(operation(ctx, stmt.value, v ?? null) ?? '');
      return out;
    }
    case 'Expr': {
      if (stmt.value.type === 'call') {
        evaluation(ctx, stmt.value, out);
        const lines = printed(ctx);
        if (lines.length === 1) out.push(`Printed ${code(lines[0])}.`);
        else if (lines.length > 1) out.push(`Printed ${count(lines.length, 'line')}.`);
        return out;
      }
      if (stmt.value.type === 'yield') return [];
      const t = codeOf(stmt.value);
      return [t ? `Evaluated ${t}; the result is not stored.` : ''];
    }
    case 'Import':
      return [
        stmt.module
          ? `Imported ${stmt.names.map(code).join(', ')} from ${code(stmt.module)}.`
          : `Imported ${stmt.names.map(code).join(', ')}.`,
      ];
    case 'FunctionDef':
      return [
        `Defined the function ${code(`${stmt.name}(${stmt.params.join(', ')})`)}; its body runs only when it is called.`,
      ];
    case 'ClassDef':
      if (ctx.resumed)
        return [
          `Created the class ${code(stmt.name)}: the name ${code(stmt.name)} now refers to it.`,
        ];
      // The class body's own first line event, on the `class` line.
      return inClassBody(ctx, stmt.name) ? [`The body of class ${code(stmt.name)} begins.`] : [];
    case 'Try':
      return [`Entered the ${code('try')} block (${lineRange(stmt.body.first, stmt.body.last)}).`];
    case 'Except': {
      const caught = inRange(ctx.step.py?.at ?? 0, stmt.body);
      const what = stmt.type ? code(stmt.type) : null;
      if (!what)
        return caught
          ? [`A bare ${code('except:')} catches any exception, so this handler runs.`]
          : [];
      out.push(
        caught
          ? `Checked whether the exception matches ${what}: it does, so this handler runs.`
          : `Checked whether the exception matches ${what}: it doesn't, so this handler is skipped.`,
      );
      if (caught && stmt.name) {
        const cell = nameCell(ctx.step, ctx.frame, stmt.name);
        if (cell) out.push(`${code(stmt.name)} now refers to the exception.`);
      }
      return out;
    }
    case 'Pass':
      return [`Did nothing: ${code('pass')} is a placeholder.`];
    case 'Break':
      return [
        `${code('break')} left the loop; Python continues at line ${ctx.step.py?.at ?? '?'}.`,
      ];
    case 'Continue':
      return [
        `${code('continue')} skipped the rest of this pass; the loop goes on from line ${ctx.step.py?.at ?? '?'}.`,
      ];
    case 'With':
      // The `with` line runs twice: entering the block, and again leaving it (its `__exit__`).
      return inRange(ctx.step.py?.at ?? 0, stmt.body)
        ? [`Entered the ${code('with')} block (${lineRange(stmt.body.first, stmt.body.last)}).`]
        : [`Left the ${code('with')} block.`];
    case 'Delete':
      return stmt.targets.map((t) =>
        t.type === 'name' && !nameCell(ctx.step, ctx.frame, t.id)
          ? `Deleted the name ${code(t.id)}.`
          : '',
      );
    case 'Global':
    case 'Nonlocal':
      return [
        `Declared ${stmt.names.map(code).join(', ')} as ${stmt.kind === 'Global' ? 'global' : 'nonlocal'} for this function.`,
      ];
    case 'Assert': {
      const t = codeOf(stmt.test);
      return [t ? `Checked ${t}: it holds, so nothing happens.` : ''];
    }
    default:
      return [];
  }
}

/** Why the program, or a function, is ending now (a `return` event). */
function ending(ctx: Ctx, stmt: PyStatement | null): string[] {
  const frame = topFrame(ctx.step);
  const py = ctx.step.py;
  if (!frame || py?.event !== 'return') return [];
  if (frame.name === '<module>') return [PROGRAM_END];
  const label = callLabel(ctx.trace, ctx.a, frame.id);
  if (frame.variables.every((v) => v.name !== 'return')) {
    // A class body has no return value.
    return [`${capitalize(label)} is done.`];
  }
  const v = returned(ctx.step, frame.id);
  if (!v) return [];
  if (stmt?.kind !== 'Return')
    return [`${capitalize(label)} reached its end, so it returns ${valuePhrase(ctx.step, v)}.`];
  return [`${capitalize(label)} returns ${valuePhrase(ctx.step, v)}.`];
}

function didApply(ctx: Ctx): string[] {
  const { step, stmt } = ctx;
  const py = step.py;
  if (!py || py.ending) return [];
  if (py.event === 'call') {
    const callee = topFrame(step);
    if (!callee) return [];
    const label = callLabel(ctx.trace, ctx.a, callee.id);
    if (py.call?.scope === 'class') {
      return [
        `Line ${ctx.line} starts ${label}: Python runs the class body first, then makes the class.`,
      ];
    }
    if (py.call?.resumed) return [`${capitalize(label)} resumes after its last ${code('yield')}.`];
    if (isGenerator(py.call?.scope)) {
      return [
        `Started ${label}: it runs until it yields its first value.`,
        `Line ${ctx.line} waits for that value.`,
      ];
    }
    return [`Called ${label}.`, `Line ${ctx.line} waits while it runs.`];
  }
  if (py.event === 'exception') {
    const e = py.exception;
    if (!e) return [];
    const what = code(e.message ? `${e.type}: ${e.message}` : e.type);
    if (ctx.resumed)
      return [`The exception ${what} came back to line ${ctx.line} from the call it made.`];
    return [`Line ${ctx.line} raised ${what}.`];
  }
  if (py.event === 'return' && py.unwinding) {
    const frame = topFrame(step);
    if (!frame) return [];
    return frame.name === '<module>'
      ? ['Nothing caught the exception, so the program stops here.']
      : [
          `${capitalize(callLabel(ctx.trace, ctx.a, frame.id))} stops here: the exception passes up to the line that called it.`,
        ];
  }
  if (py.event === 'return' && py.yielded) {
    const frame = topFrame(step);
    const v = frame ? returned(step, frame.id) : undefined;
    if (!frame || !v) return [];
    return [
      `${capitalize(callLabel(ctx.trace, ctx.a, frame.id))} yields ${valuePhrase(step, v)} and pauses here until the next value is asked for.`,
    ];
  }
  if (afterRaise(ctx.trace, ctx.k)) {
    // Python is leaving the raising line for the handler (or the end of the frame).
    return [`Because of the exception, Python leaves line ${ctx.line} and goes to line ${py.at}.`];
  }
  const out: string[] = [];
  out.push(gotBack(ctx) ?? '');
  if (stmt && stmt.kind !== 'Multiple') {
    if (ctx.complete) out.push(...statementDid(ctx, stmt));
    else if (py.event === 'line') out.push(`Line ${ctx.line} hasn't finished yet.`);
  }
  out.push(...ending(ctx, stmt));
  return out;
}

/* ───────────────────────── arrive ───────────────────────── */

/** What a statement is about to do, as a clause after "it". Never its effects. */
function aboutClause(stmt: PyStatement): string | null {
  switch (stmt.kind) {
    case 'Assign': {
      const targets = stmt.targets.map(codeOf);
      if (targets.some((t) => t === null)) return null;
      const v = codeOf(stmt.value);
      return v
        ? `works out ${v} and stores the result in ${targets.join(' and ')}`
        : `stores a value in ${targets.join(' and ')}`;
    }
    case 'AugAssign': {
      const t = codeOf(stmt.target);
      const v = codeOf(stmt.value);
      return t && v ? `updates ${t} with ${code(`${stmt.op}= ${exprText(stmt.value)}`)}` : null;
    }
    case 'AnnAssign': {
      const t = codeOf(stmt.target);
      return t ? (stmt.value ? `stores a value in ${t}` : `annotates ${t}`) : null;
    }
    case 'If':
    case 'Elif': {
      const t = codeOf(stmt.test);
      return t ? `checks ${t} to choose a branch` : null;
    }
    case 'While': {
      const t = codeOf(stmt.test);
      return t ? `checks the loop condition ${t}` : null;
    }
    case 'For': {
      const t = codeOf(stmt.target);
      const from = codeOf(stmt.iter);
      return t && from
        ? `moves the loop on: ${t} gets the next item from ${from}, if there is one`
        : null;
    }
    case 'Return': {
      const v = codeOf(stmt.value);
      return stmt.value ? (v ? `returns ${v}` : 'returns a value') : `returns ${code('None')}`;
    }
    case 'Expr': {
      const v = codeOf(stmt.value);
      if (stmt.value.type === 'yield') return v ? `runs ${v}` : null;
      return v ? (stmt.value.type === 'call' ? `calls ${v}` : `evaluates ${v}`) : null;
    }
    case 'Import':
      return `imports ${stmt.names.map(code).join(', ')}`;
    case 'FunctionDef':
      return `defines the function ${code(stmt.name)}`;
    case 'ClassDef':
      return `defines the class ${code(stmt.name)}`;
    case 'Try':
      return `enters a ${code('try')} block`;
    case 'Except':
      return stmt.type
        ? `checks whether the exception matches ${code(stmt.type)}`
        : 'catches the exception';
    case 'Raise':
      return 'raises an exception';
    case 'Pass':
      return `does nothing (${code('pass')})`;
    case 'Break':
      return `leaves the loop (${code('break')})`;
    case 'Continue':
      return `skips to the loop's next pass (${code('continue')})`;
    case 'With':
      return `enters a ${code('with')} block`;
    case 'Delete':
      return 'deletes a name or an item';
    case 'Global':
    case 'Nonlocal':
      return `declares ${stmt.names.map(code).join(', ')} ${stmt.kind === 'Global' ? 'global' : 'nonlocal'}`;
    case 'Assert': {
      const t = codeOf(stmt.test);
      return t ? `checks ${t}` : null;
    }
    default:
      return null;
  }
}

function about(ctx: Ctx): string[] {
  const py = ctx.step.py;
  if (!py || py.ending) return [];
  if (py.event === 'return' && py.unwinding) {
    const frame = topFrame(ctx.step);
    return frame && frame.name !== '<module>'
      ? [
          `${capitalize(callLabel(ctx.trace, ctx.a, frame.id))} is about to stop because of the exception.`,
        ]
      : ['The program is about to stop because of the exception.'];
  }
  if (afterRaise(ctx.trace, ctx.k))
    return [`About to leave line ${ctx.line} because of the exception.`];
  if (ctx.resumed) return [`About to continue line ${ctx.line}.`];
  if (!ctx.stmt) return [];
  if (ctx.stmt.kind === 'With') {
    // Coming back from the block's own body: the line runs again to leave the block.
    const p = ctx.a.prevInFrame[ctx.k];
    if (p !== null && inRange(lineOf(ctx.trace.steps[p]), ctx.stmt.body)) {
      return [`About to run line ${ctx.line}: it leaves the ${code('with')} block.`];
    }
  }
  if (ctx.stmt.kind === 'ClassDef' && inClassBody(ctx, ctx.stmt.name)) {
    return [`About to start the body of class ${code(ctx.stmt.name)}.`];
  }
  const clause = aboutClause(ctx.stmt);
  return clause ? [`About to run line ${ctx.line}: it ${clause}.`] : [];
}

/* ───────────────────────── the other sections ───────────────────────── */

function branch(ctx: Ctx): { text: string[]; condition?: StepCondition } {
  const { stmt, step } = ctx;
  const r = testResult(ctx);
  if (
    !stmt ||
    r === null ||
    !step.py ||
    (stmt.kind !== 'If' && stmt.kind !== 'Elif' && stmt.kind !== 'While')
  ) {
    return { text: [] };
  }
  const at = step.py.at;
  const cond = conditionPhrase(stmt.test, r);
  const body = lineRange(stmt.body.first, stmt.body.last);
  const t = exprText(stmt.test);
  const condition = t !== null ? { expr: t, result: r } : undefined;
  const orelse = stmt.orelse;
  let text: string;
  const top = topFrame(step);
  if (step.py.event === 'return' && top) {
    // Nothing runs after the statement: the frame finishes.
    const who = top.name === '<module>' ? 'the program' : callLabel(ctx.trace, ctx.a, top.id);
    text =
      stmt.kind === 'While'
        ? `${cond}, so the loop ends, and with nothing after it ${who} finishes.`
        : `${cond}, so ${body} ${isAre(stmt.body.first, stmt.body.last)} skipped, and with nothing after it ${who} finishes.`;
    return { text: [capitalize(text)], ...(condition ? { condition } : {}) };
  }
  if (stmt.kind === 'While') {
    if (r) text = `${cond}, so the loop body (${body}) runs.`;
    else if (orelse && inRange(at, orelse)) {
      text = `${cond}, so the loop ends and its ${code('else')} block (${lineRange(orelse.first, orelse.last)}) runs.`;
    } else text = `${cond}, so the loop ends; Python continues at line ${at}.`;
  } else if (r) {
    text = orelse
      ? `${cond}, so the body (${body}) runs and the ${code(orelse.kind)} part (${lineRange(orelse.line, orelse.last)}) is skipped.`
      : `${cond}, so the body (${body}) runs.`;
  } else if (orelse?.kind === 'elif' && at === orelse.line) {
    text = `${cond}, so ${body} ${isAre(stmt.body.first, stmt.body.last)} skipped and Python checks the ${code('elif')} on line ${orelse.line} next.`;
  } else if (orelse?.kind === 'else' && inRange(at, orelse)) {
    text = `${cond}, so ${body} ${isAre(stmt.body.first, stmt.body.last)} skipped and the ${code('else')} branch (${lineRange(orelse.first, orelse.last)}) runs.`;
  } else if (!orelse) {
    text = `${cond}, so ${body} ${isAre(stmt.body.first, stmt.body.last)} skipped.`;
  } else text = `${cond}.`;
  return { text: [capitalize(text)], ...(condition ? { condition } : {}) };
}

function loop(ctx: Ctx): string[] {
  const pass = ctx.a.loops[ctx.k];
  const stmt = ctx.stmt;
  if (!pass || !stmt || (stmt.kind !== 'For' && stmt.kind !== 'While')) return [];
  const name = code(stmt.kind === 'For' ? 'for' : 'while');
  if (pass.entered) {
    const bound = stmt.kind === 'For' ? loopBinding(ctx, stmt.target) : null;
    return [
      bound
        ? `Iteration ${pass.iteration} of the ${name} loop: ${bound}.`
        : `Iteration ${pass.iteration} of the ${name} loop.`,
    ];
  }
  const tail =
    stmt.orelse && inRange(ctx.step.py?.at ?? 0, stmt.orelse)
      ? `; its ${code('else')} block runs`
      : '';
  if (pass.iteration === 0) return [`The ${name} loop ends without running its body${tail}.`];
  return [`The ${name} loop ends after ${count(pass.iteration, 'iteration')}${tail}.`];
}

function calls(ctx: Ctx): string[] {
  const { step, prev, trace, a } = ctx;
  const out: string[] = [];
  const ids = new Set(step.stack.map((f) => f.id));
  for (const f of prev?.stack ?? []) {
    if (ids.has(f.id) || !prev) continue;
    const label = callLabel(trace, a, f.id);
    const v = returned(prev, f.id);
    if (prev.py?.yielded && v)
      out.push(`${capitalize(label)} yielded ${valuePhrase(prev, v)} to line ${ctx.line}.`);
    else if (prev.py?.unwinding) out.push(`${capitalize(label)} ended because of an exception.`);
    else if (isGenerator(scopeOf(ctx, f.id)))
      out.push(`${capitalize(label)} finished: line ${ctx.line} gets no more values from it.`);
    else if (v)
      out.push(`${capitalize(label)} returned ${valuePhrase(prev, v)} to line ${ctx.line}.`);
    else if (f.name !== '<module>') out.push(`${capitalize(label)} finished.`);
  }
  const py = step.py;
  const top = topFrame(step);
  if (py?.event === 'call' && top) {
    const label = callLabel(trace, a, top.id);
    if (py.call?.scope === 'class') out.push(`Line ${ctx.line} runs ${label} in a new frame.`);
    else if (py.call?.resumed)
      out.push(`${capitalize(label)} resumes (line ${ctx.line} asked for its next value).`);
    else if (isGenerator(py.call?.scope)) out.push(`Started ${label} from line ${ctx.line}.`);
    else out.push(`Called ${label} from line ${ctx.line}.`);
    const caller = step.stack[step.stack.length - 2];
    for (const p of top.variables) {
      if (p.kind !== 'pointer' || !caller) continue;
      const block = blockIn(step, p.target);
      const same = caller.variables.filter((v) => v.kind === 'pointer' && v.target === p.target);
      if (
        block &&
        same.length > 0 &&
        block.objectKind !== 'function' &&
        block.objectKind !== 'class'
      ) {
        out.push(
          `${code(p.name)} refers to the same ${kindWord(block)} as the caller's ${same.map((s) => code(s.name)).join(' and ')}.`,
        );
      }
    }
  }
  return out;
}

/** The exception step most recently raised in (or passed into) `frame`, at or before `k`. */
function lastException(trace: Trace, a: PyAnalysis, k: number, frame: string | null) {
  for (let j = k; j >= 0; j--) {
    const s = trace.steps[j];
    if (s.py?.event === 'exception' && a.ran[j] === frame && s.py.exception)
      return { j, e: s.py.exception };
  }
  return null;
}

/** Follow an exception raised at step `k` in its frame: which `except` (if any) takes it. */
function fate(ctx: Ctx, k: number): string | null {
  const { trace, a } = ctx;
  const frame = a.ran[k];
  for (let j = k + 1; j < trace.steps.length; j++) {
    const s = trace.steps[j];
    // The step right after the exception shows Python leaving the raising line.
    if (afterRaise(trace, j) && s.py?.event === 'line') continue;
    if (a.ran[j] !== frame) return null;
    if (s.py?.event === 'return' && s.py.unwinding) {
      const f = topFrame(s);
      if (!f) return null;
      return f.name === '<module>'
        ? 'Nothing catches it, so the program stops.'
        : `Nothing in ${callLabel(trace, a, f.id)} catches it, so the exception passes up to the line that called it.`;
    }
    if (s.py?.ending === 'uncaught') return 'Nothing catches it, so the program stops.';
    const stmt = statementOf(trace, s, frame);
    if (stmt?.kind !== 'Except') return null;
    if (s.py && inRange(s.py.at, stmt.body)) {
      return stmt.type
        ? `The ${code(`except ${stmt.type}`)} clause on line ${stmt.line} catches it.`
        : `The bare ${code('except:')} on line ${stmt.line} catches it.`;
    }
  }
  return null;
}

function exceptions(ctx: Ctx): string[] {
  const { step, trace, a } = ctx;
  const py = step.py;
  if (!py) return [];
  if (py.ending === 'uncaught' && py.exception) {
    const e = py.exception;
    const what = code(e.message ? `${e.type}: ${e.message}` : e.type);
    return [
      `${what} was not caught, so the program stopped. Python printed the traceback in the output.`,
    ];
  }
  if (py.event === 'exception' && py.exception) {
    const e = py.exception;
    const what = code(e.message ? `${e.type}: ${e.message}` : e.type);
    const head = ctx.resumed
      ? `${what} came up to line ${ctx.line} from the function it called.`
      : `${what} was raised on line ${ctx.line}.`;
    return [head, fate(ctx, ctx.k) ?? ''];
  }
  if (py.event === 'return' && py.unwinding) {
    const top = topFrame(step);
    const last = lastException(trace, a, ctx.k, ctx.frame);
    if (!top || !last) return [];
    const what = code(last.e.type);
    return top.name === '<module>'
      ? [`The ${what} reached the top of the program uncaught.`]
      : [
          `${capitalize(callLabel(trace, a, top.id))} ends early: the ${what} goes on to its caller.`,
        ];
  }
  if (ctx.stmt?.kind === 'Except' && ctx.complete) {
    const last = lastException(trace, a, ctx.k, ctx.frame);
    const caught = inRange(py.at, ctx.stmt.body);
    if (!last) return [];
    const what = code(last.e.type);
    return caught
      ? [
          `The ${what} from line ${lineOf(trace.steps[last.j])} is handled here: ${lineRange(ctx.stmt.body.first, ctx.stmt.body.last)} run${ctx.stmt.body.first === ctx.stmt.body.last ? 's' : ''} next.`,
        ]
      : [];
  }
  return [];
}

/* ───────────────────────── "What changed" ───────────────────────── */

/** `` `b` ``, `` `b` (the same list as `a`) `` when other names share it, or `list o3`. */
function objectName(step: Step, paths: Map<string, string>, id: string): string {
  const path = paths.get(id);
  const block = blockIn(step, id);
  const kind = block ? kindWord(block) : 'object';
  if (path === undefined) return `${kind} ${id}`;
  const others = namesFor(step, id)
    .map((n) => n.name)
    .filter((n, i, all) => n !== path && all.indexOf(n) === i);
  return others.length > 0 && !path.includes('[') && !path.includes('.')
    ? `${code(path)} (the same ${kind} as ${others.map(code).join(' and ')})`
    : code(path);
}

/** The label of a slot inside an object, or of a name in a frame. */
function slotLabel(
  ctx: Ctx,
  step: Step,
  paths: Map<string, string>,
  owner: string,
  cellId: string,
): string | null {
  const frame = frameIn(step, owner);
  if (frame) {
    const cell = frame.variables.find((v) => v.id === cellId);
    return cell ? nameLabel(ctx, step, frame, cell.name) : null;
  }
  const block = blockIn(step, owner);
  const cell = block?.cells.find((c) => c.id === cellId);
  if (!block || !cell) return null;
  const base = paths.get(owner);
  const path = base !== undefined ? slotPath(block, cell, base) : null;
  return path !== null ? code(path) : `${code(cell.name)} in ${kindWord(block)} ${block.id}`;
}

function findCell(step: Step, id: string): Cell | undefined {
  for (const f of step.stack) {
    const c = f.variables.find((v) => v.id === id);
    if (c) return c;
  }
  for (const b of step.heap) {
    const c = b.cells.find((x) => x.id === id);
    if (c) return c;
  }
  return undefined;
}

function changeRow(
  ctx: Ctx,
  prev: Step,
  step: Step,
  e: PyEvent,
  paths: { prev: Map<string, string>; next: Map<string, string> },
): ChangeRow | null {
  const md = { markdown: true as const };
  switch (e.kind) {
    case 'frame-pushed': {
      const label = callLabel(ctx.trace, ctx.a, e.frameId);
      if (step.py?.call?.resumed && topFrame(step)?.id === e.frameId) {
        return {
          kind: 'call',
          subject: `${capitalize(label)} resumes: its frame is back on the stack`,
          ...md,
        };
      }
      const scope = scopeOf(ctx, e.frameId);
      if (scope === 'class')
        return { kind: 'call', subject: `${capitalize(label)} starts in a new frame`, ...md };
      if (isGenerator(scope)) {
        return {
          kind: 'call',
          subject: `${capitalize(label)} starts running: a new frame is pushed`,
          ...md,
        };
      }
      return { kind: 'call', subject: `${capitalize(label)} called: a new frame is pushed`, ...md };
    }
    case 'frame-popped': {
      const label = capitalize(callLabel(ctx.trace, ctx.a, e.frameId));
      if (prev.py?.yielded)
        return {
          kind: 'return',
          subject: `${label} paused at a ${code('yield')}: its frame leaves the stack until it resumes`,
          ...md,
        };
      if (prev.py?.unwinding)
        return {
          kind: 'return',
          subject: `${label} ended by an exception: its frame is popped`,
          ...md,
        };
      return { kind: 'return', subject: `${label} returned: its frame is popped`, ...md };
    }
    case 'object-created': {
      const block = blockIn(step, e.objectId);
      if (!block) return null;
      const path = paths.next.get(e.objectId);
      const named = `New ${kindWord(block)}${path !== undefined ? ` ${code(path)}` : ` ${block.id}`}`;
      if (isArray(block)) {
        // Phase 34: an array's shape, and whose memory it uses.
        const base = block.ndarray.base;
        const of =
          base === null
            ? ''
            : `, a view of ${paths.next.has(base) ? code(paths.next.get(base)!) : `ndarray ${base}`}`;
        return {
          kind: 'alloc',
          subject: `${named}, shape ${code(shapeText(block.ndarray.shape))}${of}`,
          ...md,
        };
      }
      if (isTable(block) || isGroupBy(block)) {
        // Phase 35: a table's shape, a GroupBy's groups, and the pandas object it was made from.
        const d = derivedTables(ctx.trace).get(block.id);
        const from = d
          ? `, from ${paths.next.has(d.source) ? code(paths.next.get(d.source)!) : `${blockIn(step, d.source)?.type ?? 'object'} ${d.source}`}`
          : '';
        const kept =
          d?.relation.kind === 'filter'
            ? ` (kept ${thousands(d.relation.keptCount)} of ${thousands(d.relation.of)} ${isTable(block) && block.table.kind === 'series' ? 'values' : 'rows'})`
            : '';
        const facts = isTable(block)
          ? shapeWords(block)
          : `${block.groupby.ngroups} groups by ${block.groupby.keys.map((k) => code(k)).join(', ')}`;
        return { kind: 'alloc', subject: `${named}, ${facts}${from}${kept}`, ...md };
      }
      return { kind: 'alloc', subject: named, ...md };
    }
    case 'object-released': {
      const block = blockIn(prev, e.objectId);
      if (!block) return null;
      const path = paths.prev.get(e.objectId);
      // "Reachable" is what the recorder follows: names, items, keys and attributes. (It doesn't
      // follow a class's methods, so it can't claim the object is gone for good.)
      return {
        kind: 'free',
        subject: `Nothing on screen refers to ${kindWord(block)} ${block.id}${path !== undefined ? ` (was ${code(path)})` : ''} any more`,
        ...md,
      };
    }
    case 'name-bound': {
      const frame = frameIn(step, e.frameId);
      const cell = frame?.variables.find((v) => v.id === e.cellId);
      if (!frame || !cell) return null;
      return {
        kind: 'declare',
        subject: nameLabel(ctx, step, frame, cell.name),
        to: valueText(step, cell),
        ...md,
      };
    }
    case 'name-unbound': {
      const frame = frameIn(prev, e.frameId);
      const cell = frame?.variables.find((v) => v.id === e.cellId);
      // A generator's yielded value leaves when it resumes: not a name the program removed.
      if (!frame || !cell || cell.name === 'return') return null;
      return {
        kind: 'remove',
        subject: `${nameLabel(ctx, prev, frame, cell.name)} was removed`,
        from: valueText(prev, cell),
        ...md,
      };
    }
    case 'item-added':
    case 'item-removed': {
      const at = e.kind === 'item-added' ? step : prev;
      const block = blockIn(at, e.objectId);
      const cell = block?.cells.find((c) => c.id === e.cellId);
      if (!block || !cell) return null;
      const obj = objectName(at, e.kind === 'item-added' ? paths.next : paths.prev, e.objectId);
      const v = code(valueText(at, cell));
      if (block.objectKind === 'set' || block.objectKind === 'frozenset') {
        return e.kind === 'item-added'
          ? { kind: 'add', subject: `${v} added to the set ${obj}`, ...md }
          : { kind: 'remove', subject: `${v} removed from the set ${obj}`, ...md };
      }
      if (e.kind === 'item-added') {
        return {
          kind: 'add',
          subject: e.atEnd
            ? `${v} added at the end of ${obj}`
            : `${v} inserted into ${obj} at index ${e.index}`,
          ...md,
        };
      }
      return {
        kind: 'remove',
        subject: e.atEnd
          ? `${v} removed from the end of ${obj}`
          : `${v} removed from ${obj} at index ${e.index}`,
        ...md,
      };
    }
    case 'key-added':
    case 'key-removed': {
      const at = e.kind === 'key-added' ? step : prev;
      const block = blockIn(at, e.objectId);
      const cell = block?.cells.find((c) => c.id === e.cellId);
      if (!block || !cell) return null;
      const obj = objectName(at, e.kind === 'key-added' ? paths.next : paths.prev, e.objectId);
      return e.kind === 'key-added'
        ? {
            kind: 'add',
            subject: `Key ${code(cell.name)} added to ${obj}`,
            to: valueText(at, cell),
            ...md,
          }
        : {
            kind: 'remove',
            subject: `Key ${code(cell.name)} removed from ${obj}`,
            from: valueText(at, cell),
            ...md,
          };
    }
    case 'attribute-set':
    case 'attribute-deleted': {
      if (e.kind === 'attribute-set' && e.from !== null) {
        const subject = slotLabel(ctx, step, paths.next, e.objectId, e.cellId);
        if (subject === null) return null;
        return {
          kind: e.to.kind === 'pointer' ? 'pointer' : 'value',
          subject,
          from: valueText(prev, e.from),
          to: valueText(step, e.to),
          ...md,
        };
      }
      const at = e.kind === 'attribute-set' ? step : prev;
      const block = blockIn(at, e.objectId);
      const cell = block?.cells.find((c) => c.id === e.cellId);
      if (!block || !cell) return null;
      const obj = objectName(at, e.kind === 'attribute-set' ? paths.next : paths.prev, e.objectId);
      return e.kind === 'attribute-set'
        ? {
            kind: 'add',
            subject: `Attribute ${code(cell.name)} set on ${obj}`,
            to: valueText(at, cell),
            ...md,
          }
        : {
            kind: 'remove',
            subject: `Attribute ${code(cell.name)} removed from ${obj}`,
            from: valueText(at, cell),
            ...md,
          };
    }
    case 'array-reshaped': {
      const block = blockIn(step, e.objectId);
      if (!block) return null;
      return {
        kind: 'value',
        subject: `Shape of ${objectName(step, paths.next, e.objectId)} (reshaped in place)`,
        from: shapeText(e.from),
        to: shapeText(e.to),
        ...md,
      };
    }
    case 'column-added':
    case 'column-removed': {
      const at = e.kind === 'column-added' ? step : prev;
      const block = blockIn(at, e.objectId);
      const col = isTable(block) ? block.table.columns.find((c) => c.key === e.key) : undefined;
      if (!block || !col) return null;
      const obj = objectName(at, e.kind === 'column-added' ? paths.next : paths.prev, e.objectId);
      return e.kind === 'column-added'
        ? { kind: 'add', subject: `Column ${code(col.name)} added to ${obj}`, to: col.dtype, ...md }
        : { kind: 'remove', subject: `Column ${code(col.name)} removed from ${obj}`, ...md };
    }
    case 'row-added':
    case 'row-removed': {
      const at = e.kind === 'row-added' ? step : prev;
      const block = blockIn(at, e.objectId);
      if (!isTable(block)) return null;
      const label = block.table.rowLabels[block.table.rowKeys.indexOf(e.key)] ?? displayText(e.key);
      const obj = objectName(at, e.kind === 'row-added' ? paths.next : paths.prev, e.objectId);
      return e.kind === 'row-added'
        ? { kind: 'add', subject: `Row ${code(label)} added to ${obj}`, ...md }
        : { kind: 'remove', subject: `Row ${code(label)} removed from ${obj}`, ...md };
    }
    case 'rows-reordered': {
      const before = blockIn(prev, e.objectId);
      const after = blockIn(step, e.objectId);
      if (!isTable(before) || !isTable(after)) return null;
      const order = (labels: readonly string[]) =>
        labels.length > 8 ? `${labels.slice(0, 8).join(', ')}, …` : labels.join(', ');
      return {
        kind: 'value',
        subject: `Row order of ${objectName(step, paths.next, e.objectId)}`,
        from: order(before.table.rowLabels),
        to: order(after.table.rowLabels),
        ...md,
      };
    }
    case 'value-changed':
    case 'reference-retargeted': {
      const subject = slotLabel(ctx, step, paths.next, e.ownerId, e.cellId);
      const before = findCell(prev, e.cellId);
      const after = findCell(step, e.cellId);
      if (subject === null || !before || !after) return null;
      return {
        kind: after.kind === 'pointer' ? 'pointer' : 'value',
        subject,
        from: valueText(prev, before),
        to: valueText(step, after),
        ...md,
      };
    }
  }
}

function changes(ctx: Ctx): ChangeRow[] | null {
  const { prev, step } = ctx;
  if (!prev) return null;
  const used = namesIn(ctx.stmt);
  const paths = { prev: objectPaths(prev, used), next: objectPaths(step, used) };
  const rows: ChangeRow[] = [];
  const events = diffObjects(prev, step);
  // Phase 34: more than 6 elements of one array changing is one row, not one per element (and,
  // Phase 35, more than 6 values of one table).
  const perArray = new Map<string, number>();
  for (const e of events) {
    const owner = e.kind === 'value-changed' ? blockIn(step, e.ownerId) : undefined;
    if (e.kind === 'value-changed' && (isArray(owner) || isTable(owner))) {
      perArray.set(e.ownerId, (perArray.get(e.ownerId) ?? 0) + 1);
    }
  }
  const collapsed = new Set([...perArray].filter(([, n]) => n > 6).map(([id]) => id));
  for (const id of collapsed) {
    const block = blockIn(step, id);
    rows.push({
      kind: 'value',
      subject: `${perArray.get(id)} ${isTable(block) ? 'values' : 'elements'} of ${objectName(step, paths.next, id)} changed`,
      markdown: true,
    });
  }
  for (const e of events) {
    if (e.kind === 'value-changed' && collapsed.has(e.ownerId)) continue;
    const row = changeRow(ctx, prev, step, e, paths);
    if (row && !row.subject.includes('\u0000') && !(row.from ?? '').includes('\u0000'))
      rows.push(row);
  }
  const out = printed(ctx);
  if (out.length > 0) rows.push({ kind: 'output', subject: out.join('\n') });
  return rows;
}

/* ───────────────────────── concept ───────────────────────── */

function conceptKey(ctx: Ctx, applied: boolean): ConceptKey | null {
  const { step, stmt } = ctx;
  const py = step.py;
  if (!py || py.ending === 'stopped') return null;
  if (py.ending === 'uncaught') return 'exception';
  if ((py.event === 'return' && py.unwinding) || afterRaise(ctx.trace, ctx.k)) return 'exception';
  if (applied) {
    if (py.event === 'exception') return stmt?.kind === 'Raise' ? 'raise' : 'exception';
    if (py.event === 'call') {
      const top = topFrame(step);
      if (py.call?.scope === 'class') return 'class';
      if (
        py.call?.scope === 'generator' ||
        py.call?.scope === 'comprehension' ||
        py.call?.resumed
      ) {
        return 'generator';
      }
      if (top && step.stack.slice(0, -1).some((f) => f.name === top.name)) return 'recursion';
      const caller = step.stack[step.stack.length - 2];
      const shared = top?.variables.some((p) => {
        if (p.kind !== 'pointer') return false;
        const b = blockIn(step, p.target);
        return (
          b !== undefined &&
          ['list', 'dict', 'set', 'instance'].includes(b.objectKind ?? '') &&
          caller?.variables.some((v) => v.kind === 'pointer' && v.target === p.target)
        );
      });
      return shared ? 'shared-argument' : 'call';
    }
    if (py.event === 'return' && py.unwinding) return 'exception';
  }
  if (!stmt || stmt.kind === 'Multiple') return null;
  const np = applied ? numpyFor(ctx) : null;
  if (np) return np.concept;
  const state = applied ? step : ctx.prev;
  switch (stmt.kind) {
    case 'Assign': {
      if (stmt.targets.length !== 1) return 'assign';
      const t = stmt.targets[0];
      if (t.type === 'display') return 'unpacking';
      if (t.type === 'subscript') {
        const c = state ? readExpr(state, ctx.frame, t.value) : null;
        const b = state && c ? targetBlock(state, c.cell) : undefined;
        if (b?.objectKind === 'dict') return 'dict-store';
        if (b?.objectKind === 'list') return 'list-store';
        return 'assign';
      }
      if (t.type === 'attribute') return 'attribute-store';
      if (applied && t.type === 'name') {
        const cell = nameCell(step, ctx.frame, t.id);
        const b = targetBlock(step, cell);
        if (b && ['list', 'dict', 'set'].includes(b.objectKind ?? '')) {
          const shared = namesFor(step, b.id).some((n) => n.name !== t.id);
          if (shared && ctx.prev && blockIn(ctx.prev, b.id)) return 'aliasing';
          if (
            stmt.value.type === 'display' &&
            stmt.value.of !== 'tuple' &&
            (!ctx.prev || !blockIn(ctx.prev, b.id))
          )
            return 'assign-new-object';
        }
      }
      return 'assign';
    }
    case 'AugAssign': {
      const t = stmt.target;
      if (t.type === 'subscript') {
        const c = state ? readExpr(state, ctx.frame, t.value) : null;
        const b = state && c ? targetBlock(state, c.cell) : undefined;
        if (b?.objectKind === 'dict' && b.type === 'dict') return 'augassign-dict';
        return null;
      }
      const v = state ? readExpr(state, ctx.frame, t) : null;
      if (v?.cell.kind === 'scalar' && (v.cell.type === 'int' || v.cell.type === 'float'))
        return 'augassign-number';
      const b = state && v ? targetBlock(state, v.cell) : undefined;
      if (b?.objectKind === 'list' && b.type === 'list') return 'augassign-list';
      return null;
    }
    case 'AnnAssign':
      return 'annotation';
    case 'If':
    case 'Elif': {
      const t = stmt.test;
      if (
        t.type === 'compare' &&
        t.ops.length === 1 &&
        (t.ops[0] === 'in' || t.ops[0] === 'not in') &&
        state
      ) {
        const c = readExpr(state, ctx.frame, t.comparators[0]);
        const b = c ? targetBlock(state, c.cell) : undefined;
        if (b?.objectKind === 'dict') return 'membership';
      }
      return 'if';
    }
    case 'While':
      return 'while';
    case 'For':
      return 'for';
    case 'Return':
      return 'return';
    case 'Expr': {
      const v = stmt.value;
      if (v.type !== 'call') return v.type === 'yield' ? 'generator' : null;
      if (v.func.type === 'name' && v.func.id === 'print') return 'print';
      if (v.func.type === 'attribute' && state) {
        const owner = readExpr(state, ctx.frame, v.func.value);
        const b = owner ? targetBlock(state, owner.cell) : undefined;
        if (v.func.attr === 'append' && b?.objectKind === 'list' && b.type === 'list')
          return 'append';
        if (b) return 'method-call';
      }
      return null;
    }
    case 'Import':
      return 'import';
    case 'FunctionDef':
      return 'def';
    case 'ClassDef':
      return 'class';
    case 'Try':
      return 'try';
    case 'Except':
      return 'except';
    case 'Raise':
      return 'raise';
    case 'Pass':
      return 'pass';
    case 'Break':
      return 'break';
    case 'Continue':
      return 'continue';
    case 'With':
      return 'with';
    case 'Delete':
      return 'delete';
    case 'Global':
    case 'Nonlocal':
      return 'global';
    case 'Assert':
      return 'assert';
    default:
      return null;
  }
}

/* ───────────────────────── entry ───────────────────────── */

function context(trace: Trace, k: number): Ctx {
  const a = analyze(trace);
  const step = trace.steps[k];
  const prev = k > 0 ? trace.steps[k - 1] : null;
  const frame = a.ran[k];
  const resumed = prev?.py?.event === 'return';
  const ctx: Ctx = {
    trace,
    k,
    step,
    prev,
    a,
    frame,
    stmt: statementOf(trace, step, frame),
    line: lineOf(step),
    complete: a.complete[k],
    resumed,
    pre: resumed ? lineStart(trace, a, k, frame) : prev,
    callResult: null,
  };
  const callee = resumed && prev ? topFrame(prev) : undefined;
  const value = callee && !prev?.py?.unwinding ? returned(prev!, callee.id) : undefined;
  if (ctx.stmt && callee && value) {
    const all = statementExprs(ctx.stmt).flatMap((e) => callsIn(e));
    if (all.length === 1 && callsFunction(all[0], callee.name))
      ctx.callResult = { call: all[0], cell: value };
  }
  return ctx;
}

/**
 * A one-line, plain-text summary of what a Python step did, for its narration: the sentence that
 * best names the step — the exception, the branch taken, the loop pass, the call, or the last part of
 * the breakdown (usually what was stored). `null` when nothing can be derived.
 */
export function summarize(trace: Trace, stepIndex: number): string | null {
  const step = trace.steps[stepIndex];
  if (!step?.py || step.py.ending) return null;
  const d = derivePython(trace, stepIndex, 'apply');
  const last = d.did[d.did.length - 1];
  const pick =
    (step.py.event === 'exception' ? d.exceptions[0] : undefined) ??
    numpyFor(context(trace, stepIndex))?.lead ??
    d.branch[0] ??
    d.loop[0] ??
    (step.py.event === 'call' ? d.did[0] : undefined) ??
    // The program's end is said by the player; the line's own last sentence says more.
    (d.did.length > 1 && last === PROGRAM_END ? d.did[d.did.length - 2] : undefined) ??
    last;
  return pick === undefined ? null : plain(pick);
}

/** Derive the panel sections for a Python step (see {@link import('./derive.ts').deriveExplanation}). */
export function derivePython(
  trace: Trace,
  k: number,
  beat: 'arrive' | 'apply',
): DerivedExplanation {
  const out = emptyDerived();
  if (!trace.steps[k]?.py) return out;
  const ctx = context(trace, k);
  const key = conceptKey(ctx, beat === 'apply');
  out.concept = key ? GLOSSARY[key] : null;
  if (beat === 'arrive') {
    out.did = sentences(about(ctx));
    return out;
  }
  out.did = sentences(didApply(ctx));
  out.changes = changes(ctx);
  const b = branch(ctx);
  out.branch = sentences(b.text);
  if (b.condition) out.condition = b.condition;
  out.loop = sentences(loop(ctx));
  out.calls = sentences(calls(ctx));
  out.exceptions = sentences(exceptions(ctx));
  return out;
}

// Loading this module installs it as the Python deriver (it is loaded lazily, see `derive.ts`).
registerPythonDeriver(derivePython);
