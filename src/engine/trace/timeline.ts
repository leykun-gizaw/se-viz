/**
 * Timeline event markers (Phase 28) — labeled points on the step bar ("factorial(3) called",
 * "loop iteration 2") that the presenter can click to jump to.
 *
 * Markers are **derived** from the trace, never authored, and only when the label is reliable:
 * - **Calls and returns**: a frame pushed or popped between two steps (the first step is the
 *   program's starting state, so it never gets a marker). Labels use {@link frameLabel}, so a
 *   recursive call reads `factorial(3) called` when the parameters are known scalars.
 * - **Loop back-edges**: execution jumps *backwards* to a `for` / `while` header in the same frame,
 *   and that step carries the loop's evaluated {@link Step.condition}. A true condition is
 *   `loop iteration k` (k counts from the loop's entry from above, so nested loops reset); a false
 *   one is `loop exits`. Without a condition we can't tell an iteration from the final check, so
 *   there is no marker.
 *
 * The trace format has no authored "beat" or marker field (Phase 16 beats are the arrive / apply
 * split of every step, not events), so there is nothing authored to read here.
 *
 * @packageDocumentation
 */
import { diffSteps } from './diff.ts';
import { frameLabel } from './labels.ts';
import type { Step, Trace } from './types.ts';

export type MarkerKind = 'call' | 'return' | 'loop';

/** One labeled event on the timeline. At most one marker per step. */
export interface TimelineMarker {
  /** Zero-based step index the marker jumps to. */
  index: number;
  kind: MarkerKind;
  label: string;
}

/** A loop-header arrival still waiting for its condition step. */
interface PendingArrival {
  key: string;
  arrival: 'entry' | 'back';
}

const LOOP_HEADER = /^\s*(?:\}\s*)?(?:for|while)\s*\(/;

/** The top-of-stack frame id, or `null` for an empty stack. */
function topFrameId(step: Step): string | null {
  return step.stack.length > 0 ? step.stack[step.stack.length - 1].id : null;
}

function firstLine(step: Step): number | null {
  return step.highlightedLines.length > 0 ? Math.min(...step.highlightedLines) : null;
}

/**
 * A C loop test (Phase 32): a step on a `for` / `while` header carrying the loop's condition, as the
 * timeline reads it. `iteration` counts the passes started (this one included when the condition is
 * true) since the loop was entered from above, or `null` when the entry wasn't seen.
 */
export interface LoopTest {
  arrival: 'entry' | 'back';
  result: boolean;
  iteration: number | null;
}

/**
 * Derive the timeline markers for a trace, in step order. Concept views (pipeline, before-after,
 * dual-trace) have no frames or line-by-line control flow, so they get none.
 */
export function deriveTimelineMarkers(trace: Trace): TimelineMarker[] {
  return scan(trace).markers;
}

/** The loop tests of a trace by step index (see {@link LoopTest}); the same scan as the markers. */
export function deriveLoopTests(trace: Trace): Map<number, LoopTest> {
  return scan(trace).tests;
}

function scan(trace: Trace): { markers: TimelineMarker[]; tests: Map<number, LoopTest> } {
  const tests = new Map<number, LoopTest>();
  const view = trace.view ?? 'memory';
  if (view !== 'memory') return { markers: [], tests };
  const lines = trace.source.replace(/\n$/, '').split('\n');
  const markers: TimelineMarker[] = [];
  // Iteration counter per (frame id, loop header line), reset whenever the loop is entered from above.
  const iterations = new Map<string, number>();
  // A header arrival still waiting for its condition step (see the loop branch below).
  let pending = null as PendingArrival | null;

  for (let i = 1; i < trace.steps.length; i++) {
    const prev = trace.steps[i - 1];
    const step = trace.steps[i];

    // Calls / returns.
    const diff = diffSteps(prev, step);
    const parts: string[] = [];
    const label = (f: (typeof diff.framesPushed)[number]) =>
      frameLabel(f, trace.source, trace.language);
    for (const f of diff.framesPopped) parts.push(`${label(f)} returns`);
    for (const f of diff.framesPushed) parts.push(`${label(f)} called`);
    if (parts.length > 0) {
      markers.push({
        index: i,
        kind: diff.framesPushed.length > 0 ? 'call' : 'return',
        label: parts.join(' · '),
      });
      pending = null;
      continue;
    }

    // Loops. A `for` loop is often traced as two steps on its header — the increment (no
    // condition), then the test (with one) — so an arrival without a condition stays pending until
    // the test on the same line resolves it.
    const frame = topFrameId(step);
    const at = firstLine(step);
    const from = firstLine(prev);
    const onHeader =
      frame !== null &&
      at !== null &&
      from !== null &&
      frame === topFrameId(prev) &&
      LOOP_HEADER.test(lines[at - 1] ?? '');
    if (!onHeader) {
      pending = null;
      continue;
    }
    const key = `${frame}:${at}`;
    let arrival: 'entry' | 'back' | null;
    if (from < at) arrival = 'entry';
    else if (from > at) arrival = 'back';
    else arrival = pending?.key === key ? pending.arrival : null;

    if (arrival === null) continue;
    if (!step.condition) {
      pending = { key, arrival };
      continue;
    }
    pending = null;
    const result = step.condition.result;
    if (arrival === 'entry') {
      iterations.set(key, 1); // the loop's first test, entered from above
      tests.set(i, { arrival, result, iteration: result ? 1 : 0 });
    } else if (result) {
      const seen = iterations.get(key);
      const k = (seen ?? 1) + 1;
      iterations.set(key, k);
      markers.push({ index: i, kind: 'loop', label: `loop iteration ${k}` });
      tests.set(i, { arrival, result, iteration: seen === undefined ? null : k });
    } else {
      const seen = iterations.get(key);
      iterations.delete(key);
      markers.push({ index: i, kind: 'loop', label: 'loop exits' });
      tests.set(i, { arrival, result, iteration: seen ?? null });
    }
  }
  return { markers, tests };
}
