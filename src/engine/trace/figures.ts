/**
 * matplotlib figures as step output (Phase 36): which figures a step shows. Figures are cumulative
 * like `stdout` — a step shows every figure produced at or before it — so stepping back past the
 * step that produced a figure hides it. Pure and tiny: the player imports it from the main chunk;
 * the figure display itself is a lazy chunk.
 *
 * @packageDocumentation
 */
import type { Trace, TraceFigure } from './types.ts';

const NONE: readonly TraceFigure[] = [];

/** The figures visible at `stepIndex`: those produced at that step or earlier, in capture order. */
export function figuresAt(
  figures: readonly TraceFigure[] | undefined,
  stepIndex: number,
): readonly TraceFigure[] {
  if (!figures || figures.length === 0) return NONE;
  const shown = figures.filter((f) => f.step <= stepIndex);
  return shown.length === figures.length ? figures : shown;
}

/** The figures produced by step `stepIndex` itself. */
export function figuresMadeAt(trace: Trace, stepIndex: number): TraceFigure[] {
  return (trace.figures ?? []).filter((f) => f.step === stepIndex);
}
