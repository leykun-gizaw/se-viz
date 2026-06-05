/**
 * Autoplay timing — kept as pure functions, separate from React, so the advance logic is unit
 * testable without timers or a DOM. {@link useTrace} wires these into an effect.
 *
 * @packageDocumentation
 */

/** A selectable playback speed: a human label and the per-step interval in milliseconds. */
export interface PlaybackSpeed {
  label: string;
  ms: number;
}

/** The speed options shown in the transport, slowest → fastest. `1×` is the default. */
export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [
  { label: '0.5×', ms: 1800 },
  { label: '1×', ms: 1000 },
  { label: '1.5×', ms: 680 },
  { label: '2×', ms: 450 },
] as const;

/** Index of the default speed (`1×`) within {@link PLAYBACK_SPEEDS}. */
export const DEFAULT_SPEED_INDEX = 1;

/** Result of an autoplay tick: where to move and whether playback should continue. */
export interface AutoplayTick {
  /** The next step index. */
  index: number;
  /** Whether autoplay should keep running after this tick (false once the end is reached). */
  playing: boolean;
}

/**
 * Compute the next autoplay state from the current index.
 *
 * Advancing from index `i` (with `total` steps) goes to `i + 1`. When the result is the final
 * index the tick still lands there, but `playing` becomes `false` so autoplay stops *at* the end
 * rather than looping. Calling it when already at the end is a no-op stop.
 *
 * @param index - Current zero-based step index.
 * @param total - Total number of steps (`>= 1`).
 * @returns The next {@link AutoplayTick}.
 */
export function autoplayTick(index: number, total: number): AutoplayTick {
  const last = total - 1;
  if (index >= last) {
    return { index: last, playing: false };
  }
  const nextIndex = index + 1;
  return { index: nextIndex, playing: nextIndex < last };
}
