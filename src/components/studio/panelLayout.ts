/**
 * Studio side-panel layout state (Phase 28) — the pure rules behind the course map and the step
 * explanation panel: width limits, keyboard resizing, collapse to a rail and restore, and reading
 * persisted state safely. React-free so it can be unit-tested; `useSidePanel` wires it to
 * `react-resizable-panels` and `usePersistentState`.
 *
 * Widths are CSS pixels. A side panel's width is the width it **restores to**: collapsing keeps it,
 * so expanding brings the panel back exactly as wide as it was.
 *
 * @packageDocumentation
 */

/** Which edge of the stage a side panel sits on. Decides which arrow key grows it. */
export type PanelSide = 'start' | 'end';

export interface SidePanelSpec {
  /** Stable id: the Panel id and the persistence key suffix. */
  id: string;
  side: PanelSide;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** Width of the collapsed rail. */
  railWidth: number;
  defaultCollapsed: boolean;
}

export interface SidePanelState {
  /** Expanded width (kept while collapsed, so restore is exact). */
  width: number;
  collapsed: boolean;
}

/** Arrow-key resize step, and the larger step with Shift held. */
export const KEY_STEP = 16;
export const KEY_STEP_LARGE = 64;

/** The stage (code + memory) never gets narrower than this while side panels are open. */
export const STAGE_MIN_WIDTH = 440;

/** The course map (left). */
export const COURSE_MAP: SidePanelSpec = {
  id: 'course-map',
  side: 'start',
  defaultWidth: 280,
  minWidth: 220,
  maxWidth: 440,
  railWidth: 44,
  defaultCollapsed: false,
};

/** The step explanation panel (right). */
export const EXPLANATION: SidePanelSpec = {
  id: 'explanation',
  side: 'end',
  defaultWidth: 340,
  minWidth: 280,
  maxWidth: 560,
  railWidth: 44,
  defaultCollapsed: false,
};

/** Clamp a width into the spec's range (non-finite values fall back to the default). */
export function clampWidth(spec: SidePanelSpec, width: number): number {
  if (!Number.isFinite(width)) return spec.defaultWidth;
  return Math.round(Math.min(Math.max(width, spec.minWidth), spec.maxWidth));
}

export function defaultState(spec: SidePanelSpec): SidePanelState {
  return { width: spec.defaultWidth, collapsed: spec.defaultCollapsed };
}

/**
 * Turn whatever was persisted (possibly from an older build, hand-edited, or corrupt) into a valid
 * state. Unknown shapes fall back to the defaults; a stored width is clamped into range.
 */
export function sanitizeState(spec: SidePanelSpec, raw: unknown): SidePanelState {
  if (typeof raw !== 'object' || raw === null) return defaultState(spec);
  const r = raw as Record<string, unknown>;
  const width = typeof r.width === 'number' ? clampWidth(spec, r.width) : spec.defaultWidth;
  const collapsed = typeof r.collapsed === 'boolean' ? r.collapsed : spec.defaultCollapsed;
  return { width, collapsed };
}

export function collapse(state: SidePanelState): SidePanelState {
  return state.collapsed ? state : { ...state, collapsed: true };
}

export function expand(spec: SidePanelSpec, state: SidePanelState): SidePanelState {
  return { width: clampWidth(spec, state.width), collapsed: false };
}

export function toggleCollapsed(spec: SidePanelSpec, state: SidePanelState): SidePanelState {
  return state.collapsed ? expand(spec, state) : collapse(state);
}

/** Set an expanded width (from a drag or a keyboard step), clamped. */
export function resizeTo(spec: SidePanelSpec, width: number): SidePanelState {
  return { width: clampWidth(spec, width), collapsed: false };
}

/**
 * The size the panel should currently occupy: its rail when collapsed, else its width.
 */
export function occupiedWidth(spec: SidePanelSpec, state: SidePanelState): number {
  return state.collapsed ? spec.railWidth : clampWidth(spec, state.width);
}

/**
 * A key press on the panel's resize handle, or `null` when the key isn't a resize key (let it
 * through). Keys move the **handle**, so their effect depends on the panel's side:
 * - ←/→ move the handle by {@link KEY_STEP} (Shift: {@link KEY_STEP_LARGE}). On the course map
 *   (start side) → grows it; on the explanation panel (end side) ← grows it. Widths clamp to the
 *   spec's min/max; shrinking stops at the minimum (Enter collapses).
 * - Home / End move the handle all the way left / right (to the min or max width).
 * - Enter collapses an open panel or restores a collapsed one.
 * A grow key on a collapsed panel restores it; a shrink key on a collapsed panel does nothing.
 */
export function keyboardResize(
  spec: SidePanelSpec,
  state: SidePanelState,
  key: string,
  shift = false,
): SidePanelState | null {
  const step = shift ? KEY_STEP_LARGE : KEY_STEP;
  const growKey = spec.side === 'start' ? 'ArrowRight' : 'ArrowLeft';
  const shrinkKey = spec.side === 'start' ? 'ArrowLeft' : 'ArrowRight';
  // Home moves the handle to the far left: the start panel shrinks, the end panel grows.
  const homeWidth = spec.side === 'start' ? spec.minWidth : spec.maxWidth;
  const endWidth = spec.side === 'start' ? spec.maxWidth : spec.minWidth;

  switch (key) {
    case 'Enter':
      return toggleCollapsed(spec, state);
    case growKey:
      return state.collapsed ? expand(spec, state) : resizeTo(spec, state.width + step);
    case shrinkKey:
      return state.collapsed ? state : resizeTo(spec, state.width - step);
    case 'Home':
      return resizeTo(spec, homeWidth);
    case 'End':
      return resizeTo(spec, endWidth);
    default:
      return null;
  }
}

/**
 * Read a pixel width back from the library's panel size, deciding whether the panel is collapsed
 * (at or within a pixel of its rail). Used after a pointer drag settles.
 */
export function stateFromPixels(
  spec: SidePanelSpec,
  prev: SidePanelState,
  pixels: number,
): SidePanelState {
  if (pixels <= spec.railWidth + 1) return collapse(prev);
  return resizeTo(spec, pixels);
}
