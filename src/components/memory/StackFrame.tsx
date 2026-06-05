/**
 * One stack frame card. Scalar/pointer locals render inline; array locals render as a compact
 * summary row here (their cells are expanded in the data region to the right, matching the design).
 * Hovering the frame reveals its locals. Push/pop spring is provided by the parent's
 * `AnimatePresence`; this component animates its own entry/exit/layout.
 */
import { motion } from 'framer-motion';
import { useAnchorRef } from '../../engine/anchorContext.ts';
import type { ArrayCell, StackFrame as FrameModel } from '../../engine/trace/types.ts';
import { Tooltip } from '../Tooltip.tsx';
import { CellView } from './CellView.tsx';
import { useMemoryRender } from './renderContext.ts';

/** Compact in-frame representation of an array local (e.g. `arr int[5]  @0x5000`). */
function ArraySummaryRow({ cell }: { cell: ArrayCell }) {
  const ref = useAnchorRef(cell.id);
  return (
    <div
      ref={ref}
      title={`${cell.type} ${cell.name} @${cell.address ?? '?'} (${cell.elements.length} elements →)`}
      className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface-2 px-3 py-1.5"
    >
      <span className="flex items-baseline gap-1.5">
        <span className="font-mono text-sm text-ink">{cell.name}</span>
        <span className="font-mono text-[11px] text-ink-muted">{cell.type}</span>
      </span>
      {cell.address ? (
        <span className="font-mono text-[10px] text-ink-faint">{cell.address}</span>
      ) : null}
    </div>
  );
}

export interface StackFrameProps {
  frame: FrameModel;
  /** Depth in the call stack (0 = oldest / `main`). Drives the header and a subtle indent. */
  depth: number;
}

export function StackFrame({ frame, depth }: StackFrameProps) {
  const ref = useAnchorRef(frame.id);
  const { activeId } = useMemoryRender();
  const active = activeId === frame.id;

  const localsLabel = frame.variables
    .map((v) => {
      if (v.kind === 'scalar') return `${v.type} ${v.name} = ${v.value === null ? '?' : v.value}`;
      if (v.kind === 'pointer') return `${v.type} ${v.name} → ${v.target ?? 'NULL'}`;
      if (v.kind === 'array') return `${v.type} ${v.name}[${v.elements.length}]`;
      return `${v.type} ${v.name}`;
    })
    .join('\n');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -18, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      style={{ marginLeft: depth * 16 }}
    >
      <Tooltip label={localsLabel || '(no locals)'} placement="top">
        <div
          ref={ref}
          className={`min-w-[15rem] rounded-lg border bg-surface p-3 ${
            active ? 'border-active ring-1 ring-active' : 'border-hairline'
          }`}
        >
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="font-mono text-sm font-semibold text-ink">{frame.name}()</span>
            <span className="font-mono text-[10px] text-ink-faint">
              depth {depth}
              {frame.address ? ` · ${frame.address}` : ''}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {frame.variables.length === 0 ? (
              <span className="font-mono text-xs text-ink-faint">(no locals yet)</span>
            ) : (
              frame.variables.map((v) =>
                v.kind === 'array' ? (
                  <ArraySummaryRow key={v.id} cell={v} />
                ) : (
                  <CellView key={v.id} cell={v} />
                ),
              )
            )}
          </div>
        </div>
      </Tooltip>
    </motion.div>
  );
}
