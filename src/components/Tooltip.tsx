/**
 * A lightweight, CSS-only hover tooltip (no JS state) for revealing an entity's detail on hover —
 * the affordance from the design ("hover a frame to list its locals; hover a node/cell for its
 * type, value, and address"). Uses a named Tailwind group so nested tooltips don't trigger each
 * other.
 */
import type { ReactNode } from 'react';

export interface TooltipProps {
  /** Tooltip body. Newlines are preserved (`whitespace-pre-line`). */
  label: ReactNode;
  /** Where the popover sits relative to the trigger. */
  placement?: 'top' | 'bottom';
  children: ReactNode;
  className?: string;
}

export function Tooltip({ label, placement = 'bottom', children, className }: TooltipProps) {
  const pos =
    placement === 'top'
      ? 'bottom-full mb-1.5 group-hover/tip:translate-y-0 -translate-y-1'
      : 'top-full mt-1.5 group-hover/tip:translate-y-0 translate-y-1';
  return (
    <div className={`group/tip relative ${className ?? ''}`}>
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-30 hidden -translate-x-1/2 ${pos} w-max max-w-xs whitespace-pre-line rounded-md border border-hairline-strong bg-surface-3 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-ink group-hover/tip:block`}
      >
        {label}
      </div>
    </div>
  );
}
