/**
 * Derived explanations for pandas statements (Phase 35): reading (`pd.read_csv` from the bundled
 * sample file, `head`, `info`, `shape`), selection (`df["col"]`, `df[["a", "b"]]`, `loc`, `iloc`),
 * boolean filtering (the condition and the rows kept), new and changed columns, `sort_values`,
 * `groupby(…).agg(…)` (split, apply, combine), `merge` (keys, how, row counts before and after) and
 * missing values (`isna`, `fillna`, `dropna`, with counts).
 *
 * The Phase 32 rule holds: say only what the trace shows. Shapes, dtypes, missing counts, index
 * labels, group sizes and values are read from the recorded tables; which rows a filter kept is
 * read from the result's index; nothing is evaluated here. What a pandas method *does* (`dropna`
 * drops rows with a missing value, a left merge keeps every left row) is stated only for the methods
 * named below. Any other line that makes a pandas object gets a shape-and-source sentence.
 *
 * @packageDocumentation
 */
import {
  cellAt,
  derivedTables,
  displayText,
  isGroupBy,
  isPandas,
  isTable,
  rootName,
  rowCount,
  shapeWords,
  tableRows,
  thousands,
  type GroupByBlock,
  type TableBlock,
} from '../trace/pandas.ts';
import type { Cell, HeapBlock, PyExpr, PyStatement, Step } from '../trace/types.ts';
import type { ConceptKey } from './glossary.ts';
import type { NpCtx, NumpyDid } from './numpy.ts';
import { exprText, lookupName, objectPaths, readExpr, targetBlock } from './pyState.ts';
import { code, count } from './text.ts';

type Call = Extract<PyExpr, { type: 'call' }>;
type Did = NumpyDid;

/* ───────────────────────── reading the state ───────────────────────── */

/** The pandas object an expression names (a name, or `d[k]` holding one), in `step`. */
function pandasAt(
  step: Step | null,
  frame: string | null,
  e: PyExpr | undefined,
): HeapBlock | null {
  if (!step || !e) return null;
  const r = readExpr(step, frame, e);
  const b = r ? targetBlock(step, r.cell) : undefined;
  return isPandas(b) ? b! : null;
}

function tableAt(step: Step | null, frame: string | null, e: PyExpr | undefined) {
  const b = pandasAt(step, frame, e);
  return isTable(b) ? b : null;
}

/** How the program names a pandas object: `` `farm` ``, else `DataFrame o6`. */
function nameOf(step: Step, block: HeapBlock, prefer: ReadonlySet<string>): string {
  const path = objectPaths(step, prefer).get(block.id);
  return path !== undefined ? code(path) : `${block.type ?? 'object'} ${block.id}`;
}

/** "a and b", "a, b and c". */
function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Up to `max` labels as one code span (`2, 4, 7`), with "and N more" past it. */
function labelsText(labels: readonly string[], max = 12): string {
  if (labels.length === 0) return 'none';
  const shown = labels.slice(0, max).join(', ');
  return labels.length > max ? `${code(shown)} and ${labels.length - max} more` : code(shown);
}

