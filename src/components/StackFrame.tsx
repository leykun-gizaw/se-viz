/**
 * Renders one {@link StackFrame} as a labeled box of variable {@link Cell}s.
 *
 * Hovering the frame reveals a tooltip listing its variables — the hover-detail pattern that later
 * phases expand (hovering nodes, pointers, heap blocks). The push/pop animation itself is driven
 * by the parent {@link MemoryCanvas} via `AnimatePresence`; this component only animates `layout`.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { StackFrame as StackFrameModel } from '../engine/trace/types.ts';
import { Cell } from './Cell.tsx';

export interface StackFrameProps {
  frame: StackFrameModel;
  /** True for the top-of-stack (most recent) frame, which is visually emphasized. */
  isTop: boolean;
}

export function StackFrame({ frame, isTop }: StackFrameProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={`relative rounded-lg border p-3 ${
        isTop ? 'border-sky-500 bg-slate-800' : 'border-slate-700 bg-slate-900'
      }`}
      data-testid={`frame-${frame.id}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-sky-300">{frame.name}()</span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
          {isTop ? 'top of stack' : 'frame'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {frame.variables.length === 0 ? (
          <span className="font-mono text-xs text-slate-500">(no locals yet)</span>
        ) : (
          frame.variables.map((cell) => <Cell key={cell.id} cell={cell} />)
        )}
      </div>

      <AnimatePresence>
        {hovered ? (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            role="tooltip"
            className="absolute left-full top-0 z-10 ml-2 w-56 rounded-md border border-slate-600 bg-slate-950 p-2 shadow-xl"
          >
            <p className="mb-1 font-mono text-xs font-semibold text-sky-300">
              {frame.name}() variables
            </p>
            {frame.variables.length === 0 ? (
              <p className="font-mono text-xs text-slate-500">none</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {frame.variables.map((cell) => (
                  <li key={cell.id} className="font-mono text-xs text-slate-300">
                    <span className="text-sky-300">{cell.type}</span> {cell.name} ={' '}
                    <span className="text-emerald-300">
                      {cell.kind === 'scalar' && cell.value === null
                        ? '?'
                        : cell.kind === 'scalar'
                          ? String(cell.value)
                          : '…'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
