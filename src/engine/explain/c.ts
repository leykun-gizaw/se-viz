/**
 * Derived explanations for C steps (Phase 32), where the data allows: C traces carry no statement
 * facts, so "What this step did" stays the authored narration, and the derived sections come from
 * what every C trace does carry — frames pushed and popped, and the `condition` chip of a branch or
 * loop test (with the timeline's loop counting).
 *
 * @packageDocumentation
 */
import { diffSteps } from '../trace/diff.ts';
import { frameLabel } from '../trace/labels.ts';
import { deriveLoopTests } from '../trace/timeline.ts';
import type { Step, Trace } from '../trace/types.ts';
import { capitalize, code, count } from './text.ts';
import { emptyDerived, type DerivedExplanation } from './types.ts';

const LOOP_HEADER = /^\s*(?:\}\s*)?(?:for|while)\s*\(/;

const top = (s: Step) => s.stack[s.stack.length - 1]?.id ?? null;
const first = (s: Step) => (s.highlightedLines.length > 0 ? Math.min(...s.highlightedLines) : null);

const loopCache = new WeakMap<Trace, { length: number; tests: ReturnType<typeof deriveLoopTests> }>();

function loopTests(trace: Trace) {
  const hit = loopCache.get(trace);
  if (hit && hit.length === trace.steps.length) return hit.tests;
  const tests = deriveLoopTests(trace);
  loopCache.set(trace, { length: trace.steps.length, tests });
  return tests;
}

/** Derive the panel sections for a C step (`apply` only; an `arrive` beat gets none). */
export function deriveC(trace: Trace, k: number, beat: 'arrive' | 'apply'): DerivedExplanation {
  const out = emptyDerived();
  const step = trace.steps[k];
  if (!step || beat === 'arrive') return out;
  const prev = k > 0 ? trace.steps[k - 1] : null;
  const next = k + 1 < trace.steps.length ? trace.steps[k + 1] : null;

  // Calls and returns, labelled the way the timeline and "What changed" label them.
  if (prev) {
    const diff = diffSteps(prev, step);
    for (const f of diff.framesPopped) {
      out.calls.push(`${code(frameLabel(f, trace.source, trace.language))} returned: its frame is popped.`);
    }
    for (const f of diff.framesPushed) {
      out.calls.push(`Called ${code(frameLabel(f, trace.source, trace.language))}: it runs in a new frame.`);
    }
  }

  const c = step.condition;
  if (!c) return out;
  const lines = trace.source.replace(/\n$/, '').split('\n');
  const at = first(step);
  const result = code(c.result ? 'true' : 'false');
  const test = loopTests(trace).get(k);
  if (at !== null && LOOP_HEADER.test(lines[at - 1] ?? '')) {
    // A loop test: which pass this is, counted from the loop's entry (the timeline's rule).
    if (!test) {
      out.loop.push(`${code(c.expr)} is ${result}, so the loop ${c.result ? 'body runs' : 'ends'}.`);
    } else if (c.result) {
      out.loop.push(
        test.iteration !== null
          ? `Iteration ${test.iteration}: ${code(c.expr)} is ${result}, so the loop body runs.`
          : `${code(c.expr)} is ${result}, so the loop body runs again.`,
      );
    } else {
      out.loop.push(
        test.iteration === 0
          ? `${code(c.expr)} is ${result} at the first check, so the loop body never runs.`
          : test.iteration !== null
            ? `${code(c.expr)} is ${result}, so the loop ends after ${count(test.iteration, 'iteration')}.`
            : `${code(c.expr)} is ${result}, so the loop ends.`,
      );
    }
    return out;
  }
  // A branch test: the next step in the same frame shows where execution went.
  const to = next ? first(next) : null;
  const sameFrame = next !== null && top(next) === top(step) && next.stack.length === step.stack.length;
  out.branch.push(
    sameFrame && to !== null && to !== at
      ? capitalize(`${code(c.expr)} is ${result}, so line ${to} runs next.`)
      : `${code(c.expr)} is ${result}.`,
  );
  return out;
}
