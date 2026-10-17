/**
 * Human labels for trace entities (Phase 28) — shared by the step explanation panel and the timeline
 * markers, so "factorial(3)" means the same activation in both places.
 *
 * Everything here is derived from the trace data only. When a label can't be derived reliably it
 * degrades to a plainer one (a bare function name, a raw id) rather than guessing.
 *
 * @packageDocumentation
 */
import type { Cell, HeapBlock, StackFrame, Step, TraceLanguage } from './types.ts';

/** Escape a string for literal use inside a `RegExp`. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The parameter names of the C function `name` as **defined** in `source` (`int f(int a, char *s) {`),
 * or `null` when no definition line can be found or a parameter can't be named (e.g. `...`). A
 * `(void)` or `()` list gives `[]`. Calls and prototypes (lines ending in `;`) never match.
 */
export function functionParams(source: string, name: string): string[] | null {
  // A definition: a return type (identifiers, `*`, spaces) before the name, then `(params)`, then an
  // optional `{` and nothing else on the line.
  const def = new RegExp(
    `^\\s*[A-Za-z_][\\w\\s*]*[\\s*]${escapeRegExp(name)}\\s*\\(([^)]*)\\)\\s*\\{?\\s*$`,
  );
  for (const line of source.split('\n')) {
    const m = def.exec(line);
    if (!m) continue;
    const list = m[1].trim();
    if (list === '' || list === 'void') return [];
    const names: string[] = [];
    for (const raw of list.split(',')) {
      const p = /([A-Za-z_]\w*)\s*(\[[^\]]*\]\s*)*$/.exec(raw.trim());
      if (!p) return null;
      names.push(p[1]);
    }
    return names;
  }
  return null;
}

/**
 * The parameter names of the Python function `name` as defined in `source` (`def f(a, b=2, *rest):`),
 * or `null` when there is no `def` line for it. Defaults, annotations and the `*` / `**` markers are
 * dropped; a bare `*` or `/` separator is not a parameter. Phase 30.
 */
export function pythonParams(source: string, name: string): string[] | null {
  const def = new RegExp(`^\\s*(?:async\\s+)?def\\s+${escapeRegExp(name)}\\s*\\(([^)]*)\\)`, 'm');
  const m = def.exec(source);
  if (!m) return null;
  return m[1]
    .split(',')
    .map((p) => p.split(/[:=]/)[0].replace(/\*/g, '').trim())
    .filter((p) => p !== '' && p !== '/');
}

/**
 * A frame's call label. C: `factorial(3)` when every parameter is a known scalar, else the bare
 * name. Python (Phase 30): `factorial(n=3)`, with `…` for a parameter that holds a reference, and
 * `global frame` for the module.
 */
export function frameLabel(
  frame: StackFrame,
  source: string,
  language: TraceLanguage = 'c',
): string {
  if (language === 'python') {
    if (frame.name === '<module>') return 'global frame';
    const names = pythonParams(source, frame.name);
    if (names === null) return frame.name;
    const args = names.map((p) => {
      const cell = frame.variables.find((v) => v.name === p);
      return `${p}=${cell?.kind === 'scalar' ? displayScalar(cell.value) : '…'}`;
    });
    return `${frame.name}(${args.join(', ')})`;
  }
  const params = functionParams(source, frame.name);
  if (params === null) return frame.name;
  const values: string[] = [];
  for (const p of params) {
    const cell = frame.variables.find((v) => v.name === p);
    if (!cell || cell.kind !== 'scalar' || cell.value === null) return frame.name;
    values.push(String(cell.value));
  }
  return `${frame.name}(${values.join(', ')})`;
}

/** A heap block's label, e.g. `node 0x8e0`. */
export function blockLabel(block: HeapBlock): string {
  const head = block.label ?? block.type ?? 'block';
  return block.address ? `${head} ${block.address}` : head;
}

/** Display a scalar value the way the memory canvas does (`null` = indeterminate, shown as `?`). */
export function displayScalar(value: string | number | boolean | null): string {
  return value === null ? '?' : String(value);
}

/** What a labelled cell is, for the "What changed" rows. */
export interface CellInfo {
  cell: Cell;
  /** The cell's path within its owner: `n`, `arr[2]`, `node.next`. */
  path: string;
  /** Where it lives: a frame call label, a heap block label, or a static segment name. */
  owner: string;
}

function walk(cells: Cell[], prefix: string, owner: string, into: Map<string, CellInfo>): void {
  cells.forEach((cell, i) => {
    const own = cell.name !== '' ? cell.name : `[${i}]`;
    const path = prefix === '' ? own : own.startsWith('[') ? `${prefix}${own}` : `${prefix}.${own}`;
    into.set(cell.id, { cell, path, owner });
    if (cell.kind === 'array') walk(cell.elements, path, owner, into);
    else if (cell.kind === 'struct') walk(cell.fields, path, owner, into);
  });
}

/** Index every cell in a step by id, with a readable path and owner. */
export function indexCells(
  step: Step,
  source: string,
  language: TraceLanguage = 'c',
): Map<string, CellInfo> {
  const map = new Map<string, CellInfo>();
  for (const frame of step.stack) {
    walk(frame.variables, '', frameLabel(frame, source, language), map);
  }
  for (const block of step.heap) walk(block.cells, '', blockLabel(block), map);
  const s = step.staticData;
  if (s) {
    walk(s.data, '', '.data', map);
    walk(s.bss, '', '.bss', map);
    walk(s.rodata, '', '.rodata', map);
  }
  return map;
}

/** `n in factorial(3)`, `value in node 0x8e0`. */
export function cellLabel(info: CellInfo): string {
  return `${info.path} in ${info.owner}`;
}

/** The highlighted source line texts (trimmed, in line order, out-of-range lines skipped). */
export function lineTexts(source: string, lines: readonly number[]): string[] {
  const all = source.replace(/\n$/, '').split('\n');
  return [...lines]
    .sort((a, b) => a - b)
    .filter((l) => l >= 1 && l <= all.length)
    .map((l) => all[l - 1].trim());
}
