/**
 * The NumPy array view of the Python canvas (Phase 34): an `ndarray` box's body, and the dashed
 * "view of" links between a view and its base.
 *
 * - **1-D** is a row of cells with their indices above; **2-D** a grid with row and column indices;
 *   **3-D** a stack of 2-D slices, each labelled by its first-axis index (`[0, :, :]`).
 * - An array past the 200-value cap, or with more than 3 dimensions, falls back to a **summary**:
 *   its size and a flat preview of the first values, with an ellipsis for the rest.
 * - **Motion** (from `pyMotion.ts`): a changed cell pulses green (the shared value slot); the cells
 *   written through a view, and the same elements in the array they share memory with, get a dashed
 *   teal outline; the cells of a new view (a slice, `reshape`, `.T`) fly in from the elements they
 *   share; an in-place reshape (`a.shape = …`) slides each element to its new place. No motion
 *   after a jump or with reduced motion; the outline and the green mark still show.
 *
 * Every cell is a direct child of one CSS grid, keyed by its element's place in memory, so a
 * reshape moves the same element rather than replacing it.
 *
 * @packageDocumentation
 */
import { animate, motion } from 'framer-motion';
import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useAnchors } from '../../engine/anchorContext.ts';
import {
  bytePositions,
  elementCells,
  fullyCaptured,
  isArray,
  isOmittedCell,
  shapeText,
  unravel,
  type ArrayBlock,
} from '../../engine/trace/ndarray.ts';
import type { Cell, HeapBlock, Step } from '../../engine/trace/types.ts';
import {
  CanvasElementContext,
  cellText,
  gridPlan,
  MAX_GRID_DIMS,
  viewLinkPath,
} from './ndLayout.ts';
import { useMotionCues } from './pyMotion.ts';
import { SlotValue } from './PySlot.tsx';

/** Values shown in a summary's flat preview. */
const PREVIEW = 24;

/** The header facts of an array box: shape and dtype. */
export function NdarrayHeading({ block }: { block: HeapBlock }) {
  if (!isArray(block)) return null;
  return (
    <>
      <span className="font-mono text-[11px] text-ink">{shapeText(block.ndarray.shape)}</span>
      <span className="font-mono text-[10px] text-ink-muted">{block.ndarray.dtype}</span>
    </>
  );
}

/** One element: its value, the change pulse, the shared-memory outline, and the flight in. */
function NdCell({
  cell,
  index,
  row,
  col,
  glide,
}: {
  cell: Cell;
  index: number[];
  row: number;
  col: number;
  glide: boolean;
}) {
  const cues = useMotionCues();
  const canvas = useContext(CanvasElementContext);
  const box = useRef<HTMLSpanElement>(null);
  const source = cues.animate ? cues.flights.get(cell.id) : undefined;

  // Fly in from the same element in the array this view was made from (measured after layout).
  useLayoutEffect(() => {
    const el = box.current;
    const root = canvas?.current;
    if (!source || !el || !root) return;
    const from = [...root.querySelectorAll<HTMLElement>('[data-np-cell]')].find(
      (n) => n.dataset.npCell === source,
    );
    if (!from) return;
    const a = from.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const controls = animate(
      el,
      { x: [a.left - b.left, 0], y: [a.top - b.top, 0] },
      { duration: 0.6, ease: 'easeInOut' },
    );
    return () => controls.stop();
  }, [source, canvas, cues.transition]);

  const shared = cues.shared.has(cell.id);
  const value = cell.kind === 'scalar' ? String(cell.value) : '';
  return (
    <motion.div
      layout={glide ? 'position' : false}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{ gridRow: row, gridColumn: col }}
      className="flex"
    >
      <span
        ref={box}
        data-np-cell={cell.id}
        title={`[${index.join(', ')}] = ${value}${shared ? ' (memory shared with another array)' : ''}`}
        className={`flex w-full items-center justify-center rounded-sm border border-hairline bg-surface-2 px-1.5 py-0.5 ${
          shared ? 'outline-2 outline-offset-1 outline-heap outline-dashed' : ''
        }`}
      >
        <SlotValue cell={cell} format={cellText} />
      </span>
    </motion.div>
  );
}

