import { describe, expect, it } from 'vitest';
import { autoplayTick, PLAYBACK_SPEEDS, DEFAULT_SPEED_INDEX } from './autoplay.ts';

describe('autoplayTick', () => {
  it('advances one step and keeps playing in the middle of a trace', () => {
    expect(autoplayTick(0, 5)).toEqual({ index: 1, playing: true });
    expect(autoplayTick(2, 5)).toEqual({ index: 3, playing: true });
  });

  it('lands on the final step but stops playing when reaching the end', () => {
    expect(autoplayTick(3, 5)).toEqual({ index: 4, playing: false });
  });

  it('is a no-op stop once already at the end', () => {
    expect(autoplayTick(4, 5)).toEqual({ index: 4, playing: false });
  });

  it('does not run past a single-step trace', () => {
    expect(autoplayTick(0, 1)).toEqual({ index: 0, playing: false });
  });

  it('exposes a valid default speed', () => {
    expect(PLAYBACK_SPEEDS[DEFAULT_SPEED_INDEX].label).toBe('1×');
    expect(PLAYBACK_SPEEDS.every((s) => s.ms > 0)).toBe(true);
  });
});
