/**
 * Coach-note presentation logic (Phase 17) — pure, React-free helpers for the coach bubble: which
 * beat a note shows on, the per-variant styling tokens, and collision-aware bubble placement against
 * an anchor rect. Kept independent of Phase 16 (the beat is passed as a plain string | undefined) so
 * this degrades gracefully when two-beat stepping isn't present.
 *
 * @packageDocumentation
 */

import type { CoachNote, CoachVariant } from './types.ts';

/**
 * Whether a note should be visible for the current beat. With no two-beat stepping (`beat`
 * undefined) the note always shows on its step; otherwise it shows on the beat it targets
 * (`note.beat`, default `apply`).
 *
 * @param note - The coach note.
 * @param beat - The active beat, or `undefined` when two-beat stepping is not present.
 */
export function coachVisibleOnBeat(note: CoachNote, beat: 'arrive' | 'apply' | undefined): boolean {
  if (beat === undefined) return true;
  return beat === (note.beat ?? 'apply');
}

/** Tailwind token classes for a variant (built only from existing design tokens — no restyle). */
export interface CoachVariantMeta {
  /** Human label shown in the bubble header. */
  label: string;
  /** Accent text color class. */
  accentText: string;
  /** Accent border color class. */
  accentBorder: string;
  /** Accent soft-fill class for the icon badge. */
  accentBg: string;
}

/**
 * Per-variant styling, mapped to existing tokens per the design decision:
 * `idea` neutral/info, `watch-out` amber, `predict` azure, `recap` teal — legible in both themes.
 */
export const COACH_VARIANT_META: Record<CoachVariant, CoachVariantMeta> = {
  idea: {
    label: 'Idea',
    accentText: 'text-ink',
    accentBorder: 'border-hairline-strong',
    accentBg: 'bg-surface-3',
  },
  'watch-out': {
    label: 'Watch out',
    accentText: 'text-active',
    accentBorder: 'border-active',
    accentBg: 'bg-active-soft',
  },
  predict: {
    label: 'Predict',
    accentText: 'text-pointer',
    accentBorder: 'border-pointer',
    accentBg: 'bg-pointer-soft',
  },
  recap: {
    label: 'Recap',
    accentText: 'text-heap',
    accentBorder: 'border-heap',
    accentBg: 'bg-heap-soft',
  },
};

export function coachVariantMeta(variant: CoachVariant): CoachVariantMeta {
  return COACH_VARIANT_META[variant];
}

/** A rectangle in container-local coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which edge of the bubble the tail sits on (so it points back at the anchor). */
export type TailSide = 'left' | 'right' | 'top' | 'bottom';

/** Computed bubble placement: top-left in container coords, plus where the tail attaches. */
export interface BubblePlacement {
  left: number;
  top: number;
  tail: TailSide;
  /** Offset of the tail along its edge (px from the bubble's top-left corner), clamped to stay on. */
  tailOffset: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

/** Area of the intersection between a placed bubble and an obstacle rect (0 if disjoint). */
function overlapArea(
  box: { left: number; top: number; width: number; height: number },
  o: Rect,
): number {
  const x = Math.max(0, Math.min(box.left + box.width, o.x + o.width) - Math.max(box.left, o.x));
  const y = Math.max(0, Math.min(box.top + box.height, o.y + o.height) - Math.max(box.top, o.y));
  return x * y;
}

const INSET = 8;
const TAIL_INSET = 16;

/** Build the placement for one candidate side, clamped inside the container. */
function sidePlacement(
  side: TailSide,
  anchor: Rect,
  container: { width: number; height: number },
  bubble: { width: number; height: number },
  gap: number,
): BubblePlacement {
  const cx = anchor.x + anchor.width / 2;
  const cy = anchor.y + anchor.height / 2;
  let left: number;
  let top: number;
  // `side` is the edge of the bubble the tail sits on, i.e. the side of the anchor it's placed on:
  // tail 'left' → bubble to the right, 'top' → bubble below, etc.
  if (side === 'left') {
    left = anchor.x + anchor.width + gap;
    top = cy - bubble.height / 2;
  } else if (side === 'right') {
    left = anchor.x - gap - bubble.width;
    top = cy - bubble.height / 2;
  } else if (side === 'top') {
    left = cx - bubble.width / 2;
    top = anchor.y + anchor.height + gap;
  } else {
    left = cx - bubble.width / 2;
    top = anchor.y - gap - bubble.height;
  }
  left = clamp(left, INSET, container.width - bubble.width - INSET);
  top = clamp(top, INSET, container.height - bubble.height - INSET);
  const tailOffset =
    side === 'left' || side === 'right'
      ? clamp(cy - top, TAIL_INSET, bubble.height - TAIL_INSET)
      : clamp(cx - left, TAIL_INSET, bubble.width - TAIL_INSET);
  return { left, top, tail: side, tailOffset };
}

/**
 * Place the bubble adjacent to `anchor` with a tail pointing at it, **collision-aware against the
 * whole visualization**: it tries the right of the anchor, then left, then below, then above, and
 * picks the side that covers the fewest other elements (`obstacles`, in container coords). The anchor
 * itself is always treated as an obstacle, so the bubble never sits on top of the thing it points at;
 * ties prefer the earlier side. Each candidate is clamped inside the container.
 *
 * @param anchor - The anchored element's rect (container-local).
 * @param container - The available area (the stage content box).
 * @param bubble - The bubble's measured size.
 * @param obstacles - Other visual element rects to avoid covering (cells, frames, heap blocks).
 * @param gap - Pixel gap between anchor and bubble.
 */
export function placeCoachBubble(
  anchor: Rect,
  container: { width: number; height: number },
  bubble: { width: number; height: number },
  obstacles: Rect[] = [],
  gap = 12,
): BubblePlacement {
  const all: Rect[] = [
    { x: anchor.x, y: anchor.y, width: anchor.width, height: anchor.height },
    ...obstacles,
  ];
  const sides: TailSide[] = ['left', 'right', 'top', 'bottom']; // right · left · below · above
  let best: BubblePlacement | null = null;
  let bestScore = Infinity;
  for (const side of sides) {
    const p = sidePlacement(side, anchor, container, bubble, gap);
    const box = { left: p.left, top: p.top, width: bubble.width, height: bubble.height };
    let score = 0;
    for (const o of all) score += overlapArea(box, o);
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best ?? sidePlacement('left', anchor, container, bubble, gap);
}

/**
 * Fallback spot when there is no anchor: the corner (preferring top-right) that covers the fewest
 * obstacles, so a fallback bubble doesn't sit on top of the view either.
 */
export function fallbackPlacement(
  container: { width: number; height: number },
  bubble: { width: number; height: number },
  obstacles: Rect[] = [],
  inset = 16,
): { left: number; top: number } {
  const right = Math.max(inset, container.width - bubble.width - inset);
  const bottom = Math.max(inset, container.height - bubble.height - inset);
  const corners = [
    { left: right, top: inset },
    { left: inset, top: inset },
    { left: right, top: bottom },
    { left: inset, top: bottom },
  ];
  let best = corners[0];
  let bestScore = Infinity;
  for (const c of corners) {
    const box = { left: c.left, top: c.top, width: bubble.width, height: bubble.height };
    let score = 0;
    for (const o of obstacles) score += overlapArea(box, o);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
