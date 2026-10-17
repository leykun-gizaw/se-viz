/**
 * Reading pandas blocks (Phase 35): a DataFrame's or Series' rows and columns, which values are
 * missing, how a new table relates to the one it was made from (rows kept by a filter, rows
 * reordered by a sort, columns added, values filled), and which table each new one came from.
 * Pure functions over recorded steps — shared by the object diff, the Python canvas and its motion,
 * and the derived explanations.
 *
 * A table block's cells are keyed by the row's index label and the column's label (`o3.loc[2,
 * 'yield_kg']`), not by position, so the same value keeps its id in a filtered or sorted copy, and
 * two tables can be compared row by row.
 *
 * pandas 3 keeps no link from a derived frame to its source (copy-on-write), so the recorder can't
 * record one. {@link derivedTables} reads it from the statement instead: the name the expression
 * starts from (`farm` in `farm[farm["crop"] == "maize"]`, `farm.sort_values(…)`,
 * `pd.merge(farm, prices, …)`), looked up in the step before.
 *
 * @packageDocumentation
 */
import type { Cell, GroupByInfo, HeapBlock, PyExpr, Step, TableInfo, Trace } from './types.ts';

/** A DataFrame or Series block with its facts. */
export type TableBlock = HeapBlock & { objectKind: 'dataframe' | 'series'; table: TableInfo };
/** A GroupBy block with its facts. */
export type GroupByBlock = HeapBlock & { objectKind: 'groupby'; groupby: GroupByInfo };

export function isTable(block: HeapBlock | undefined): block is TableBlock {
  return (
    (block?.objectKind === 'dataframe' || block?.objectKind === 'series') &&
    block.table !== undefined
  );
}

export function isGroupBy(block: HeapBlock | undefined): block is GroupByBlock {
  return block?.objectKind === 'groupby' && block.groupby !== undefined;
}

/** Whether a block is any pandas table view (DataFrame, Series or GroupBy). */
export const isPandas = (block: HeapBlock | undefined) => isTable(block) || isGroupBy(block);

/** A table value's cell id: `o3.loc[2, 'yield_kg']` (DataFrame) or `o4.loc[2]` (Series). */
export function tableCellId(owner: string, rowKey: string, colKey: string | null): string {
  return colKey === null ? `${owner}.loc[${rowKey}]` : `${owner}.loc[${rowKey}, ${colKey}]`;
}

/** A table value's cell name: `2, 'yield_kg'` or `2`. */
export function tableCellName(rowKey: string, colKey: string | null): string {
  return colKey === null ? rowKey : `${rowKey}, ${colKey}`;
}

/** The id of a column (for motion cues): `o3.columns['yield_kg']`. */
export const columnId = (owner: string, key: string) => `${owner}.columns[${key}]`;
/** The id of a row (for motion cues): `o3.index[2]`. */
export const rowId = (owner: string, key: string) => `${owner}.index[${key}]`;

/** The column keys of a table: a DataFrame's column keys; `[null]` for a Series (no column). */
export function columnKeys(block: TableBlock): (string | null)[] {
  return block.table.kind === 'series' ? [null] : block.table.columns.map((c) => c.key);
}

const cellMaps = new WeakMap<HeapBlock, Map<string, Cell>>();
function cellMap(block: HeapBlock): Map<string, Cell> {
  let m = cellMaps.get(block);
  if (!m) {
    m = new Map(block.cells.map((c) => [c.id, c]));
    cellMaps.set(block, m);
  }
  return m;
}

/** The value at a row and column of a table (`undefined` when it wasn't captured). */
export function cellAt(block: TableBlock, rowKey: string, colKey: string | null): Cell | undefined {
  return cellMap(block).get(tableCellId(block.id, rowKey, colKey));
}

/** One captured row: its key, label and value per column (in {@link columnKeys} order). */
export interface TableRow {
  key: string;
  label: string;
  cells: (Cell | undefined)[];
}

export function tableRows(block: TableBlock): TableRow[] {
  const cols = columnKeys(block);
  return block.table.rowKeys.map((key, i) => ({
    key,
    label: block.table.rowLabels[i] ?? key,
    cells: cols.map((c) => cellAt(block, key, c)),
  }));
}

/** Rows in the whole table (not only the captured ones). */
export const rowCount = (block: TableBlock) => block.table.shape[0] ?? 0;

/** Columns in the whole table (a Series has one). */
export const columnCount = (block: TableBlock) =>
  block.table.kind === 'series' ? 1 : (block.table.shape[1] ?? 0);

/** Whether every row and column was captured. */
export const tableFullyCaptured = (block: TableBlock) =>
  block.table.rowsOmitted === 0 && block.table.columnsOmitted === 0;

/** The texts a missing value has in a table cell (`float('nan')`, `None`, `pd.NA`, `pd.NaT`). */
const MISSING = new Set(['nan', 'None', '<NA>', 'NaT']);

