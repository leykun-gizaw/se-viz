/**
 * Pure helpers of the pandas table view (Phase 35): column widths, the footer's "showing" line, and
 * the path of a "from" link between a derived table and its source.
 *
 * @packageDocumentation
 */
import { createContext, useContext } from 'react';
import type { Derivation } from '../../engine/trace/pandas.ts';
import { thousands } from '../../engine/trace/pandas.ts';

/** Which table each derived pandas object came from, for the whole trace (`derivedTables`). */
export const DerivedContext = createContext<ReadonlyMap<string, Derivation>>(new Map());

export function useDerived(): ReadonlyMap<string, Derivation> {
  return useContext(DerivedContext);
}

/** A column's width in `ch` (monospace): its widest text, 3 to 40 characters, plus padding. */
export function columnWidth(texts: readonly string[]): number {
  const widest = texts.reduce((n, t) => Math.max(n, t.length), 0);
  return Math.min(40, Math.max(3, widest)) + 2;
}

/** A CSS grid template from widths in `ch`. */
export const template = (widths: readonly number[]) => widths.map((w) => `${w}ch`).join(' ');

/**
 * The footer of a capped table: "showing 20 of 1,200 rows", "showing 12 of 15 columns", both, or
 * `null` when everything is shown. `rows` / `cols` are the captured counts.
 */
export function showingText(
  rows: number,
  totalRows: number,
  cols: number | null,
  totalCols: number | null,
  word = 'rows',
): string | null {
  const parts: string[] = [];
  if (rows < totalRows) parts.push(`${thousands(rows)} of ${thousands(totalRows)} ${word}`);
  if (cols !== null && totalCols !== null && cols < totalCols)
    parts.push(`${thousands(cols)} of ${thousands(totalCols)} columns`);
  return parts.length === 0 ? null : `showing ${parts.join(' · ')}`;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The geometry of one "from" link, from a derived table to its source. Beside its source (to its
 * right, as the layout puts it), the link leaves the table's left side and runs back across the gap
 * into the source's right side; elsewhere it goes out of the table's right side, down a channel to
 * the right of both, and into the source's right side.
 */
export function fromLinkPath(
  made: Box,
  source: Box,
  lane: number,
): { d: string; label: { x: number; y: number } } {
  const my = made.y + 13;
  const sy = source.y + 13;
  const sourceRight = source.x + source.width;
  if (made.x >= sourceRight + 8) {
    const mid = sourceRight + (made.x - sourceRight) / 2 + ((lane % 3) - 1) * 6;
    return {
      d: `M ${made.x} ${my} L ${mid} ${my} L ${mid} ${sy} L ${sourceRight + 2} ${sy}`,
      label: { x: mid + 4, y: Math.min(my, sy) - 7 },
    };
  }
  const sx = made.x + made.width;
  const cx = Math.max(sx, sourceRight) + 14 + lane * 10;
  return {
    d: `M ${sx} ${my} L ${cx} ${my} L ${cx} ${sy} L ${sourceRight + 2} ${sy}`,
    label: { x: cx + 4, y: (my + sy) / 2 },
  };
}
