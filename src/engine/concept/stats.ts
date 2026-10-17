/**
 * Small statistics helpers for the Phase 37 distribution generators, and the number formatting the
 * generated explanations share (so the text and the state are rounded the same way).
 *
 * @packageDocumentation
 */
import type { DistributionBin } from '../trace/types.ts';

export const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Mean, (population) standard deviation and skewness of `xs` (needs at least two values). */
export function describe(xs: readonly number[]): { mean: number; sd: number; skewness: number } {
  const m = mean(xs);
  let m2 = 0;
  let m3 = 0;
  for (const x of xs) {
    const d = x - m;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= xs.length;
  m3 /= xs.length;
  const sd = Math.sqrt(m2);
  return { mean: m, sd, skewness: sd === 0 ? 0 : m3 / sd ** 3 };
}

/** `count` empty bins of equal width covering `[lo, hi)`. */
export function emptyBins(lo: number, hi: number, count: number): DistributionBin[] {
  const w = (hi - lo) / count;
  return Array.from({ length: count }, (_, i) => ({
    from: round(lo + i * w, 6),
    to: round(lo + (i + 1) * w, 6),
    count: 0,
  }));
}

/** The index of the bin `[from, to)` holding `x` (values past either end go to the end bins). */
export function binIndex(bins: readonly DistributionBin[], x: number): number {
  const lo = bins[0].from;
  const w = (bins[bins.length - 1].to - lo) / bins.length;
  return Math.min(bins.length - 1, Math.max(0, Math.floor((x - lo) / w)));
}

export const round = (x: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** `x` with a fixed number of decimals, and a true minus sign for negatives. */
export const fixed = (x: number, digits: number): string => {
  const s = round(x, digits).toFixed(digits);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s.replace(/^-/, '−');
};

/** A whole number with thousands separators: `1,000`. */
export const count = (n: number): string => n.toLocaleString('en-US');
