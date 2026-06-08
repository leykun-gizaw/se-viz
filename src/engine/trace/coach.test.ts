import { describe, expect, it } from 'vitest';
import type { CoachNote } from './types.ts';
import {
  COACH_VARIANT_META,
  coachVariantMeta,
  coachVisibleOnBeat,
  fallbackPlacement,
  placeCoachBubble,
  type Rect,
} from './coach.ts';

const note = (over: Partial<CoachNote> = {}): CoachNote => ({
  variant: 'idea',
  body: 'b',
  ...over,
});

describe('coachVisibleOnBeat', () => {
  it('always shows when there is no two-beat stepping', () => {
    expect(coachVisibleOnBeat(note(), undefined)).toBe(true);
    expect(coachVisibleOnBeat(note({ beat: 'arrive' }), undefined)).toBe(true);
  });
  it('shows a predict note on arrive and an explanation on apply', () => {
    expect(coachVisibleOnBeat(note({ beat: 'arrive' }), 'arrive')).toBe(true);
    expect(coachVisibleOnBeat(note({ beat: 'arrive' }), 'apply')).toBe(false);
    expect(coachVisibleOnBeat(note({ beat: 'apply' }), 'apply')).toBe(true);
  });
  it('defaults to the apply beat', () => {
    expect(coachVisibleOnBeat(note(), 'apply')).toBe(true);
    expect(coachVisibleOnBeat(note(), 'arrive')).toBe(false);
  });
});

describe('coachVariantMeta', () => {
  it('maps all four variants to distinct accent tokens', () => {
    const accents = (['idea', 'watch-out', 'predict', 'recap'] as const).map(
      (v) => coachVariantMeta(v).accentText,
    );
    expect(new Set(accents).size).toBe(4);
    expect(COACH_VARIANT_META['watch-out'].accentBorder).toContain('active');
    expect(COACH_VARIANT_META.predict.accentBorder).toContain('pointer');
    expect(COACH_VARIANT_META.recap.accentBorder).toContain('heap');
  });
});

describe('placeCoachBubble — collision-aware', () => {
  const container = { width: 1000, height: 600 };
  const bubble = { width: 240, height: 120 };

  it('places to the right of an anchor with room, tail on the left', () => {
    const anchor: Rect = { x: 100, y: 250, width: 120, height: 40 };
    const p = placeCoachBubble(anchor, container, bubble);
    expect(p.tail).toBe('left');
    expect(p.left).toBe(anchor.x + anchor.width + 12);
    // vertically centered on the anchor
    expect(p.top).toBeCloseTo(anchor.y + anchor.height / 2 - bubble.height / 2);
  });

  it('flips to the left when there is no room on the right', () => {
    const anchor: Rect = { x: 850, y: 250, width: 120, height: 40 };
    const p = placeCoachBubble(anchor, container, bubble);
    expect(p.tail).toBe('right');
    expect(p.left).toBe(anchor.x - 12 - bubble.width);
  });

  it('goes below when neither side fits', () => {
    const narrow = { width: 300, height: 600 };
    const anchor: Rect = { x: 30, y: 100, width: 240, height: 30 };
    const p = placeCoachBubble(anchor, narrow, bubble);
    expect(p.tail).toBe('top');
    expect(p.top).toBe(anchor.y + anchor.height + 12);
  });

  it('clamps the bubble inside the container and keeps the tail on the bubble', () => {
    const anchor: Rect = { x: 100, y: 0, width: 120, height: 10 };
    const p = placeCoachBubble(anchor, container, bubble);
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.tailOffset).toBeGreaterThanOrEqual(16);
    expect(p.tailOffset).toBeLessThanOrEqual(bubble.height - 16);
  });

  it('avoids covering another element: a box to the right pushes the bubble below', () => {
    const anchor: Rect = { x: 100, y: 250, width: 100, height: 40 };
    // A sibling node just to the right, where the default right placement would land.
    const sibling: Rect = { x: 215, y: 240, width: 200, height: 55 };
    const p = placeCoachBubble(anchor, container, bubble, [sibling]);
    expect(p.tail).toBe('top'); // tail on top ⇒ bubble sits below the anchor, clear of the sibling
  });
});

describe('fallbackPlacement', () => {
  it('sits in the top-right corner', () => {
    const p = fallbackPlacement({ width: 1000, height: 600 }, { width: 240, height: 120 });
    expect(p).toEqual({ left: 1000 - 240 - 16, top: 16 });
  });
});
