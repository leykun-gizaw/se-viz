import { describe, expect, it } from 'vitest';
import { factorialTrace } from '../../content/fixtures/factorial.ts';
import { linkedListTrace } from '../../content/fixtures/linkedList.ts';
import { pulsedCellIds, retargetedPointerIds } from './diff.ts';
import type { Step } from './types.ts';

function step(trace: { steps: Step[] }, id: string): Step {
  const s = trace.steps.find((st) => st.id === id);
  if (!s) throw new Error(`missing step ${id}`);
  return s;
}

describe('diff-driven pulse selection', () => {
  it('pulses exactly the return cell that resolved this step (not popped frames)', () => {
    // unwind-3 -> unwind-4: factorial(4) computes 4 * 6 = 24; factorial(3) is popped.
    const prev = step(factorialTrace, 'unwind-3');
    const next = step(factorialTrace, 'unwind-4');
    const pulsed = pulsedCellIds(prev, next);

    expect(pulsed.has('fac4.ret')).toBe(true);
    // The popped frame's cells are removed, not "changed" — they must not pulse.
    expect(pulsed.has('fac3.ret')).toBe(false);
    expect(pulsed.has('fac3.n')).toBe(false);
  });

  it('reports no pulses for the first step (no previous state)', () => {
    const first = step(factorialTrace, 'start');
    expect(pulsedCellIds(null, first).size).toBe(0);
  });
});

describe('diff-driven pointer retarget selection', () => {
  it('marks only the pointer whose target changed as retargeted', () => {
    // visit-1 -> advance-1: current moves n0 -> n1; head stays on n0.
    const prev = step(linkedListTrace, 'visit-1');
    const next = step(linkedListTrace, 'advance-1');
    const glided = retargetedPointerIds(prev, next);

    expect(glided.has('current')).toBe(true);
    expect(glided.has('head')).toBe(false);
  });
});
