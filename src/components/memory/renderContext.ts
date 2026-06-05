/**
 * Per-step render state shared across the memory subtree (frames, cells, heap blocks), so leaf
 * components can show the green value-pulse, the amber active ring, and pointer-target labels
 * without prop-drilling. All of it is derived from the diff between the previous and current step.
 *
 * @packageDocumentation
 */

import { createContext, useContext } from 'react';

/** Render flags for the current step. */
export interface MemoryRenderState {
  /** Cell ids whose scalar value changed this step (green pulse). From `pulsedCellIds`. */
  pulsing: Set<string>;
  /** Pointer cell ids whose target changed this step (arrow glide). From `retargetedPointerIds`. */
  retargeted: Set<string>;
  /** Id of the single active element this step (amber ring + badge), if any. */
  activeId?: string | undefined;
  /** target id → names of pointer cells aimed at it (used for array-element `·p` labels). */
  targetedBy: Map<string, string[]>;
  /** Current step index — used as a React key so pulse animations re-fire each step. */
  stepIndex: number;
}

const DEFAULT: MemoryRenderState = {
  pulsing: new Set(),
  retargeted: new Set(),
  targetedBy: new Map(),
  stepIndex: 0,
};

export const MemoryRenderContext = createContext<MemoryRenderState>(DEFAULT);

/** Access the current-step memory render state. */
export function useMemoryRender(): MemoryRenderState {
  return useContext(MemoryRenderContext);
}
