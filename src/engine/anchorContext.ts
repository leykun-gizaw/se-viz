/**
 * Anchor registry context, types, and hooks (the non-component half of the anchor system; the
 * provider lives in `anchors.tsx`). Splitting these out keeps the provider file component-only so
 * React Fast Refresh stays happy.
 *
 * @packageDocumentation
 */

import { createContext, useContext } from 'react';

/** A rectangle in canvas-local coordinates (origin = canvas top-left). */
export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The registry API shared via context. */
export interface AnchorRegistry {
  /** Ref callback for the canvas container; all anchors are measured relative to it. */
  setCanvas: (el: HTMLDivElement | null) => void;
  /** Returns a stable ref callback that registers/unregisters a DOM node under `id`. */
  anchorRef: (id: string) => (el: HTMLElement | null) => void;
  /** Resolve an id to its current canvas-local rect, or `null` if unknown/unmounted. */
  getAnchor: (id: string) => Anchor | null;
  /** Monotonic counter that bumps whenever layout may have changed; overlay re-measures on change. */
  version: number;
  /** Re-measure repeatedly for ~`ms` (used after a step change to track spring animations). */
  pulse: (ms?: number) => void;
}

export const AnchorContext = createContext<AnchorRegistry | null>(null);

/** Access the {@link AnchorRegistry}. Must be used within an `AnchorProvider`. */
export function useAnchors(): AnchorRegistry {
  const ctx = useContext(AnchorContext);
  if (!ctx) throw new Error('useAnchors must be used within an AnchorProvider');
  return ctx;
}

/** Convenience: a ref callback registering this node under `id`. */
export function useAnchorRef(id: string): (el: HTMLElement | null) => void {
  const { anchorRef } = useAnchors();
  return anchorRef(id);
}
