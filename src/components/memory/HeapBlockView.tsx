/**
 * A heap block / node, drawn in the data region with one of the four allocation states made
 * visually distinct (PDF screen 04 + legend):
 * - allocated → teal border + teal badge.
 * - freed     → desaturated + hatched, neutral "freed" badge.
 * - dangling  → red dashed border + hatched, red "⚠ dangling" badge (a pointer still aims here).
 * - leaked    → teal fill but amber border + red "⚠ leaked" badge, no incoming arrow.
 */
import { motion } from 'framer-motion';
import { useAnchorRef } from '../../engine/anchorContext.ts';
import type { AllocationState, HeapBlock } from '../../engine/trace/types.ts';
import { Tooltip } from '../Tooltip.tsx';
import { CellView } from './CellView.tsx';
import { useMemoryRender } from './renderContext.ts';

interface StateStyle {
  container: string;
  badge: string;
  badgeText: string;
  body: string;
}

function styleFor(state: AllocationState, active: boolean): StateStyle {
  const ring = active ? 'ring-1 ring-active' : '';
  switch (state) {
    case 'allocated':
      return {
        container: `border-heap ${ring}`,
        badge: 'bg-heap-soft text-heap',
        badgeText: '✓ allocated',
        body: '',
      };
    case 'freed':
      return {
        container: `border-hairline opacity-70 se-hatch ${ring}`,
        badge: 'bg-surface-3 text-ink-muted',
        badgeText: 'freed',
        body: 'text-ink-faint',
      };
    case 'dangling':
      return {
        container: `border-danger border-dashed se-hatch ${ring}`,
        badge: 'bg-danger-soft text-danger',
        badgeText: '⚠ dangling',
        body: 'text-ink-faint',
      };
    case 'leaked':
      return {
        container: `border-active ${ring}`,
        badge: 'bg-danger-soft text-danger',
        badgeText: '⚠ leaked',
        body: '',
      };
  }
}

export function HeapBlockView({ block }: { block: HeapBlock }) {
  const ref = useAnchorRef(block.id);
  const { activeId } = useMemoryRender();
  const active = activeId === block.id;
  const state: AllocationState = block.state ?? 'allocated';
  const s = styleFor(state, active);

  const detail = [
    block.label ?? 'block',
    block.type ?? '',
    block.address ? `@${block.address}` : '',
    `state: ${state}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
    >
      <Tooltip label={detail} placement="top">
        <div
          ref={ref}
          data-coach-anchor={block.id}
          className={`w-56 rounded-lg border bg-surface ${s.container}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-1.5">
            <span className="font-mono text-[11px] font-semibold tracking-wide text-heap">
              {block.label ?? 'BLOCK'}
            </span>
            <span className="flex items-center gap-2">
              {block.address ? (
                <span className="font-mono text-[10px] text-ink-faint">{block.address}</span>
              ) : null}
              <span
                className={`rounded-sm px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wide ${s.badge}`}
              >
                {s.badgeText}
              </span>
            </span>
          </div>
          <div className={`flex flex-col gap-1 p-2 ${s.body}`}>
            {block.cells.map((c) => (
              <CellView key={c.id} cell={c} />
            ))}
          </div>
        </div>
      </Tooltip>
    </motion.div>
  );
}
