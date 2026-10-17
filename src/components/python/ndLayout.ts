/**
 * Pure helpers of the NumPy array view (Phase 34): where each element and label sits in an array's
 * grid, how a long float is shortened in a cell, and the path of a "view of" link.
 *
 * @packageDocumentation
 */
import { createContext, type RefObject } from 'react';

/** The canvas element, so a cell can find the element it flies from. */
export const CanvasElementContext = createContext<RefObject<HTMLElement | null> | null>(null);

/** Arrays drawn as grids have at most this many dimensions. */
export const MAX_GRID_DIMS = 3;

/** A long float shortened to 6 significant digits, marked with `…` (the title has it in full). */
export function cellText(value: string): string {
  if (value.length <= 9 || !/^-?\d+\.\d+(e[-+]?\d+)?$/i.test(value)) return value;
  const short = String(Number(Number(value).toPrecision(6)));
  return short === value ? value : `${short}…`;
}

/** Where each element sits in the grid (1-based CSS grid lines), and the labels around them. */
export function gridPlan(shape: readonly number[]) {
  const nd = shape.length;
  const rows = nd === 3 ? shape[1] : 1;
  const place = (idx: number[]): { row: number; col: number } => {
    if (nd === 0) return { row: 1, col: 1 };
    if (nd === 1) return { row: 2, col: idx[0] + 1 };
    if (nd === 2) return { row: idx[0] + 2, col: idx[1] + 2 };
    return { row: 2 + idx[0] * (rows + 1) + 1 + idx[1], col: idx[2] + 2 };
  };
  const labels: {
    key: string;
    row: number;
    col: string;
    text: string;
    kind: 'col' | 'row' | 'slice';
  }[] = [];
  if (nd === 1) {
    for (let j = 0; j < shape[0]; j++)
      labels.push({ key: `c${j}`, row: 1, col: `${j + 1}`, text: String(j), kind: 'col' });
  } else if (nd >= 2) {
    const cols = shape[nd - 1];
    for (let j = 0; j < cols; j++)
      labels.push({ key: `c${j}`, row: 1, col: `${j + 2}`, text: String(j), kind: 'col' });
    if (nd === 2) {
      for (let i = 0; i < shape[0]; i++)
        labels.push({ key: `r${i}`, row: i + 2, col: '1', text: String(i), kind: 'row' });
    } else {
      for (let k = 0; k < shape[0]; k++) {
        const top = 2 + k * (rows + 1);
        labels.push({ key: `s${k}`, row: top, col: '1 / -1', text: `[${k}, :, :]`, kind: 'slice' });
        for (let i = 0; i < rows; i++) {
          labels.push({
            key: `s${k}r${i}`,
            row: top + 1 + i,
            col: '1',
            text: String(i),
            kind: 'row',
          });
        }
      }
    }
  }
  const columns =
    nd === 0
      ? 'auto'
      : nd === 1
        ? `repeat(${shape[0]}, minmax(2.25rem, auto))`
        : `auto repeat(${shape[nd - 1]}, minmax(2.25rem, auto))`;
  return { place, labels, columns };
}

/** The geometry of one "view of" link: out of the view's right side, down a channel, into the base. */
export function viewLinkPath(
  view: { x: number; y: number; width: number; height: number },
  base: { x: number; y: number; width: number; height: number },
  lane: number,
): { d: string; label: { x: number; y: number } } {
  const sy = view.y + 13;
  const ey = base.y + 13;
  const sx = view.x + view.width;
  const ex = base.x + base.width;
  const cx = Math.max(sx, ex) + 14 + lane * 10;
  return {
    d: `M ${sx} ${sy} L ${cx} ${sy} L ${cx} ${ey} L ${ex + 2} ${ey}`,
    label: { x: cx + 4, y: (sy + ey) / 2 },
  };
}
