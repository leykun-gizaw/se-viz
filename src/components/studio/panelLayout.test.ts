import { describe, expect, it } from 'vitest';
import {
  clampWidth,
  collapse,
  COURSE_MAP,
  defaultState,
  expand,
  EXPLANATION,
  KEY_STEP,
  KEY_STEP_LARGE,
  keyboardResize,
  occupiedWidth,
  sanitizeState,
  STAGE_MIN_WIDTH,
  stateFromPixels,
  toggleCollapsed,
} from './panelLayout.ts';

const open = (width: number) => ({ width, collapsed: false });

describe('clampWidth', () => {
  it('clamps into [min, max] and rounds', () => {
    expect(clampWidth(COURSE_MAP, 10)).toBe(COURSE_MAP.minWidth);
    expect(clampWidth(COURSE_MAP, 10_000)).toBe(COURSE_MAP.maxWidth);
    expect(clampWidth(COURSE_MAP, 300.6)).toBe(301);
  });
  it('falls back to the default for non-finite input', () => {
    expect(clampWidth(EXPLANATION, Number.NaN)).toBe(EXPLANATION.defaultWidth);
    expect(clampWidth(EXPLANATION, Infinity)).toBe(EXPLANATION.defaultWidth);
  });
});

describe('keyboard resizing', () => {
  it('the course map (start side) grows with → and shrinks with ←', () => {
    expect(keyboardResize(COURSE_MAP, open(280), 'ArrowRight')).toEqual(open(280 + KEY_STEP));
    expect(keyboardResize(COURSE_MAP, open(280), 'ArrowLeft')).toEqual(open(280 - KEY_STEP));
  });

  it('the explanation panel (end side) grows with ← and shrinks with →', () => {
    expect(keyboardResize(EXPLANATION, open(340), 'ArrowLeft')).toEqual(open(340 + KEY_STEP));
    expect(keyboardResize(EXPLANATION, open(340), 'ArrowRight')).toEqual(open(340 - KEY_STEP));
  });

  it('Shift takes the larger step', () => {
    expect(keyboardResize(EXPLANATION, open(340), 'ArrowLeft', true)).toEqual(
      open(340 + KEY_STEP_LARGE),
    );
  });

  it('clamps at min and max instead of collapsing or overshooting', () => {
    const min = open(COURSE_MAP.minWidth);
    expect(keyboardResize(COURSE_MAP, min, 'ArrowLeft', true)).toEqual(min);
    const max = open(COURSE_MAP.maxWidth);
    expect(keyboardResize(COURSE_MAP, max, 'ArrowRight', true)).toEqual(max);
  });

  it('Home / End move the handle to the far left / right', () => {
    expect(keyboardResize(COURSE_MAP, open(300), 'Home')).toEqual(open(COURSE_MAP.minWidth));
    expect(keyboardResize(COURSE_MAP, open(300), 'End')).toEqual(open(COURSE_MAP.maxWidth));
    expect(keyboardResize(EXPLANATION, open(300), 'Home')).toEqual(open(EXPLANATION.maxWidth));
    expect(keyboardResize(EXPLANATION, open(300), 'End')).toEqual(open(EXPLANATION.minWidth));
  });

  it('Enter collapses, and Enter again restores the same width', () => {
    const collapsed = keyboardResize(EXPLANATION, open(400), 'Enter');
    expect(collapsed).toEqual({ width: 400, collapsed: true });
    expect(keyboardResize(EXPLANATION, collapsed!, 'Enter')).toEqual(open(400));
  });

  it('on a collapsed panel, the grow key restores it and the shrink key does nothing', () => {
    const c = { width: 320, collapsed: true };
    expect(keyboardResize(COURSE_MAP, c, 'ArrowRight')).toEqual(open(320));
    expect(keyboardResize(COURSE_MAP, c, 'ArrowLeft')).toEqual(c);
  });

  it('ignores keys that are not resize keys (they pass through)', () => {
    expect(keyboardResize(COURSE_MAP, open(280), 'ArrowUp')).toBeNull();
    expect(keyboardResize(COURSE_MAP, open(280), ' ')).toBeNull();
  });
});

describe('collapse and restore', () => {
  it('collapse keeps the width; expand restores it (clamped)', () => {
    const c = collapse(open(333));
    expect(c).toEqual({ width: 333, collapsed: true });
    expect(occupiedWidth(EXPLANATION, c)).toBe(EXPLANATION.railWidth);
    expect(expand(EXPLANATION, c)).toEqual(open(333));
    expect(expand(EXPLANATION, { width: 5, collapsed: true })).toEqual(open(EXPLANATION.minWidth));
  });

  it('toggle flips between the two', () => {
    expect(toggleCollapsed(COURSE_MAP, open(250))).toEqual({ width: 250, collapsed: true });
    expect(toggleCollapsed(COURSE_MAP, { width: 250, collapsed: true })).toEqual(open(250));
  });

  it('a drag that settles on the rail collapses (keeping the old width); otherwise records it', () => {
    expect(stateFromPixels(COURSE_MAP, open(300), COURSE_MAP.railWidth)).toEqual({
      width: 300,
      collapsed: true,
    });
    expect(stateFromPixels(COURSE_MAP, open(300), 351.4)).toEqual(open(351));
    expect(stateFromPixels(COURSE_MAP, open(300), 9999)).toEqual(open(COURSE_MAP.maxWidth));
  });
});

describe('persisted state', () => {
  it('sanitizes stored values: defaults for junk, clamps widths', () => {
    expect(sanitizeState(COURSE_MAP, null)).toEqual(defaultState(COURSE_MAP));
    expect(sanitizeState(COURSE_MAP, 'wide')).toEqual(defaultState(COURSE_MAP));
    expect(sanitizeState(COURSE_MAP, { width: 'x', collapsed: 'yes' })).toEqual(
      defaultState(COURSE_MAP),
    );
    expect(sanitizeState(COURSE_MAP, { width: 9999, collapsed: true })).toEqual({
      width: COURSE_MAP.maxWidth,
      collapsed: true,
    });
  });
});

describe('specs', () => {
  it('defaults are open and inside their own limits', () => {
    for (const spec of [COURSE_MAP, EXPLANATION]) {
      expect(spec.defaultCollapsed).toBe(false);
      expect(spec.defaultWidth).toBeGreaterThanOrEqual(spec.minWidth);
      expect(spec.defaultWidth).toBeLessThanOrEqual(spec.maxWidth);
      expect(spec.railWidth).toBeLessThan(spec.minWidth);
    }
  });

  it('a 1280px screen fits both default panels and a usable stage', () => {
    expect(1280 - COURSE_MAP.defaultWidth - EXPLANATION.defaultWidth).toBeGreaterThanOrEqual(
      STAGE_MIN_WIDTH,
    );
  });
});
