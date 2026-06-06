/**
 * `CellView` — renders any {@link Cell} (scalar, pointer, array, struct) per the design system.
 * Each cell registers an anchor by its stable id so the arrow overlay can target it.
 *
 * Semantic styling (design law):
 * - scalar → neutral surface; green pulse when its value changed this step.
 * - pointer → azure accent (border, type, held address); arrow drawn by the overlay.
 * - array  → contiguous cells with shared borders, index + ascending addresses.
 * - struct → a titled box of field rows (heap nodes usually use {@link HeapBlock} instead).
 */
import { motion } from 'framer-motion';
import { useAnchorRef } from '../../engine/anchorContext.ts';
import type {
  ArrayCell,
  Cell,
  PointerCell,
  ScalarCell,
  StructCell,
} from '../../engine/trace/types.ts';
import { useMemoryRender } from './renderContext.ts';

/** Display a scalar's value; `null` shows as `?` (uninitialized / indeterminate). */
function scalarText(value: ScalarCell['value']): string {
  return value === null ? '?' : String(value);
}

/**
 * True when a cell's displayed value is the C string NUL terminator (`'\0'`). Array elements that
 * hold the terminator get a subtle dashed, muted treatment so the end of a string reads clearly —
 * a minimal additive touch (Phase 3), using existing tokens only.
 */
function isNulTerminator(cell: Cell): boolean {
  return cell.kind === 'scalar' && typeof cell.value === 'string' && cell.value.includes('\\0');
}

/** The amber "active" badge shown on the one current element per step. */
function ActiveBadge() {
  return (
    <span className="ml-2 rounded-sm bg-active px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wide text-black">
      active
    </span>
  );
}

