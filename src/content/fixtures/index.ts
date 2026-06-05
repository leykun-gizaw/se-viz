/**
 * The Phase 1 validation fixtures — minimal, known-correct traces that together exercise every
 * primitive the renderer supports. These are engine validation artifacts, not polished curriculum
 * modules; the curriculum content lands in later phases.
 */
import type { Trace } from '../../engine/trace/types.ts';
import { factorialTrace } from './factorial.ts';
import { linkedListTrace } from './linkedList.ts';
import { pointerArithTrace } from './pointerArith.ts';
import { mallocFreeTrace } from './mallocFree.ts';

/** A fixture entry: the trace plus a short tab label. */
export interface FixtureEntry {
  trace: Trace;
  label: string;
}

export const FIXTURES: readonly FixtureEntry[] = [
  { trace: factorialTrace, label: 'Recursion' },
  { trace: linkedListTrace, label: 'Linked list' },
  { trace: pointerArithTrace, label: 'Pointer arithmetic' },
  { trace: mallocFreeTrace, label: 'malloc / free' },
];

export { factorialTrace, linkedListTrace, pointerArithTrace, mallocFreeTrace };
