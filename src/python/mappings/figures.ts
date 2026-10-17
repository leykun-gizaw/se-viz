/**
 * matplotlib figures of a run as trace figures (Phase 36). The recorder sends each figure once, on
 * the first snapshot after it was captured (`PySnapshot.figures`); that snapshot's step is the one
 * that produced it. A snapshot that makes no step (the first one, or the one right after a `call`)
 * hands its figures to the next step that has one, else to the last step.
 *
 * @packageDocumentation
 */
import type { ChartKind, TraceFigure } from '../../engine/trace/types.ts';
import type { PyFigure, RunResult } from '../protocol.ts';
import type { PlannedStep } from './plan.ts';

const CHART_KINDS = new Set<string>(['plot', 'scatter', 'bar', 'barh', 'hist', 'pie', 'boxplot']);

function toTraceFigure(f: PyFigure, step: number): TraceFigure {
  return {
    id: f.id,
    step,
    number: f.number,
    trigger: f.trigger,
    title: f.title ?? null,
    width: f.width,
    height: f.height,
    axes: f.axes.map((a) => ({
      kinds: a.kinds.filter((k): k is ChartKind => CHART_KINDS.has(k)),
      title: a.title ?? null,
      xlabel: a.xlabel ?? null,
      ylabel: a.ylabel ?? null,
      legend: a.legend ?? null,
    })),
    format: f.format,
    bytes: f.bytes ?? null,
    ...(f.data !== undefined && f.format !== 'none' ? { data: f.data } : {}),
    ...(f.reason !== undefined ? { reason: f.reason } : {}),
  };
}

/** The run's figures, each attached to the step that produced it, in capture order. */
export function traceFigures(result: RunResult, planned: readonly PlannedStep[]): TraceFigure[] {
  if (planned.length === 0) return [];
  const stepOfSnap = new Map<number, number>();
  planned.forEach((p, k) => stepOfSnap.set(p.snapIndex, k));
  const out: TraceFigure[] = [];
  result.steps.forEach((snap, i) => {
    if (!snap.figures || snap.figures.length === 0) return;
    let step: number | undefined;
    for (let j = i; j < result.steps.length && step === undefined; j++) step = stepOfSnap.get(j);
    for (const f of snap.figures) out.push(toTraceFigure(f, step ?? planned.length - 1));
  });
  return out;
}