/** Wraps a value so it green-pulses (once) when its cell id changed this step. */
function PulseValue({ id, children }: { id: string; children: React.ReactNode }) {
  const { pulsing, stepIndex } = useMemoryRender();
  const isPulsing = pulsing.has(id);
  return (
    <motion.span
      key={`${id}:${stepIndex}`}
      initial={
        isPulsing
          ? { backgroundColor: 'var(--se-changed-soft)', color: 'var(--se-changed)' }
          : false
      }
      animate={{ backgroundColor: 'rgba(0,0,0,0)', color: 'var(--se-text)' }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      className="rounded px-1"
    >
      {children}
    </motion.span>
  );
}

function ScalarRow({ cell }: { cell: ScalarCell }) {
  const ref = useAnchorRef(cell.id);
  const { activeId } = useMemoryRender();
  const active = activeId === cell.id;
  return (
    <div
      ref={ref}
      data-coach-anchor={cell.id}
      title={`${cell.type} ${cell.name} = ${scalarText(cell.value)}${cell.address ? ` @${cell.address}` : ''}`}
      className={`flex items-center justify-between gap-3 rounded-md border bg-surface-2 px-3 py-1.5 transition-colors ${
        active ? 'border-active ring-1 ring-active' : 'border-hairline'
      }`}
    >
      <span className="flex items-baseline gap-1.5">
        <span className="font-mono text-sm text-ink">{cell.name}</span>
        <span className="font-mono text-[11px] text-ink-muted">{cell.type}</span>
        {active ? <ActiveBadge /> : null}
      </span>
      <span className="flex items-baseline gap-2">
        <PulseValue id={cell.id}>
          <span className="font-mono text-sm font-semibold text-ink">{scalarText(cell.value)}</span>
        </PulseValue>
        {cell.address ? (
          <span className="font-mono text-[10px] text-ink-faint">{cell.address}</span>
        ) : null}
      </span>
    </div>
  );
}

function PointerRow({ cell }: { cell: PointerCell }) {
  const ref = useAnchorRef(cell.id);
  const { activeId } = useMemoryRender();
  const active = activeId === cell.id;
  const held = cell.target === null ? 'NULL' : (cell.display ?? cell.target);
  return (
    <div
      ref={ref}
      data-coach-anchor={cell.id}
      title={`${cell.type} ${cell.name} → ${held}`}
      className={`flex items-center justify-between gap-3 rounded-md border border-l-2 bg-pointer-soft px-3 py-1.5 ${
        active
          ? 'border-active border-l-pointer ring-1 ring-active'
          : 'border-hairline border-l-pointer'
      }`}
    >
      <span className="flex items-baseline gap-1.5">
        <span className="font-mono text-sm text-ink">{cell.name}</span>
        <span className="font-mono text-[11px] text-pointer">{cell.type}</span>
        {active ? <ActiveBadge /> : null}
      </span>
      <span className="font-mono text-sm font-semibold text-pointer">{held}</span>
    </div>
  );
}

function ArrayCellView({ cell }: { cell: ArrayCell }) {
  // The container does NOT claim `cell.id` as an anchor — the array's summary row in the stack
  // frame owns that id. Here only the element ids register, so pointer arrows resolve to elements.
  const { activeId, targetedBy, pulsing } = useMemoryRender();
  return (
    <div className="inline-flex flex-col gap-1">
      {cell.name ? (
        <span className="font-mono text-[11px] text-ink-muted">
          {cell.name} <span className="text-ink-faint">{cell.type}</span>
        </span>
      ) : null}
      <div className="flex">
        {cell.elements.map((el, i) => (
          <ArrayElement
            key={el.id}
            cell={el}
            index={i}
            first={i === 0}
            active={activeId === el.id}
            pulsing={pulsing.has(el.id)}
            targetedBy={targetedBy.get(el.id) ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function ArrayElement({
  cell,
  index,
  first,
  active,
  pulsing,
  targetedBy,
}: {
  cell: Cell;
  index: number;
  first: boolean;
  active: boolean;
  pulsing: boolean;
  targetedBy: string[];
}) {
  const ref = useAnchorRef(cell.id);
  const value = cell.kind === 'scalar' ? scalarText(cell.value) : '';
  const address = cell.address;
  const pointed = targetedBy.length > 0;
  const nul = isNulTerminator(cell);
  const base = nul
    ? 'border-dashed border-hairline-strong bg-surface'
    : 'border-hairline bg-surface-2';
  return (
    <div
      ref={ref}
      data-coach-anchor={cell.id}
      title={`${cell.type} [${index}]${pointed ? ` ·${targetedBy.join(',')}` : ''} = ${value}${nul ? ' (NUL terminator)' : ''}${address ? ` @${address}` : ''}`}
      className={`flex w-20 flex-col items-center gap-0.5 border px-2 py-2 ${first ? '' : '-ml-px'} ${
        active
          ? 'z-10 border-active bg-active-soft ring-1 ring-active'
          : pointed
            ? 'z-10 border-pointer bg-pointer-soft'
            : base
      }`}
    >
      <span className="font-mono text-[10px] text-ink-faint">
        [{index}]{pointed ? <span className="text-pointer"> ·{targetedBy.join(',')}</span> : null}
      </span>
      <span
        className={`font-mono text-base font-semibold ${
          pulsing ? 'text-changed' : nul ? 'text-ink-muted' : 'text-ink'
        }`}
      >
        {value}
      </span>
      {address ? <span className="font-mono text-[10px] text-ink-faint">{address}</span> : null}
    </div>
  );
}

function StructCellView({ cell }: { cell: StructCell }) {
  const ref = useAnchorRef(cell.id);
  const { activeId } = useMemoryRender();
  const active = activeId === cell.id;
  return (
    <div
      ref={ref}
      data-coach-anchor={cell.id}
      className={`rounded-lg border bg-surface-2 p-2 ${active ? 'border-active ring-1 ring-active' : 'border-hairline'}`}
    >
      <div className="mb-1 flex items-center gap-1.5 px-1">
        <span className="font-mono text-xs text-ink">{cell.name}</span>
        <span className="font-mono text-[11px] text-ink-muted">{cell.type}</span>
        {cell.address ? (
          <span className="ml-auto font-mono text-[10px] text-ink-faint">{cell.address}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        {cell.fields.map((f) => (
          <CellView key={f.id} cell={f} />
        ))}
      </div>
    </div>
  );
}

/** Render any cell by dispatching on its `kind`. */
export function CellView({ cell }: { cell: Cell }) {
  switch (cell.kind) {
    case 'scalar':
      return <ScalarRow cell={cell} />;
    case 'pointer':
      return <PointerRow cell={cell} />;
    case 'array':
      return <ArrayCellView cell={cell} />;
    case 'struct':
      return <StructCellView cell={cell} />;
  }
}
