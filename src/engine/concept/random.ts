/**
 * Seeded random numbers for the Phase 37 concept-view generators. The same seed always gives the
 * same sequence, so a generated trace is deterministic (and testable) without storing it as data.
 *
 * @packageDocumentation
 */

/** A source of uniform numbers in `[0, 1)`. */
export type Rng = () => number;

/** mulberry32: a small, fast 32-bit generator. Good enough for teaching simulations. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in `lo..hi` (inclusive). */
export const randInt = (rng: Rng, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));

/** A Fisher–Yates shuffle of a copy of `items`. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `n` distinct whole numbers drawn from `lo..hi`, in random order. */
export function distinctInts(rng: Rng, n: number, lo: number, hi: number): number[] {
  const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return shuffled(rng, pool).slice(0, n);
}
