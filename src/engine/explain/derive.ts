/**
 * Derived step explanations (Phase 32) — the panel's sections worked out from the trace itself, for
 * steps (and live code) with no authored text. Pure, deterministic templates: no AI, no network.
 *
 * {@link deriveExplanation} returns the sections; `explainBeat` (`../trace/explain.ts`) merges them
 * under authored `Step.explain` text, which always wins, section by section.
 *
 * - **Python** (`python.ts`): from the recorder's statement facts (`Trace.statements`, `Step.py`)
 *   and the recorded states — an ordered breakdown of what the line did, "What changed" from the
 *   object-level diff, the branch taken, the loop pass, calls and returns, exceptions, and a glossary
 *   concept (`glossary.ts`).
 * - **C** (`c.ts`): what C traces carry — frames pushed / popped and `condition` chips.
 *
 * Two-beat stepping is respected: on `arrive` only what is about to run is described (and the
 * concept, which describes an idea); the effects wait for `apply`.
 *
 * @packageDocumentation
 */
import type { Trace } from '../trace/types.ts';
import { deriveC } from './c.ts';
import { derivePython, PROGRAM_END } from './python.ts';
import { plain } from './text.ts';
import { emptyDerived, type DerivedExplanation } from './types.ts';

/**
 * Derive the explanation panel's sections for one beat of a trace.
 *
 * @param trace - The trace being played.
 * @param stepIndex - The logical step (out-of-range indices give empty sections).
 * @param beat - `arrive` (about to run) or `apply` (ran). In single-beat mode pass `apply`.
 */
export function deriveExplanation(
  trace: Trace,
  stepIndex: number,
  beat: 'arrive' | 'apply',
): DerivedExplanation {
  if ((trace.view ?? 'memory') !== 'memory' || !trace.steps[stepIndex]) return emptyDerived();
  return trace.language === 'python'
    ? derivePython(trace, stepIndex, beat)
    : deriveC(trace, stepIndex, beat);
}

/**
 * A one-line, plain-text summary of what a Python step did (Phase 32), for its narration: the
 * sentence that best names the step — the exception, the branch taken, the loop pass, the call, or
 * the last part of the breakdown (usually what was stored). `null` when nothing can be derived.
 */
export function summarize(trace: Trace, stepIndex: number): string | null {
  const step = trace.steps[stepIndex];
  if (!step?.py || step.py.ending) return null;
  const d = deriveExplanation(trace, stepIndex, 'apply');
  const pick =
    (step.py.event === 'exception' ? d.exceptions[0] : undefined) ??
    d.branch[0] ??
    d.loop[0] ??
    (step.py.event === 'call' ? d.did[0] : undefined) ??
    // The program's end is said by the player; the line's own last sentence says more.
    (d.did.length > 1 && d.did[d.did.length - 1] === PROGRAM_END ? d.did[d.did.length - 2] : undefined) ??
    d.did[d.did.length - 1];
  return pick === undefined ? null : plain(pick);
}
