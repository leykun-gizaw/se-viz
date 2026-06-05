/**
 * Renders a single memory {@link Cell}: its name, type, displayed value, and address.
 *
 * Phase 0 only exercises scalar cells, but every {@link Cell} variant is handled so the component
 * is ready for pointers, arrays, and structs in later phases.
 */
import { motion } from 'framer-motion';
import type { Cell as CellModel } from '../engine/trace/types.ts';

/** Format the right-hand display value for a cell based on its kind. */
function displayValue(cell: CellModel): string {
  switch (cell.kind) {
    case 'scalar':
      return cell.value === null ? '?' : String(cell.value);
    case 'pointer':
      if (cell.target === null) return 'NULL';
      return cell.display ?? `→ ${cell.target}`;
    case 'array':
      return `[${cell.elements.length}]`;
    case 'struct':
      return `{${cell.fields.length} fields}`;
  }
}

export interface CellProps {
  cell: CellModel;
}

export function Cell({ cell }: CellProps) {
  const value = displayValue(cell);
  const uninitialized = cell.kind === 'scalar' && cell.value === null;

  return (
    <motion.div
      layout
      className="flex items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-1.5"
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-sky-300">{cell.type}</span>
        <span className="font-mono text-sm font-semibold text-slate-100">{cell.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <motion.span
          key={value}
          initial={{ scale: 1.25, color: '#fde047' }}
          animate={{ scale: 1, color: uninitialized ? '#64748b' : '#a7f3d0' }}
          transition={{ duration: 0.35 }}
          className="font-mono text-sm font-bold"
        >
          {value}
        </motion.span>
        {cell.address ? (
          <span className="font-mono text-[10px] text-slate-500">{cell.address}</span>
        ) : null}
      </div>
    </motion.div>
  );
}