/** A column (or label) name from the code: `"crop"` → `crop`; null if it isn't a string constant. */
function strConst(e: PyExpr | undefined): string | null {
  if (e?.type !== 'const') return null;
  const m = /^(['"])(.*)\1$/s.exec(e.repr);
  return m ? m[2] : null;
}

/** The string constants of a list display (`["a", "b"]`), or null. */
function strList(e: PyExpr | undefined): string[] | null {
  if (e?.type !== 'display' || e.of !== 'list' || !e.items) return null;
  const out = e.items.map(strConst);
  return out.every((s): s is string => s !== null) ? out : null;
}

/** A keyword argument of a call. */
const kwarg = (call: Call, name: string) => call.kwargs?.find((k) => k.name === name)?.value;

/** The `n`-th positional argument, or the keyword argument `name`. */
const argOf = (call: Call, n: number, name: string) => kwarg(call, name) ?? call.args[n];

/** A pandas function called through its module (`pd.read_csv`): its name, else null. */
function moduleFunction(ctx: NpCtx, e: PyExpr): string | null {
  if (e.type !== 'call' || e.func.type !== 'attribute' || e.func.value.type !== 'name') return null;
  const mod = e.func.value.id;
  // Modules are left out of frames, so an imported `pd` is not a name the trace shows.
  if (!ctx.pre || lookupName(ctx.pre, ctx.frame, mod) !== null) return null;
  return mod === 'pd' || mod === 'pandas' ? e.func.attr : null;
}

/** The column names of a table (a Series' own name), as shown. */
const columnNames = (t: TableBlock) =>
  t.table.kind === 'series' ? [t.table.name ?? ''] : t.table.columns.map((c) => c.name);

/** `` `crop` `` for each name. */
const codes = (names: readonly string[]) => names.map((n) => code(n));

/** A value of a table as shown: `NaN` for a missing float, a string without quotes. */
const shown = (cell: Cell | undefined) =>
  cell?.kind === 'scalar' ? displayText(String(cell.value)) : '?';

/** "`rainfall_mm` 2 and `yield_kg` 3": the columns with missing values, with their counts. */
function missingText(t: TableBlock): { text: string; total: number; columns: number } {
  const cols = t.table.columns.filter((c) => c.missing > 0);
  return {
    text: list(cols.map((c) => `${code(c.name)} ${c.missing}`)),
    total: cols.reduce((n, c) => n + c.missing, 0),
    columns: cols.length,
  };
}

/** "10 of 30 rows" / "all 30 rows" ("values" for a Series). */
const ofRows = (n: number, of: number, word = 'rows') =>
  n === of ? `all ${thousands(of)} ${word}` : `${thousands(n)} of ${thousands(of)} ${word}`;

/** What a table's rows are called: rows of a DataFrame, values of a Series. */
const rowWord = (t: TableBlock) => (t.table.kind === 'series' ? 'values' : 'rows');

/** A label as written in the code, without a string's quotes (`"Coast"` → `Coast`). */
const labelText = (e: PyExpr | undefined) => (e ? (strConst(e) ?? exprText(e)) : null);

/** The index labels of a table's rows, said as shown ("labelled 2, 4 and 7"), or the first ones. */
function rowsLabelled(t: TableBlock): string {
  const labels = t.table.rowLabels;
  if (t.table.rowsOmitted === 0) return `labelled ${labelsText(labels)}`;
  return `the first ${labels.length} shown are labelled ${labelsText(labels)}`;
}

/* ───────────────────────── the made object ───────────────────────── */

interface Made {
  /** The name the line bound. */
  target: string;
  block: HeapBlock;
  /** The object it was made from (from the statement), when it is a pandas object. */
  source: HeapBlock | null;
}

/** A new pandas object the line bound to a name (not one the pre-state already had). */
function madeBy(ctx: NpCtx, t: PyExpr): Made | null {
  if (t.type !== 'name' || !ctx.pre) return null;
  const stored = lookupName(ctx.step, ctx.frame, t.id);
  const block = targetBlock(ctx.step, stored);
  if (!isPandas(block) || ctx.pre.heap.some((b) => b.id === block!.id)) return null;
  const d = derivedTables(ctx.trace).get(block!.id);
  const source = d ? (ctx.pre.heap.find((b) => b.id === d.source) ?? null) : null;
  return { target: t.id, block: block!, source };
}

/** "`rainy` is a new DataFrame, 10 rows × 6 columns". */
function isNew(made: Made): string {
  const b = made.block;
  const what = isTable(b) ? `${b.type ?? 'DataFrame'}, ${shapeWords(b)}` : (b.type ?? 'object');
  return `${code(made.target)} is a new ${what}`;
}

const did = (lead: string, rest: (string | null)[], concept: ConceptKey): Did => ({
  did: [lead, ...rest.filter((s): s is string => s !== null && s !== '')],
  lead,
  concept,
});

/* ───────────────────────── reading and creating ───────────────────────── */

function created(fn: string, v: Call, made: Made): Did | null {
  const b = made.block;
  if (!isTable(b)) return null;
  const cols = columnNames(b);
  if (fn === 'read_csv') {
    const file = exprText(v.args[0] ?? { type: 'other' });
    const dtypes = new Map<string, number>();
    for (const c of b.table.columns) dtypes.set(c.dtype, (dtypes.get(c.dtype) ?? 0) + 1);
    const lead =
      `Read the CSV file ${file ? code(file) : 'named'} into a new DataFrame ${code(made.target)}: ` +
      `${shapeWords(b)}, one row per line of data and one column per header name.`;
    const m = missingText(b);
    return did(
      lead,
      [
        b.table.columnsOmitted === 0 ? `The columns are ${list(codes(cols))}.` : null,
        `pandas worked out each column's dtype from its values: ${list(
          [...dtypes].map(([d, n]) => `${n} ${code(d)}`),
        )}.`,
        m.total > 0
          ? `Empty cells became missing values (shown as ${code('NaN')}): ${m.text}.`
          : 'No value is missing.',
        `The rows got the index labels ${code('0')} to ${code(String(rowCount(b) - 1))}.`,
      ],
      'pd-read',
    );
  }
  if (fn === 'DataFrame') {
    const which =
      b.table.columnsOmitted === 0
        ? `, with the columns ${list(codes(cols))}`
        : `; the first ${cols.length} columns are ${list(codes(cols))}`;
    const lead = `Made a new DataFrame ${code(made.target)}: ${shapeWords(b)}${which}.`;
    return did(lead, [], 'pd-create');
  }
  if (fn === 'Series') {
    const name = b.table.name;
    const lead =
      `Made a new Series ${code(made.target)} of ${count(rowCount(b), 'value')} (dtype ` +
      `${code(b.table.columns[0]?.dtype ?? '?')})${name ? `, named ${code(name)}` : ''}.`;
    return did(
      lead,
      [`Its index labels are ${labelsText(b.table.rowLabels)}: each value is found by its label.`],
      'pd-series',
    );
  }
  return null;
}

/* ───────────────────────── selection ───────────────────────── */

/** The condition a filter tested, as written (`farm["rainfall_mm"] > 900`, or the mask's name). */
function conditionText(index: PyExpr): string | null {
  const t = exprText(index);
  return t === null ? null : code(t);
}

function filtered(
  ctx: NpCtx,
  owner: TableBlock,
  index: PyExpr,
  made: Made,
  prefer: ReadonlySet<string>,
): Did | null {
  const b = made.block;
  if (!isTable(b)) return null;
  const d = derivedTables(ctx.trace).get(b.id);
  if (d?.relation.kind !== 'filter') return null;
  const src = nameOf(ctx.pre!, owner, prefer);
  const cond = conditionText(index);
  const mask = index.type === 'name' ? tableAt(ctx.pre, ctx.frame, index) : null;
  const rows = rowWord(owner);
  const lead =
    `Kept the ${rows} of ${src} where ${cond ?? 'the condition'} is ${code('True')}: ` +
    `${ofRows(rowCount(b), rowCount(owner), rows)}, ${rowsLabelled(b)}.`;
  return did(
    lead,
    [
      mask
        ? `${code(index.type === 'name' ? index.id : '')} is a Series of ${code('True')} / ${code('False')} values, one per row of ${src}.`
        : null,
      `${isNew(made)}; the kept ${rows} keep their index labels.`,
      `${src} itself still has all ${thousands(rowCount(owner))} ${rows}.`,
    ],
    'pd-filter',
  );
}

function selected(
  ctx: NpCtx,
  owner: TableBlock,
  v: Extract<PyExpr, { type: 'subscript' }>,
  made: Made,
  prefer: ReadonlySet<string>,
): Did | null {
  const b = made.block;
  if (!isTable(b)) return null;
  const src = nameOf(ctx.pre!, owner, prefer);
  const one = strConst(v.index);
  if (one !== null && b.table.kind === 'series' && owner.table.kind === 'dataframe') {
    const lead =
      `Selected the column ${code(one)} of ${src}: ${code(made.target)} is a Series of ` +
      `${count(rowCount(b), 'value')} (dtype ${code(b.table.columns[0]?.dtype ?? '?')}).`;
    return did(lead, [`It has the same index labels as ${src}, one value per row.`], 'pd-column');
  }
  const many = strList(v.index);
  if (many && b.table.kind === 'dataframe') {
    const lead =
      `Selected the columns ${list(codes(many))} of ${src}: ${code(made.target)} is a new ` +
      `DataFrame with the same ${thousands(rowCount(b))} rows and only those ${many.length} columns.`;
    return did(lead, [`${src} keeps all its columns.`], 'pd-columns');
  }
  return filtered(ctx, owner, v.index, made, prefer);
}

/** `a:b` as written, or null. */
const sliceText = (e: PyExpr | undefined) => (e?.type === 'slice' ? exprText(e) : null);

/** The parts of a `loc` / `iloc` index: `[rows]` or `[rows, columns]`. */
function locParts(index: PyExpr): [PyExpr, PyExpr | null] {
  if (index.type === 'display' && index.of === 'tuple' && index.items?.length === 2)
    return [index.items[0], index.items[1]];
  return [index, null];
}

function located(
  ctx: NpCtx,
  how: 'loc' | 'iloc',
  owner: TableBlock,
  index: PyExpr,
  target: string,
  stored: Cell | null,
  made: Made | null,
  prefer: ReadonlySet<string>,
): Did | null {
  const src = nameOf(ctx.pre!, owner, prefer);
  const [rows, cols] = locParts(index);
  const rowsText = labelText(rows);
  const colsText = cols ? labelText(cols) : null;
  const concept: ConceptKey = how === 'loc' ? 'pd-loc' : 'pd-iloc';
  // One value: `farm.loc[4, "yield_kg"]`.
  if (!made && stored?.kind === 'scalar' && cols) {
    const lead =
      `Read one value of ${src} with ${code(how)}: row ${code(rowsText ?? '?')}, column ` +
      `${code(colsText ?? '?')}. ${code(target)} is ${code(String(stored.value))}` +
      `${stored.type.startsWith('np.') ? ` (a NumPy ${code(stored.type.slice(3))})` : ''}.`;
    return did(lead, [], concept);
  }
  if (!made || !isTable(made.block)) return null;
  const b = made.block;
  if (b.table.kind === 'series' && !cols && sliceText(rows) === null) {
    const lead =
      `Selected the row ${how === 'loc' ? 'labelled' : 'at position'} ${code(rowsText ?? '?')} of ${src} ` +
      `with ${code(how)}: ${code(made.target)} is a Series of its ${count(rowCount(b), 'value')}.`;
    return did(lead, [`Its index labels are the column names of ${src}.`], concept);
  }
  const ends =
    sliceText(rows) !== null
      ? how === 'loc'
        ? 'A label slice in `loc` includes its end label.'
        : 'A position slice in `iloc` leaves out its end position, as Python slices do.'
      : null;
  const lead =
    `Selected ${how === 'loc' ? 'by label' : 'by position'} with ${code(how)}: rows ` +
    `${code(rowsText ?? '?')}${colsText ? ` and columns ${code(colsText)}` : ''} of ${src}. ` +
    `${isNew(made)}.`;
  return did(lead, [ends, `Its rows are ${rowsLabelled(b)}.`], concept);
}

/* ───────────────────────── methods ───────────────────────── */

/** A sort's keys and direction, in words: "by `yield_kg`, largest first". */
function sortWords(call: Call, method: string): string {
  if (method === 'sort_index') return 'by their index labels';
  const by = argOf(call, 0, 'by');
  const keys = strConst(by) !== null ? [strConst(by)!] : (strList(by) ?? []);
  const asc = kwarg(call, 'ascending');
  const desc = asc?.type === 'const' && asc.repr === 'False';
  const what = keys.length > 0 ? `by ${list(codes(keys))}` : 'by the given columns';
  return `${what}, ${desc ? 'largest first' : 'smallest first'}`;
}

function sorted(
  ctx: NpCtx,
  owner: TableBlock,
  call: Call,
  method: string,
  made: Made,
  prefer: ReadonlySet<string>,
): Did | null {
  const b = made.block;
  const d = derivedTables(ctx.trace).get(b.id);
  if (!isTable(b) || d?.relation.kind !== 'sort') return null;
  const src = nameOf(ctx.pre!, owner, prefer);
  const lead =
    `Sorted the rows of ${src} ${sortWords(call, method)}: ${code(made.target)} is a new ` +
    `${b.type ?? 'DataFrame'} with the same ${thousands(rowCount(b))} rows in a new order.`;
  return did(
    lead,
    [
      `Each row keeps its index label, so the labels now read ${labelsText(b.table.rowLabels, 10)}.`,
      `${src} keeps its order.`,
    ],
    'pd-sort',
  );
}

/** A DataFrame method that makes a new table from `owner`. */
function method(
  ctx: NpCtx,
  owner: HeapBlock,
  call: Call,
  m: string,
  made: Made,
  prefer: ReadonlySet<string>,
): Did | null {
  const src = nameOf(ctx.pre!, owner, prefer);
  const b = made.block;
  const d = derivedTables(ctx.trace).get(b.id);
  if (isGroupBy(b) && m === 'groupby') return grouped(ctx, owner, b, made.target, prefer);
  if (!isTable(owner) || !isTable(b)) return null;
  switch (m) {
    case 'head':
    case 'tail': {
      if (d?.relation.kind !== 'filter') return null;
      const lead =
        `${code(made.target)} is the ${m === 'head' ? 'first' : 'last'} ${count(rowCount(b), 'row')} ` +
        `of ${src}, ${rowsLabelled(b)}: a new ${b.type ?? 'DataFrame'} (${shapeWords(b)}).`;
      return did(lead, [`${src} still has all ${thousands(rowCount(owner))} rows.`], 'pd-head');
    }
    case 'sort_values':
    case 'sort_index':
      return sorted(ctx, owner, call, m, made, prefer);
    case 'merge':
      return merged(ctx, owner, call.args[0], call, made, prefer);
    case 'isna':
    case 'isnull':
    case 'notna':
    case 'notnull': {
      const lead =
        `${code(made.target)} is a ${b.type ?? 'DataFrame'} of ${code('True')} / ${code('False')} ` +
        `values the shape of ${src}: ${code('True')} where a value is ${m.startsWith('not') ? 'present' : 'missing'}.`;
      return did(lead, [], 'pd-isna');
    }
    case 'fillna':
      return filled(ctx, owner, call, made, prefer);
    case 'dropna':
      return dropped(ctx, owner, call, made, prefer);
    case 'assign': {
      if (d?.relation.kind !== 'columns-added') return null;
      const added = b.table.columns.filter(
        (c) => d.relation.kind === 'columns-added' && d.relation.added.includes(c.key),
      );
      const lead =
        `${isNew(made)}: ${src} with the new ${added.length === 1 ? 'column' : 'columns'} ` +
        `${list(codes(added.map((c) => c.name)))} added.`;
      return did(
        lead,
        [`${src} itself is unchanged: ${code('assign')} returns a new DataFrame.`],
        'pd-assign',
      );
    }
    case 'copy':
      return did(
        `${isNew(made)}: a copy of ${src}. Changing one won't change the other.`,
        [],
        'pd-create',
      );
    default:
      return null;
  }
}

/* ───────────────────────── missing values ───────────────────────── */

function filled(
  ctx: NpCtx,
  owner: TableBlock,
  call: Call,
  made: Made,
  prefer: ReadonlySet<string>,
): Did | null {
  const b = made.block;
  if (!isTable(b) || b.table.kind !== 'dataframe' || owner.table.kind !== 'dataframe') return null;
  const src = nameOf(ctx.pre!, owner, prefer);
  const per = owner.table.columns
    .map((c) => {
      const now = b.table.columns.find((x) => x.key === c.key);
      return { name: c.name, n: now ? c.missing - now.missing : 0 };
    })
    .filter((x) => x.n > 0);
  const total = per.reduce((n, x) => n + x.n, 0);
  const value = exprText(call.args[0] ?? call.kwargs?.[0]?.value ?? { type: 'other' });
  const lead =
    total === 0
      ? `${isNew(made)}, a copy of ${src}: there was no missing value to fill.`
      : `Filled ${count(total, 'missing value')} of ${src} (${list(per.map((x) => `${code(x.name)} ${x.n}`))}) ` +
        `with ${value ? code(value) : 'the given value'}: ${code(made.target)} is a new DataFrame.`;
  const left = missingText(b);
  return did(
    lead,
    [
      left.total > 0
        ? `Still missing in ${code(made.target)}: ${left.text}.`
        : `${code(made.target)} has no missing value.`,
      `${src} still has its ${count(missingText(owner).total, 'missing value')}.`,
    ],
    'pd-fillna',
  );
}

function subsetWords(call: Call): string {
  const subset = kwarg(call, 'subset');
  const cols = strList(subset) ?? (strConst(subset) !== null ? [strConst(subset)!] : null);
  return cols ? `a missing value in ${list(codes(cols))}` : 'a missing value';
}

function dropped(
  ctx: NpCtx,
  owner: TableBlock,
  call: Call,
  made: Made,
  prefer: ReadonlySet<string>,
): Did | null {
  const b = made.block;
  const d = derivedTables(ctx.trace).get(b.id);
  if (!isTable(b)) return null;
  const src = nameOf(ctx.pre!, owner, prefer);
  const before = rowCount(owner);
  const after = rowCount(b);
  const lead =
    `Dropped the rows of ${src} with ${subsetWords(call)}: ${thousands(before - after)} of ` +
    `${thousands(before)} rows dropped, ${thousands(after)} kept in ${code(made.target)}, a new DataFrame.`;
  const gone = d?.relation.kind === 'filter' ? d.relation.dropped : [];
  const labels = gone.map((k) => owner.table.rowLabels[owner.table.rowKeys.indexOf(k)] ?? k);
  return did(
    lead,
    [
      labels.length > 0
        ? `${owner.table.rowsOmitted === 0 ? 'The rows' : 'Among the rows shown, the rows'} labelled ${labelsText(labels)} are gone.`
        : null,
      `${src} itself still has all ${thousands(before)} rows.`,
    ],
    'pd-dropna',
  );
}

/** `farm.isna().sum()`: the missing values counted per column. */
function missingCounts(
  ctx: NpCtx,
  owner: TableBlock,
  made: Made,
  prefer: ReadonlySet<string>,
): Did | null {
  const b = made.block;
  if (!isTable(b) || b.table.kind !== 'series' || b.table.rowsOmitted > 0) return null;
  const src = nameOf(ctx.pre!, owner, prefer);
  const rows = tableRows(b).map((r) => ({ label: r.label, n: shown(r.cells[0]) }));
  const some = rows.filter((r) => r.n !== '0');
  const lead =
    some.length === 0
      ? `Counted the missing values in each column of ${src}: none is missing.`
      : `Counted the missing values in each column of ${src}: ${list(some.map((r) => `${code(r.label)} ${r.n}`))}` +
        `${rows.length > some.length ? `; the other ${count(rows.length - some.length, 'column')} ${rows.length - some.length === 1 ? 'has' : 'have'} none` : ''}.`;
  return did(
    lead,
    [
      `${code('isna()')} marks each missing value ${code('True')}, and ${code('sum()')} counts the ${code('True')} values of each column. ${code(made.target)} is a Series indexed by column name.`,
    ],
    'pd-isna',
  );
}

/* ───────────────────────── merge ───────────────────────── */

function merged(
  ctx: NpCtx,
  left: TableBlock,
  rightExpr: PyExpr | undefined,
  call: Call,
  made: Made,
  prefer: ReadonlySet<string>,
): Did | null {
  const b = made.block;
  const right = tableAt(ctx.pre, ctx.frame, rightExpr);
  if (!isTable(b) || !right) return null;
  const ln = nameOf(ctx.pre!, left, prefer);
  const rn = nameOf(ctx.pre!, right, prefer);
  const on = kwarg(call, 'on');
  const keys = strList(on) ?? (strConst(on) !== null ? [strConst(on)!] : null);
  const howExpr = kwarg(call, 'how');
  const how = howExpr ? strConst(howExpr) : 'inner';
  if (how === null) return null;
  const keyText = keys
    ? `on the key ${keys.length === 1 ? 'column' : 'columns'} ${list(codes(keys))}`
    : 'on the columns they share';
  const lead =
    `Merged ${ln} (${count(rowCount(left), 'row')}) with ${rn} (${count(rowCount(right), 'row')}) ` +
    `${keyText}, how=${code(how)}: ${code(made.target)} is a new DataFrame, ${shapeWords(b)}.`;
  const newCols = right.table.columns.filter((c) => !(keys ?? []).includes(c.name));
  const gaps = newCols
    .map((c) => b.table.columns.find((x) => x.name === c.name))
    .filter((c): c is NonNullable<typeof c> => c !== undefined && c.missing > 0);
  const keyWord = keys ? list(codes(keys)) : 'key';
  const why: Record<string, string> = {
    inner: `An inner merge keeps only the rows whose ${keyWord} appears in both: ${thousands(rowCount(left))} rows before, ${thousands(rowCount(b))} after.`,
    left: `A left merge keeps every row of ${ln}: ${thousands(rowCount(left))} rows before, ${thousands(rowCount(b))} after.`,
    right: `A right merge keeps every row of ${rn}: ${thousands(rowCount(right))} rows before, ${thousands(rowCount(b))} after.`,
    outer: `An outer merge keeps every row of both, matched where the ${keyWord} is the same: ${thousands(rowCount(b))} rows.`,
  };
  return did(
    lead,
    [
      why[how] ?? null,
      gaps.length > 0
        ? `Rows with no match in ${rn} got missing values in its columns: ${list(gaps.map((c) => `${code(c.name)} ${c.missing}`))}.`
        : null,
      `Each row of the result is a row of ${ln} with the matching row of ${rn} beside it.`,
    ],
    'pd-merge',
  );
}

/* ───────────────────────── groupby ───────────────────────── */

/** "Coast (7 rows), Highland (8), …": each group's label and size. */
function groupSizes(g: GroupByBlock): string {
  const parts = g.groupby.groups.map(
    (x, i) => `${code(x.label)} (${i === 0 ? count(x.size, 'row') : x.size})`,
  );
  const rest = g.groupby.groupsOmitted;
  return list(rest > 0 ? [...parts, `${rest} more`] : parts);
}

function grouped(
  ctx: NpCtx,
  owner: HeapBlock,
  g: GroupByBlock,
  target: string,
  prefer: ReadonlySet<string>,
): Did {
  const src = nameOf(ctx.pre!, owner, prefer);
  const keys = list(codes(g.groupby.keys));
  const lead =
    `Split the ${count(g.groupby.rowsTotal, 'row')} of ${src} into ${count(g.groupby.ngroups, 'group')} by ${keys}: ` +
    `${groupSizes(g)}.`;
  return did(
    lead,
    [
      `Nothing is computed yet: ${code(target)} is a ${g.type ?? 'GroupBy'} that remembers which rows are in each group.`,
      `An aggregation on it (${code('sum()')}, ${code('mean()')}, ${code('agg(…)')}) applies to each group and combines the results.`,
    ],
    'pd-groupby',
  );
}

const AGGREGATES: Record<string, string> = {
  sum: 'the sum',
  mean: 'the mean',
  median: 'the median',
  max: 'the largest value',
  min: 'the smallest value',
  count: 'the number of values that are not missing',
  std: 'the standard deviation',
  first: 'the first value',
  last: 'the last value',
  nunique: 'the number of different values',
};

/** The pieces of `x.groupby(keys)[col].agg(…)`, or of `g[col].sum()` on a GroupBy name. */
interface Chain {
  /** The GroupBy object, when the line used a name bound to one (its group sizes are known). */
  groups: GroupByBlock | null;
  /** The grouped table. */
  base: TableBlock | null;
  keys: string[];
  /** The selected column(s) (`["yield_kg"]`), when one was selected. */
  column: string[] | null;
  agg: string;
  call: Call;
}

function groupChain(ctx: NpCtx, v: PyExpr): Chain | null {
  if (v.type !== 'call' || v.func.type !== 'attribute') return null;
  const agg = v.func.attr;
  let e: PyExpr = v.func.value;
  let column: string[] | null = null;
  if (e.type === 'subscript') {
    column = strConst(e.index) !== null ? [strConst(e.index)!] : strList(e.index);
    e = e.value;
  }
  const named = pandasAt(ctx.pre, ctx.frame, e);
  if (isGroupBy(named)) {
    const base = ctx.pre?.heap.find((b) => b.id === named.groupby.source);
    return {
      groups: named,
      base: isTable(base) ? base : null,
      keys: named.groupby.keys,
      column,
      agg,
      call: v,
    };
  }
  if (e.type !== 'call' || e.func.type !== 'attribute' || e.func.attr !== 'groupby') return null;
  const base = tableAt(ctx.pre, ctx.frame, e.func.value);
  const by = argOf(e, 0, 'by');
  const keys = strConst(by) !== null ? [strConst(by)!] : strList(by);
  if (!base || !keys) return null;
  return { groups: null, base, keys, column, agg, call: v };
}

/** "the mean of `yield_kg` and the largest value of `rainfall_mm`", from `agg({...})` or a method. */
function applyWords(chain: Chain): string | null {
  const of = chain.column ? ` of ${list(codes(chain.column))}` : ' of every other column';
  if (chain.agg === 'size') return 'count the rows';
  if (AGGREGATES[chain.agg]) return `${AGGREGATES[chain.agg]}${of}`;
  if (chain.agg !== 'agg' && chain.agg !== 'aggregate') return null;
  const arg = chain.call.args[0];
  const fn = strConst(arg);
  if (fn !== null) return AGGREGATES[fn] ? `${AGGREGATES[fn]}${of}` : `${code(fn)}${of}`;
  if (arg?.type === 'display' && arg.of === 'dict') {
    const src = exprText(arg);
    return src ? `what ${code(src)} asks for, column by column` : null;
  }
  return null;
}

function aggregated(ctx: NpCtx, chain: Chain, made: Made): Did | null {
  const b = made.block;
  if (!isTable(b)) return null;
  const apply = applyWords(chain);
  if (!apply) return null;
  const base = chain.base;
  // The grouped table by its own name (`farm`), not through the GroupBy (`by_region.obj`).
  const src = base ? nameOf(ctx.pre!, base, new Set()) : 'the table';
  const keys = list(codes(chain.keys));
  const groups = rowCount(b);
  const rows = chain.groups?.groupby.rowsTotal ?? (base ? rowCount(base) : null);
  const split =
    `Split: the ${rows !== null ? `${thousands(rows)} ` : ''}rows of ${src} go into ` +
    `${count(groups, 'group')} by ${keys}` +
    (chain.groups ? `: ${groupSizes(chain.groups)}.` : ', one per different value.');
  const applied = `Apply: ${apply} within each group.`;
  const values =
    b.table.kind === 'series' && b.table.rowsOmitted === 0 && groups <= 8
      ? `: ${list(tableRows(b).map((r) => `${code(r.label)} ${code(shown(r.cells[0]))}`))}`
      : '';
  const combine =
    `Combine: the ${count(groups, 'result')} become ${code(made.target)}, a new ${b.type ?? 'table'} ` +
    `with one ${b.table.kind === 'series' ? 'value' : 'row'} per group, indexed by ${keys}${values}.`;
  return {
    did: [split, applied, combine],
    lead: `Grouped ${src} by ${keys}: split, apply, combine.`,
    concept: 'pd-split-apply-combine',
  };
}

/* ───────────────────────── stores into a table ───────────────────────── */

function stored(
  ctx: NpCtx,
  t: Extract<PyExpr, { type: 'subscript' }>,
  v: PyExpr,
  prefer: ReadonlySet<string>,
): Did | null {
  // `df.loc[r, c] = v` / `df.iloc[r, c] = v`.
  if (t.value.type === 'attribute' && (t.value.attr === 'loc' || t.value.attr === 'iloc')) {
    const owner = tableAt(ctx.pre, ctx.frame, t.value.value);
    const now = tableAt(ctx.step, ctx.frame, t.value.value);
    if (!owner || !now || owner.id !== now.id) return null;
    const changed = changedCells(owner, now);
    if (changed.length !== 1) return null;
    const [before, after, row, col] = changed[0];
    const name = nameOf(ctx.step, now, prefer);
    const lead =
      `Set one value of ${name} with ${code(t.value.attr)}: row ${code(row)}${col !== null ? `, column ${code(columnName(now, col))}` : ''}, ` +
      `${code(shown(before))} → ${code(shown(after))}.`;
    return did(
      lead,
      [`${name} is the same ${now.type ?? 'DataFrame'}, changed in place.`],
      'pd-set-value',
    );
  }
  const owner = tableAt(ctx.pre, ctx.frame, t.value);
  const now = tableAt(ctx.step, ctx.frame, t.value);
  if (!owner || !now || owner.id !== now.id) return null;
  const name = nameOf(ctx.step, now, prefer);
  const key = strConst(t.index);
  const src = exprText(v);
  if (now.table.kind === 'series') {
    const changed = changedCells(owner, now);
    if (changed.length !== 1) return null;
    const [before, after, row] = changed[0];
    return did(
      `Set the value labelled ${code(row)} in ${name}: ${code(shown(before))} → ${code(shown(after))}.`,
      [],
      'pd-set-value',
    );
  }
  if (key === null) return null;
  const col = now.table.columns.find((c) => c.name === key);
  if (!col) return null;
  const existed = owner.table.columns.some((c) => c.key === col.key);
  if (!existed) {
    const lead =
      `Added the column ${code(key)} to ${name}: one value per row${src ? `, from ${code(src)}` : ''} ` +
      `(dtype ${code(col.dtype)}).`;
    return did(
      lead,
      [
        `${name} now has ${count(now.table.columns.length + now.table.columnsOmitted, 'column')}; it is the same DataFrame, changed in place.`,
        src && /\[/.test(src)
          ? 'The values are worked out row by row: each row uses its own values, matched by index label.'
          : null,
      ],
      'pd-new-column',
    );
  }
  const changed = changedCells(owner, now).filter(([, , , c]) => c === col.key);
  const all = now.table.rowsOmitted === 0;
  const lead =
    `Replaced the column ${code(key)} of ${name}${src ? ` with ${code(src)}` : ''}: ` +
    `${changed.length} of the ${count(now.table.rowKeys.length, all ? 'row' : 'row shown')} changed value.`;
  const dtype = owner.table.columns.find((c) => c.key === col.key)?.dtype;
  return did(
    lead,
    [
      dtype && dtype !== col.dtype
        ? `Its dtype changed from ${code(dtype)} to ${code(col.dtype)}.`
        : null,
    ],
    'pd-change-column',
  );
}

/** Cells of the same table whose value changed: [before, after, row label, column key]. */
function changedCells(
  before: TableBlock,
  after: TableBlock,
): [Cell, Cell, string, string | null][] {
  const out: [Cell, Cell, string, string | null][] = [];
  const cols = after.table.kind === 'series' ? [null] : after.table.columns.map((c) => c.key);
  after.table.rowKeys.forEach((rk, i) => {
    for (const ck of cols) {
      const a = cellAt(before, rk, ck);
      const b = cellAt(after, rk, ck);
      if (a && b && a.kind === 'scalar' && b.kind === 'scalar' && a.value !== b.value)
        out.push([a, b, after.table.rowLabels[i], ck]);
    }
  });
  return out;
}

/** A column's name from its key. */
const columnName = (t: TableBlock, key: string) =>
  t.table.columns.find((c) => c.key === key)?.name ?? key;

/* ───────────────────────── in-place methods and printing (`Expr`) ───────────────────────── */

function inPlace(ctx: NpCtx, v: PyExpr, prefer: ReadonlySet<string>): Did | null {
  if (v.type !== 'call' || v.func.type !== 'attribute') return null;
  const m = v.func.attr;
  const owner = pandasAt(ctx.pre, ctx.frame, v.func.value);
  const now = pandasAt(ctx.step, ctx.frame, v.func.value);
  if (!owner || !now || owner.id !== now.id || !isTable(owner) || !isTable(now)) return null;
  const name = nameOf(ctx.step, now, prefer);
  if (m === 'info') {
    const m2 = missingText(now);
    const complete = now.table.columns.filter((c) => c.missing === 0).length;
    const lead =
      `Printed a summary of ${name} (${shapeWords(now)}): each column's name, how many values ` +
      `are not missing, and its dtype.`;
    return did(
      lead,
      [
        m2.columns > 0
          ? `Not missing: ${list(
              now.table.columns
                .filter((c) => c.missing > 0)
                .map((c) => `${code(c.name)} ${rowCount(now) - c.missing} of ${rowCount(now)}`),
            )}; the other ${count(complete, 'column')} ${complete === 1 ? 'is' : 'are'} complete.`
          : 'No column has a missing value.',
        `${code('info()')} prints; it returns ${code('None')}.`,
      ],
      'pd-info',
    );
  }
  const inplace = kwarg(v, 'inplace');
  if (inplace?.type !== 'const' || inplace.repr !== 'True') return null;
  if (m === 'sort_values' || m === 'sort_index') {
    const lead =
      `Sorted the rows of ${name} ${sortWords(v, m)}, in place: the same ${now.type ?? 'DataFrame'}, ` +
      `its rows in a new order.`;
    return did(
      lead,
      [`The index labels now read ${labelsText(now.table.rowLabels, 10)}.`],
      'pd-sort',
    );
  }
  if (m === 'dropna') {
    const before = rowCount(owner);
    const after = rowCount(now);
    const lead =
      `Dropped, in place, the rows of ${name} with ${subsetWords(v)}: ${thousands(before - after)} ` +
      `of ${thousands(before)} rows removed, ${thousands(after)} left.`;
    return did(
      lead,
      [`${name} is the same DataFrame, changed; nothing new was made.`],
      'pd-dropna',
    );
  }
  return null;
}

/* ───────────────────────── entry ───────────────────────── */

/** The names a line uses, to name objects by them first. */
function namesUsed(stmt: PyStatement): Set<string> {
  const out = new Set<string>();
  const visit = (e: PyExpr | undefined): void => {
    if (!e) return;
    switch (e.type) {
      case 'name':
        out.add(e.id);
        break;
      case 'subscript':
        visit(e.value);
        visit(e.index);
        break;
      case 'attribute':
        visit(e.value);
        break;
      case 'binop':
        visit(e.left);
        visit(e.right);
        break;
      case 'compare':
        visit(e.left);
        e.comparators.forEach(visit);
        break;
      case 'call':
        visit(e.func);
        e.args.forEach(visit);
        break;
      default:
        break;
    }
  };
  if (stmt.kind === 'Assign') {
    stmt.targets.forEach(visit);
    visit(stmt.value);
  } else if (stmt.kind === 'Expr') visit(stmt.value);
  return out;
}

/** `rain * 2`, `farm["rainfall_mm"] > 900`: a new Series or DataFrame from an operation. */
function operated(ctx: NpCtx, v: PyExpr, made: Made): Did | null {
  const b = made.block;
  if (!isTable(b) || (v.type !== 'binop' && v.type !== 'compare')) return null;
  const left = v.type === 'binop' ? v.left : v.left;
  const right = v.type === 'binop' ? v.right : v.comparators[0];
  const op = v.type === 'binop' ? v.op : v.ops[0];
  const lt = exprText(left);
  const rt = right ? exprText(right) : null;
  if (lt === null || rt === null) return null;
  const leftTable = rootName(ctx.pre!, left) !== null;
  if (!leftTable) return null;
  const all = b.table.rowsOmitted === 0;
  if (v.type === 'compare') {
    const trues = all ? tableRows(b).filter((r) => shown(r.cells[0]) === 'True').length : null;
    const lead =
      `Compared every value of ${code(lt)} with ${code(rt)} (${code(op)}): ${code(made.target)} is a ` +
      `Series of ${count(rowCount(b), 'True / False value')}, one per row` +
      `${trues !== null ? `, ${code('True')} for ${trues}` : ''}.`;
    return did(
      lead,
      ['Such a Series can pick rows out of a DataFrame (a boolean mask).'],
      'pd-mask',
    );
  }
  const lead =
    `Worked out ${code(`${lt} ${op} ${rt}`)} for every value at once: ${isNew(made)}, ` +
    `with the same index labels.`;
  return did(lead, [], 'pd-series-math');
}

/**
 * The pandas reading of a statement, or null when it is not about a pandas object (or nothing more
 * than the generic text can be said). Only for a line that finished in this step.
 */
export function pandasStatement(ctx: NpCtx, stmt: PyStatement | null): Did | null {
  if (!stmt || !ctx.complete || ctx.resumed || !ctx.pre) return null;
  const prefer = namesUsed(stmt);
  if (stmt.kind === 'Expr') return inPlace(ctx, stmt.value, prefer);
  if (stmt.kind !== 'Assign' || stmt.targets.length !== 1) return null;
  const t = stmt.targets[0];
  const v = stmt.value;

  if (t.type === 'subscript') return stored(ctx, t, v, prefer);

  // `rows, cols = farm.shape`.
  if (t.type === 'display' && v.type === 'attribute' && v.attr === 'shape') {
    const owner = tableAt(ctx.pre, ctx.frame, v.value);
    if (!owner || owner.table.kind !== 'dataframe') return null;
    const path = objectPaths(ctx.pre, prefer).get(owner.id);
    const [r, c] = owner.table.shape;
    return did(
      `${path !== undefined ? code(`${path}.shape`) : `The shape of DataFrame ${owner.id}`} is ${code(`(${r}, ${c})`)}: ${thousands(r)} rows and ${thousands(c)} columns.`,
      [],
      'pd-shape',
    );
  }

  if (t.type !== 'name') return null;
  const made = madeBy(ctx, t);
  if (!made) {
    // A value read out of a table: `farm.loc[4, "yield_kg"]`, `rain["Coast"]`.
    const cell = lookupName(ctx.step, ctx.frame, t.id);
    if (cell?.kind !== 'scalar' || v.type !== 'subscript') return null;
    if (v.value.type === 'attribute' && (v.value.attr === 'loc' || v.value.attr === 'iloc')) {
      const owner = tableAt(ctx.pre, ctx.frame, v.value.value);
      return owner ? located(ctx, v.value.attr, owner, v.index, t.id, cell, null, prefer) : null;
    }
    const owner = tableAt(ctx.pre, ctx.frame, v.value);
    const label = labelText(v.index);
    if (!owner || owner.table.kind !== 'series' || label === null) return null;
    return did(
      `Read the value labelled ${code(label)} in ${nameOf(ctx.pre, owner, prefer)}: ${code(t.id)} is ${code(String(cell.value))}.`,
      [],
      'pd-series',
    );
  }

  const specific = ((): Did | null => {
    if (v.type === 'call') {
      const fn = moduleFunction(ctx, v);
      if (fn === 'merge') {
        const left = tableAt(ctx.pre, ctx.frame, v.args[0]);
        return left ? merged(ctx, left, v.args[1], v, made, prefer) : null;
      }
      if (fn !== null) return created(fn, v, made);
      // `pd.read_csv("farm.csv").head(6)`: read, then keep the first (or last) rows.
      if (
        v.func.type === 'attribute' &&
        (v.func.attr === 'head' || v.func.attr === 'tail') &&
        moduleFunction(ctx, v.func.value) === 'read_csv' &&
        isTable(made.block)
      ) {
        const inner = v.func.value as Call;
        const file = exprText(inner.args[0] ?? { type: 'other' });
        const lead =
          `Read the CSV file ${file ? code(file) : 'named'} and kept its ` +
          `${v.func.attr === 'head' ? 'first' : 'last'} ${count(rowCount(made.block), 'row')}: ` +
          `${isNew(made)}, ${rowsLabelled(made.block)}.`;
        return did(
          lead,
          [`The whole file was read first; only these rows are kept in ${code(made.target)}.`],
          'pd-read',
        );
      }
      const chain = groupChain(ctx, v);
      if (chain) return aggregated(ctx, chain, made);
      if (v.func.type === 'attribute') {
        // `farm.isna().sum()`: missing values counted per column.
        const inner = v.func.value;
        if (
          v.func.attr === 'sum' &&
          inner.type === 'call' &&
          inner.func.type === 'attribute' &&
          (inner.func.attr === 'isna' || inner.func.attr === 'isnull')
        ) {
          const owner = tableAt(ctx.pre, ctx.frame, inner.func.value);
          if (owner) return missingCounts(ctx, owner, made, prefer);
        }
        const owner = pandasAt(ctx.pre, ctx.frame, v.func.value);
        if (owner) return method(ctx, owner, v, v.func.attr, made, prefer);
      }
      return null;
    }
    if (v.type === 'subscript') {
      if (v.value.type === 'attribute' && (v.value.attr === 'loc' || v.value.attr === 'iloc')) {
        const owner = tableAt(ctx.pre, ctx.frame, v.value.value);
        const cell = lookupName(ctx.step, ctx.frame, made.target);
        return owner
          ? located(ctx, v.value.attr, owner, v.index, made.target, cell, made, prefer)
          : null;
      }
      const owner = tableAt(ctx.pre, ctx.frame, v.value);
      return owner ? selected(ctx, owner, v, made, prefer) : null;
    }
    return operated(ctx, v, made);
  })();
  if (specific) return specific;
  // Any other line that made a pandas object: what it is, and what it was made from.
  const src = made.source ? ` from ${nameOf(ctx.pre, made.source, prefer)}` : '';
  const what = isTable(made.block)
    ? `${made.block.type ?? 'DataFrame'} (${shapeWords(made.block)})`
    : (made.block.type ?? 'object');
  const text = exprText(v);
  const lead = `${text ? `${code(text)} made` : 'Made'} a new ${what}${src}: ${code(made.target)} now refers to it.`;
  return did(lead, [], isGroupBy(made.block) ? 'pd-groupby' : 'pd-create');
}
