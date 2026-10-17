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
 *   concept (`glossary.ts`). It is a lazy chunk ({@link loadPythonDeriver}): C-only sessions never
 *   download it. Until it has loaded, Python steps get no derived sections (the panel shows the
 *   narration, which for recorded traces is itself derived), and subscribers are told when it lands.
 * - **C** (`c.ts`): what C traces carry — frames pushed / popped and `condition` chips.
 *
 * Two-beat stepping is respected: on `arrive` only what is about to run is described (and the
 * concept, which describes an idea); the effects wait for `apply`.
 *
 * @packageDocumentation
 */
import type { Trace } from '../trace/types.ts';
import { deriveC } from './c.ts';
import { emptyDerived, type DerivedExplanation } from './types.ts';

/** A language's deriver: the sections for one beat of one step. */
export type Deriver = (trace: Trace, stepIndex: number, beat: 'arrive' | 'apply') => DerivedExplanation;

let python: Deriver | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Install the Python deriver (`python.ts` does this when it loads). */
export function registerPythonDeriver(fn: Deriver): void {
  python = fn;
  for (const l of listeners) l();
}

/** Whether the Python deriver has loaded. */
export function pythonDeriverReady(): boolean {
  return python !== null;
}

/** Be told when a deriver is installed (for `useSyncExternalStore`). Returns the unsubscribe. */
export function subscribeDerivers(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Load the Python deriver's chunk (once). */
export function loadPythonDeriver(): Promise<void> {
  loading ??= import('./python.ts').then(() => undefined);
  return loading;
}

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
  if (trace.language === 'python') return python ? python(trace, stepIndex, beat) : emptyDerived();
  return deriveC(trace, stepIndex, beat);
}