/** Whether a table cell holds a missing value. */
export function isMissing(cell: Cell | undefined): boolean {
  return cell?.kind === 'scalar' && MISSING.has(String(cell.value)) && cell.type !== 'str';
}

/** A label or value as pandas shows it: a string without its quotes, `nan` as `NaN`. */
export function displayText(repr: string): string {
  if (repr === 'nan') return 'NaN';
  const m = /^(['"])(.*)\1$/s.exec(repr);
  if (!m) return repr;
  return m[2].replace(/\\(['"\\])/g, '$1');
}

/** `1,200`. */
export const thousands = (n: number) => n.toLocaleString('en-US');

/** "30 rows × 6 columns", "1 row × 2 columns", "4 values". */
export function shapeWords(block: TableBlock): string {
  const rows = rowCount(block);
  const r = `${thousands(rows)} ${rows === 1 ? 'row' : 'rows'}`;
  if (block.table.kind === 'series') return `${thousands(rows)} ${rows === 1 ? 'value' : 'values'}`;
  const cols = columnCount(block);
  return `${r} × ${thousands(cols)} ${cols === 1 ? 'column' : 'columns'}`;
}

/* ───────────────────────── how a new table relates to its source ───────────────────────── */

/**
 * How a table made by a statement relates to the table it was made from, from their recorded rows
 * and columns:
 * - `filter`: fewer rows, the kept ones in their original order with their values unchanged
 *   (a boolean filter, `dropna`, `head`); `dropped` lists the source's captured rows that are gone;
 * - `sort`: the same rows in a new order (`sort_values`, `sort_index`);
 * - `columns-added`: the same rows, every column kept and some added (`assign`);
 * - `columns-selected`: the same rows, fewer columns (`df[["a", "b"]]`, a column as a Series);
 * - `values`: the same rows and columns, some values different (`fillna`); `changed` pairs each
 *   changed cell with the source's cell it replaced;
 * - `other`: anything else (a merge, a groupby result, a reset index).
 */
export type TableRelation =
  | { kind: 'filter'; kept: string[]; dropped: string[]; keptCount: number; of: number }
  | { kind: 'sort'; from: string[]; to: string[] }
  | { kind: 'columns-added'; added: string[] }
  | { kind: 'columns-selected'; columns: string[] }
  | { kind: 'values'; changed: [made: string, source: string][] }
  | { kind: 'other' };

const sameCell = (a: Cell | undefined, b: Cell | undefined) =>
  a !== undefined &&
  b !== undefined &&
  a.kind === 'scalar' &&
  b.kind === 'scalar' &&
  String(a.value) === String(b.value);

/** The columns two tables share, as `[made key, source key]` (a Series' value column by name). */
function sharedColumns(source: TableBlock, made: TableBlock): [string | null, string | null][] {
  if (source.table.kind === 'series' && made.table.kind === 'series') return [[null, null]];
  if (made.table.kind === 'series') {
    const named = source.table.columns.find((c) => c.name === made.table.name);
    return named ? [[null, named.key]] : [];
  }
  if (source.table.kind === 'series') return [];
  const keys = new Set(source.table.columns.map((c) => c.key));
  return made.table.columns.filter((c) => keys.has(c.key)).map((c) => [c.key, c.key]);
}

/** Whether every shared value of the row `key` is the same in both tables. */
function sameRow(
  source: TableBlock,
  made: TableBlock,
  key: string,
  cols: [string | null, string | null][],
): boolean {
  return cols.every(([m, s]) => sameCell(cellAt(made, key, m), cellAt(source, key, s)));
}

export function tableRelation(source: TableBlock, made: TableBlock): TableRelation {
  const src = source.table.rowKeys;
  const mine = made.table.rowKeys;
  const srcAt = new Map(src.map((k, i) => [k, i]));
  const cols = sharedColumns(source, made);
  if (cols.length === 0) return { kind: 'other' };
  const inSource = mine.filter((k) => srcAt.has(k));
  if (inSource.length === 0) return { kind: 'other' };
  if (!inSource.every((k) => sameRow(source, made, k, cols))) {
    // Same rows and columns, some values changed: `fillna`, arithmetic on a whole frame.
    const sameShape =
      rowCount(made) === rowCount(source) &&
      mine.length === src.length &&
      mine.every((k, i) => k === src[i]) &&
      columnCount(made) === columnCount(source) &&
      cols.length === columnKeys(made).length;
    if (!sameShape) return { kind: 'other' };
    const changed: [string, string][] = [];
    for (const k of mine) {
      for (const [m, s] of cols) {
        const a = cellAt(made, k, m);
        const b = cellAt(source, k, s);
        if (a && b && !sameCell(a, b)) changed.push([a.id, b.id]);
      }
    }
    return { kind: 'values', changed };
  }
  const ordered = inSource.every((k, i) => i === 0 || srcAt.get(k)! > srcAt.get(inSource[i - 1])!);
  if (rowCount(made) < rowCount(source) && ordered) {
    const keptSet = new Set(mine);
    // Within the captured rows: past the last kept row, a capped result may keep rows not shown.
    const last = srcAt.get(inSource[inSource.length - 1])!;
    const dropped = src.filter(
      (k, i) => !keptSet.has(k) && (made.table.rowsOmitted === 0 || i < last),
    );
    return { kind: 'filter', kept: mine, dropped, keptCount: rowCount(made), of: rowCount(source) };
  }
  if (rowCount(made) !== rowCount(source)) return { kind: 'other' };
  if (!ordered) return { kind: 'sort', from: src, to: mine };
  if (mine.length !== src.length) return { kind: 'other' };
  if (made.table.kind === 'series' || source.table.kind === 'series') {
    return made.table.kind === 'series' && source.table.kind === 'dataframe'
      ? { kind: 'columns-selected', columns: cols.map(([, s]) => s ?? '') }
      : { kind: 'other' };
  }
  const srcCols = source.table.columns.map((c) => c.key);
  const madeCols = made.table.columns.map((c) => c.key);
  const all = srcCols.every((k) => madeCols.includes(k));
  if (all && madeCols.length > srcCols.length && columnCount(made) > columnCount(source)) {
    return { kind: 'columns-added', added: madeCols.filter((k) => !srcCols.includes(k)) };
  }
  if (madeCols.every((k) => srcCols.includes(k)) && columnCount(made) < columnCount(source))
    return { kind: 'columns-selected', columns: madeCols };
  return { kind: 'other' };
}

/* ───────────────────────── where a new table came from ───────────────────────── */

/** A table (or GroupBy) a statement made, and the pandas object it was made from. */
export interface Derivation {
  source: string;
  /** The step the new object first appears in. */
  step: number;
  /** How its rows and columns relate to the source's (tables only; `other` for a GroupBy). */
  relation: TableRelation;
}

/** What a name refers to in the frame the line ran in (or the global frame). */
function targetOf(step: Step, name: string): string | null {
  const frames = [step.stack[step.stack.length - 1], step.stack[0]];
  for (const f of frames) {
    const cell = f?.variables.find((v) => v.name === name);
    if (cell) return cell.kind === 'pointer' ? cell.target : null;
  }
  return null;
}

/**
 * The name an expression starts from: `farm` in `farm["crop"]`, `farm[mask]`,
 * `farm.groupby("region")["yield_kg"].sum()`, `farm["rainfall_mm"] > 900`; the first argument of a
 * module function (`pd.merge(farm, prices)`, `pd.concat([a, b])`). `null` when it starts from
 * something else (`pd.read_csv("farm.csv")`).
 */
export function rootName(step: Step, e: PyExpr | undefined): string | null {
  if (!e) return null;
  switch (e.type) {
    case 'name':
      return e.id;
    case 'subscript':
    case 'attribute':
      return rootName(step, e.value);
    case 'binop':
      return rootName(step, e.left) ?? rootName(step, e.right);
    case 'compare':
      return rootName(step, e.left);
    case 'unary':
      return rootName(step, e.operand);
    case 'call': {
      const f = e.func;
      // `pd.merge(a, b)`: `pd` is a module (modules are not names the trace shows).
      if (
        f.type === 'attribute' &&
        f.value.type === 'name' &&
        targetOf(step, f.value.id) === null
      ) {
        const first = e.args[0];
        if (first?.type === 'display') return rootName(step, first.items?.[0]);
        return rootName(step, first);
      }
      return f.type === 'attribute' ? rootName(step, f.value) : null;
    }
    default:
      return null;
  }
}

const cache = new WeakMap<Trace, Map<string, Derivation>>();

/**
 * For every pandas object a statement made, the pandas object it was made from (once per trace):
 * from the step where the new object first appears, the statement on its line and what that
 * statement's {@link rootName} referred to in the step before.
 */
export function derivedTables(trace: Trace): Map<string, Derivation> {
  const hit = cache.get(trace);
  if (hit) return hit;
  const out = new Map<string, Derivation>();
  const seen = new Set<string>();
  trace.steps.forEach((step, k) => {
    for (const block of step.heap) {
      if (seen.has(block.id)) continue;
      seen.add(block.id);
      const prev = trace.steps[k - 1];
      if (!prev || !isPandas(block)) continue;
      const stmt = trace.statements?.[String(step.highlightedLines[0])];
      if (stmt?.kind !== 'Assign') continue;
      const name = rootName(prev, stmt.value);
      const source = name === null ? null : targetOf(prev, name);
      const from = source === null ? undefined : prev.heap.find((b) => b.id === source);
      if (!from || from.id === block.id || !isPandas(from)) continue;
      const relation =
        isTable(from) && isTable(block) ? tableRelation(from, block) : { kind: 'other' as const };
      out.set(block.id, { source: from.id, step: k, relation });
    }
  });
  cache.set(trace, out);
  return out;
}
