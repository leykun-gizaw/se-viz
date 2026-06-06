/**
 * The Phase 1 validation fixtures — minimal, known-correct traces that together exercise every
 * primitive the renderer supports. These are engine validation artifacts, not polished curriculum
 * modules.
 *
 * Note: the recursion fixture was promoted to curriculum content in Phase 4 and now lives at
 * `src/content/se200/recursion/factorial.ts`; it is no longer duplicated here.
 */
import type { Trace } from '../../engine/trace/types.ts';
import { linkedListTrace } from './linkedList.ts';
import { pointerArithTrace } from './pointerArith.ts';
import { mallocFreeTrace } from './mallocFree.ts';

/** A fixture entry: the trace plus a short tab label. */
export interface FixtureEntry {
  trace: Trace;
  label: string;
}

export const FIXTURES: readonly FixtureEntry[] = [
  { trace: linkedListTrace, label: 'Linked list' },
  { trace: pointerArithTrace, label: 'Pointer arithmetic' },
  { trace: mallocFreeTrace, label: 'malloc / free' },
];

export { linkedListTrace, pointerArithTrace, mallocFreeTrace };
