/**
 * The limits a presenter can set for a live Python run (Phase 31): steps (default 1000, max 5000),
 * wall clock (default 10 s) and output lines. Stored in `localStorage`, so every read is
 * re-validated: a hand-edited or stale value is clamped or falls back to the default.
 *
 * Fixed for live runs (not editable): a 100-frame recursion cap, below the recorder's default of
 * 200, because each snapshot restates every frame (deep recursion was 4.3 MB of JSON at 200).
 *
 * @packageDocumentation
 */
import type { RunLimits } from '../protocol.ts';

/** The editable limits. */
export interface LiveLimits {
  maxSteps: number;
  /** Seconds of wall clock for the program (package loading excluded). */
  timeoutS: number;
  maxStdoutLines: number;
}

/** Bounds and defaults per editable limit. */
export const LIMIT_RANGES: Record<keyof LiveLimits, { min: number; max: number; def: number }> = {
  maxSteps: { min: 10, max: 5000, def: 1000 },
  timeoutS: { min: 1, max: 30, def: 10 },
  maxStdoutLines: { min: 10, max: 2000, def: 500 },
};

export const DEFAULT_LIVE_LIMITS: LiveLimits = {
  maxSteps: LIMIT_RANGES.maxSteps.def,
  timeoutS: LIMIT_RANGES.timeoutS.def,
  maxStdoutLines: LIMIT_RANGES.maxStdoutLines.def,
};

/** The recursion cap for live runs (frames). */
export const LIVE_MAX_DEPTH = 100;

/** One limit, clamped to its range and rounded; anything non-numeric gives the default. */
export function clampLimit(key: keyof LiveLimits, value: unknown): number {
  const { min, max, def } = LIMIT_RANGES[key];
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Validate whatever was stored (`unknown`) into a full set of limits. */
export function parseStoredLimits(stored: unknown): LiveLimits {
  const o =
    stored !== null && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  return {
    maxSteps: clampLimit('maxSteps', o.maxSteps),
    timeoutS: clampLimit('timeoutS', o.timeoutS),
    maxStdoutLines: clampLimit('maxStdoutLines', o.maxStdoutLines),
  };
}

/** The limits a live run sends to the worker. */
export function toRunLimits(limits: LiveLimits): Partial<RunLimits> {
  return {
    maxSteps: limits.maxSteps,
    timeoutMs: limits.timeoutS * 1000,
    maxStdoutLines: limits.maxStdoutLines,
    maxDepth: LIVE_MAX_DEPTH,
  };
}
