import { describe, expect, it } from 'vitest';
import {
  advanceBeat,
  beatLabel,
  canAdvance,
  canReverse,
  clampToMode,
  initialPosition,
  resolveBeatRender,
  reverseBeat,
  viewSupportsBeats,
  type BeatPosition,
  type SteppingMode,
} from './beats.ts';

/** Walk advanceBeat from the start to the end, collecting the positions visited. */
function fullForward(total: number, mode: SteppingMode): BeatPosition[] {
  const seq: BeatPosition[] = [initialPosition(mode)];
  let pos = seq[0];
  while (canAdvance(pos, total, mode)) {
    pos = advanceBeat(pos, total, mode);
    seq.push(pos);
  }
  return seq;
}

describe('two-beat advance/reverse sequence', () => {
  it('produces arrive→apply→arrive… for a 3-step trace', () => {
    expect(fullForward(3, 'two-beat')).toEqual([
      { step: 0, beat: 'arrive' },
      { step: 0, beat: 'apply' },
      { step: 1, beat: 'arrive' },
      { step: 1, beat: 'apply' },
      { step: 2, beat: 'arrive' },
      { step: 2, beat: 'apply' },
    ]);
  });

  it('reverse is the exact inverse of advance (symmetry)', () => {
    const forward = fullForward(3, 'two-beat');
    // Reversing from the last position should retrace the forward sequence backwards.
    const back: BeatPosition[] = [forward[forward.length - 1]];
    let pos = back[0];
    while (canReverse(pos, 'two-beat')) {
      pos = reverseBeat(pos, 'two-beat');
      back.push(pos);
    }
    expect(back).toEqual([...forward].reverse());
  });

  it('clamps at both ends', () => {
    const start: BeatPosition = { step: 0, beat: 'arrive' };
    expect(canReverse(start, 'two-beat')).toBe(false);
    expect(reverseBeat(start, 'two-beat')).toEqual(start);
    const end: BeatPosition = { step: 2, beat: 'apply' };
    expect(canAdvance(end, 3, 'two-beat')).toBe(false);
    expect(advanceBeat(end, 3, 'two-beat')).toEqual(end);
  });
});

describe('single-beat mode', () => {
  it('moves a whole step per advance and is always on apply', () => {
    expect(fullForward(3, 'single')).toEqual([
      { step: 0, beat: 'apply' },
      { step: 1, beat: 'apply' },
      { step: 2, beat: 'apply' },
    ]);
  });
});

describe('resolveBeatRender — pre/post snapshots', () => {
  it('arrive renders the previous snapshot diffed against itself (no pulse)', () => {
    expect(resolveBeatRender({ step: 3, beat: 'arrive' }, 'two-beat')).toEqual({
      displayIndex: 2,
      diffPrevIndex: 2,
    });
  });
  it('arrive(0) renders the empty pre-state (-1)', () => {
    expect(resolveBeatRender({ step: 0, beat: 'arrive' }, 'two-beat')).toEqual({
      displayIndex: -1,
      diffPrevIndex: -1,
    });
  });
  it('apply renders step n diffed against n-1 (the change pulses)', () => {
    expect(resolveBeatRender({ step: 3, beat: 'apply' }, 'two-beat')).toEqual({
      displayIndex: 3,
      diffPrevIndex: 2,
    });
  });
  it('single mode always renders the applied step', () => {
    expect(resolveBeatRender({ step: 3, beat: 'apply' }, 'single')).toEqual({
      displayIndex: 3,
      diffPrevIndex: 2,
    });
  });
});

describe('mode helpers', () => {
  it('collapsing to single snaps to the applied step', () => {
    expect(clampToMode({ step: 4, beat: 'arrive' }, 'single')).toEqual({ step: 4, beat: 'apply' });
  });
  it('expanding to two-beat keeps the position', () => {
    expect(clampToMode({ step: 4, beat: 'apply' }, 'two-beat')).toEqual({ step: 4, beat: 'apply' });
  });
  it('labels the beat for the counter', () => {
    expect(beatLabel({ step: 1, beat: 'arrive' }, 'two-beat')).toBe('about to run');
    expect(beatLabel({ step: 1, beat: 'apply' }, 'two-beat')).toBe('ran');
    expect(beatLabel({ step: 1, beat: 'apply' }, 'single')).toBe('');
  });
  it('only memory and dual-trace views support beats', () => {
    expect(viewSupportsBeats(undefined)).toBe(true);
    expect(viewSupportsBeats('memory')).toBe(true);
    expect(viewSupportsBeats('dual-trace')).toBe(true);
    expect(viewSupportsBeats('pipeline')).toBe(false);
    expect(viewSupportsBeats('before-after')).toBe(false);
  });
});