/** A 0-, 1-, 2- or 3-D array within the cap, as a grid of its elements. */
function ArrayGrid({ block }: { block: ArrayBlock }) {
  const cues = useMotionCues();
  const { shape } = block.ndarray;
  const plan = useMemo(() => gridPlan(shape), [shape]);
  const cells = elementCells(block);
  const positions = bytePositions(block);
  const unique = positions !== null && new Set(positions).size === positions.length;
  const glide = cues.animate && cues.restructured.has(block.id);
  if (cells.length === 0) {
    return <div className="px-2.5 py-1.5 font-mono text-xs text-ink-faint">empty array</div>;
  }
  return (
    <div className="overflow-x-auto p-2">
      <div className="grid w-max gap-0.5" style={{ gridTemplateColumns: plan.columns }}>
        {plan.labels.map((l) => (
          <span
            key={l.key}
            style={{ gridRow: l.row, gridColumn: l.col }}
            className={
              l.kind === 'slice'
                ? 'pt-1 font-mono text-[10px] font-semibold text-ink-muted'
                : `self-center font-mono text-[10px] text-ink-faint ${l.kind === 'col' ? 'text-center' : 'pr-1 text-right'}`
            }
          >
            {l.text}
          </span>
        ))}
        {cells.map((cell, i) => {
          const index = unravel(i, shape);
          const { row, col } = plan.place(index);
          return (
            <NdCell
              key={unique ? `m${positions[i]}` : cell.id}
              cell={cell}
              index={index}
              row={row}
              col={col}
              glide={glide}
            />
          );
        })}
      </div>
    </div>
  );
}

/** An array past the cap or with more than 3 dimensions: size and a flat preview. */
function ArraySummary({ block }: { block: ArrayBlock }) {
  const { shape, size } = block.ndarray;
  const cells = elementCells(block);
  const shown = cells.slice(0, PREVIEW);
  const why =
    shape.length > MAX_GRID_DIMS
      ? `${shape.length}-D: only arrays of up to ${MAX_GRID_DIMS} dimensions are drawn as grids`
      : `more than ${cells.length} values: only the first ${cells.length} are recorded`;
  return (
    <div className="flex max-w-[24rem] flex-col gap-1.5 p-2">
      <div className="font-mono text-[11px] text-ink-muted">
        {size} values · {shape.length}-D · flat, in C order
      </div>
      <div className="flex flex-wrap gap-0.5">
        {shown.map((cell, i) => (
          <span
            key={cell.id}
            data-np-cell={cell.id}
            title={`[${unravel(i, shape).join(', ')}]`}
            className="rounded-sm border border-hairline bg-surface-2 px-1 py-px"
          >
            <SlotValue cell={cell} format={cellText} />
          </span>
        ))}
        {size > shown.length ? (
          <span className="self-center px-1 font-mono text-[11px] text-ink-faint">
            … {size - shown.length} more
          </span>
        ) : null}
      </div>
      <div className="border-t border-hairline pt-1 font-sans text-[10px] text-ink-faint">
        summary: {why}
      </div>
    </div>
  );
}

/** An `ndarray` box's body: the grid (or the summary), and whose memory it uses. */
export function NdarrayBody({ block }: { block: HeapBlock }) {
  if (!isArray(block)) return null;
  const { shape, base, ownsData } = block.ndarray;
  const grid = shape.length <= MAX_GRID_DIMS && fullyCaptured(block);
  const capped = block.cells.some(isOmittedCell);
  return (
    <div>
      {grid && !capped ? <ArrayGrid block={block} /> : <ArraySummary block={block} />}
      {base !== null ? (
        <div className="border-t border-dashed border-heap px-2.5 py-1 font-sans text-[10px] text-heap">
          view of {base}: shares its memory, no copy
        </div>
      ) : !ownsData ? (
        <div className="border-t border-hairline px-2.5 py-1 font-sans text-[10px] text-ink-faint">
          uses memory it does not own
        </div>
      ) : null}
    </div>
  );
}

/** Dashed teal "view of" links from every view on screen to its base. */
export function ViewLinks({ step }: { step: Step }) {
  const { getAnchor, version } = useAnchors();
  const links = useMemo(() => {
    void version; // re-measure on every anchor change
    const out: { id: string; d: string; label: { x: number; y: number } }[] = [];
    let lane = 0;
    for (const block of step.heap) {
      if (!isArray(block) || block.ndarray.base === null) continue;
      const view = getAnchor(block.id);
      const base = getAnchor(block.ndarray.base);
      if (!view || !base) continue;
      out.push({ id: block.id, ...viewLinkPath(view, base, lane++) });
    }
    return out;
  }, [getAnchor, version, step]);
  if (links.length === 0) return null;
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="se-view-of"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--se-heap)" />
        </marker>
      </defs>
      {links.map((l) => (
        <g key={l.id}>
          <path
            d={l.d}
            fill="none"
            stroke="var(--se-heap)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            markerEnd="url(#se-view-of)"
          />
          <text
            x={l.label.x}
            y={l.label.y}
            fill="var(--se-heap)"
            fontSize={10}
            fontFamily="var(--font-mono, monospace)"
            dominantBaseline="middle"
          >
            view of
          </text>
        </g>
      ))}
    </svg>
  );
}
