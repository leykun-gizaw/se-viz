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

/**
 * Place the bubble adjacent to `anchor` with a tail pointing at it, **collision-aware**: prefer the
 * right of the anchor, then left, then below, then above — whichever fits in `container` without
 * covering the anchor — then clamp the bubble inside the container. The tail offset is positioned at
 * the anchor's center along the chosen edge.
 *
 * @param anchor - The anchored element's rect (container-local).
 * @param container - The available area (the stage content box).
 * @param bubble - The bubble's measured size.
 * @param gap - Pixel gap between anchor and bubble.
 */
export function placeCoachBubble(
  anchor: Rect,
  container: { width: number; height: number },
  bubble: { width: number; height: number },
  gap = 12,
): BubblePlacement {
  const inset = 8;
  const tailInset = 16;
  const cx = anchor.x + anchor.width / 2;
  const cy = anchor.y + anchor.height / 2;

  const fitsRight = anchor.x + anchor.width + gap + bubble.width <= container.width;
  const fitsLeft = anchor.x - gap - bubble.width >= 0;
  const fitsBelow = anchor.y + anchor.height + gap + bubble.height <= container.height;

  let tail: TailSide;
  let left: number;
  let top: number;
  if (fitsRight) {
    tail = 'left';
    left = anchor.x + anchor.width + gap;
    top = cy - bubble.height / 2;
  } else if (fitsLeft) {
    tail = 'right';
    left = anchor.x - gap - bubble.width;
    top = cy - bubble.height / 2;
  } else if (fitsBelow) {
    tail = 'top';
    left = cx - bubble.width / 2;
    top = anchor.y + anchor.height + gap;
  } else {
    tail = 'bottom';
    left = cx - bubble.width / 2;
    top = anchor.y - gap - bubble.height;
  }

  left = clamp(left, inset, container.width - bubble.width - inset);
  top = clamp(top, inset, container.height - bubble.height - inset);

  const tailOffset =
    tail === 'left' || tail === 'right'
      ? clamp(cy - top, tailInset, bubble.height - tailInset)
      : clamp(cx - left, tailInset, bubble.width - tailInset);

  return { left, top, tail, tailOffset };
}

/** Consistent fallback spot (top-right, beside the canvas) when there is no anchor. */
export function fallbackPlacement(
  container: { width: number; height: number },
  bubble: { width: number; height: number },
  inset = 16,
): { left: number; top: number } {
  return {
    left: Math.max(inset, container.width - bubble.width - inset),
    top: inset,
  };
}
