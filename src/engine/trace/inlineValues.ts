/**
 * Inline code values (Phase 16, Feature A) — the pure resolver that mirrors the memory canvas's
 * change signal onto the active source line.
 *
 * Given the active line(s) and the **active frame**, it finds the variables that line touches and
 * reports each one's value plus whether it changed this beat. Resolving against the active frame is
 * what makes recursion correct: when several live frames share a name (`n` in many `factorial`
 * frames), the value shown is the **active frame's** `n`, never another's.
 *
 * React-free and deterministic — derived only from existing cell data and the existing C tokenizer
 * (no trace-format change). The "changed vs read" classification comes from the step diff.
 *
 * @packageDocumentation
 */

import { tokenizeLine } from '../highlightC.ts';
import type { Cell, ScalarCell, StackFrame, Step } from './types.ts';

/** One variable's value to render on the active line. */
export interface InlineValue {
  /** The identifier as it appears in the source (e.g. `"sum"`, `"p"`). */
  name: string;
  /** Compact display: scalars as their value (`"10"`, `"?"`); pointers as `"→ 0x5004"` / `"→ NULL"`. */
  display: string;
  /** True ⇒ this variable changed this beat and should pulse green; false ⇒ read-only, muted. */
  changed: boolean;
  /** True for pointer cells (azure styling), false for scalars. */
  pointer: boolean;
  /** The resolved cell's stable id (used as an animation key). */
  cellId: string;
}

/** Render a scalar's value; `null` is uninitialized → `?`. */
function scalarText(value: ScalarCell['value']): string {
  return value === null ? '?' : String(value);
}

/** Does this frame contain a cell with id `id` (searching nested array/struct members)? */
function frameHasCellId(frame: StackFrame, id: string): boolean {
  const walk = (cells: Cell[]): boolean =>
    cells.some((c) => {
      if (c.id === id) return true;
      if (c.kind === 'array') return walk(c.elements);
      if (c.kind === 'struct') return walk(c.fields);
      return false;
    });
  return walk(frame.variables);
}

/**
 * The frame that's "currently executing": the one whose id is `activeId`, or that contains the cell
 * `activeId`, else the top of stack. Returns `null` only for an empty stack.
 *
 * @param step - The snapshot to resolve within (the *displayed* step).
 * @param activeId - The active element id (from the *logical* step), or undefined.
 */
export function findActiveFrame(step: Step, activeId: string | undefined): StackFrame | null {
  if (step.stack.length === 0) return null;
  if (activeId !== undefined) {
    for (const frame of step.stack) {
      if (frame.id === activeId || frameHasCellId(frame, activeId)) return frame;
    }
  }
  return step.stack[step.stack.length - 1];
}

/** Flatten a frame's variables into a name→cell map (scalars & pointers; recurses members). */
function namedScalarPointerCells(cells: Cell[], into: Map<string, Cell>): void {
  for (const cell of cells) {
    if ((cell.kind === 'scalar' || cell.kind === 'pointer') && cell.name && !into.has(cell.name)) {
      into.set(cell.name, cell);
    }
    if (cell.kind === 'array') namedScalarPointerCells(cell.elements, into);
    else if (cell.kind === 'struct') namedScalarPointerCells(cell.fields, into);
  }
}

const IDENT_RE = /^[A-Za-z_]\w*$/;

/**
 * Resolve the inline values for the active line(s).
 *
 * @param params.lines - 1-based active line numbers (from the logical step's `highlightedLines`).
 * @param params.source - The trace source (newline-separated; 1-based lines).
 * @param params.frame - The active frame (from {@link findActiveFrame}), or `null`.
 * @param params.changedIds - Cell ids that changed this beat (from `pulsedCellIds`); empty on arrive.
 * @returns One {@link InlineValue} per distinct touched variable, in first-seen order.
 */
export function resolveInlineValues(params: {
  lines: number[];
  source: string;
  frame: StackFrame | null;
  changedIds: ReadonlySet<string>;
}): InlineValue[] {
  const { lines, source, frame, changedIds } = params;
  if (!frame) return [];

  const byName = new Map<string, Cell>();
  namedScalarPointerCells(frame.variables, byName);

  const sourceLines = source.replace(/\n$/, '').split('\n');
  const seen = new Set<string>();
  const out: InlineValue[] = [];

  for (const lineNo of lines) {
    const text = sourceLines[lineNo - 1];
    if (text === undefined) continue;
    for (const tok of tokenizeLine(text)) {
      // Only plain identifiers can be variable names (keywords/types/fns/etc. are excluded).
      if (tok.type !== 'plain' || !IDENT_RE.test(tok.text) || seen.has(tok.text)) continue;
      const cell = byName.get(tok.text);
      if (!cell) continue;
      seen.add(tok.text);
      if (cell.kind === 'scalar') {
        out.push({
          name: tok.text,
          display: scalarText(cell.value),
          changed: changedIds.has(cell.id),
          pointer: false,
          cellId: cell.id,
        });
      } else if (cell.kind === 'pointer') {
        const held = cell.target === null ? 'NULL' : (cell.display ?? cell.target);
        out.push({
          name: tok.text,
          display: `→ ${held}`,
          changed: changedIds.has(cell.id),
          pointer: true,
          cellId: cell.id,
        });
      }
    }
  }

  return out;
}
