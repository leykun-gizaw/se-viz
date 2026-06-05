import { describe, expect, it } from 'vitest';
import { linkedListTrace } from '../content/fixtures/linkedList.ts';
import { mallocFreeTrace } from '../content/fixtures/mallocFree.ts';
import { classifyTarget, indexStep, pointersByTarget, resolvePointers } from './pointers.ts';
import type { Step } from './trace/types.ts';

function step(trace: { steps: Step[] }, id: string): Step {
  const s = trace.steps.find((st) => st.id === id);
  if (!s) throw new Error(`missing step ${id}`);
  return s;
}

describe('pointer target resolution', () => {
  it('resolves head and current to their heap nodes by stable id', () => {
    const s = step(linkedListTrace, 'advance-1'); // current has just advanced to n1
    const resolved = resolvePointers(s);
    const byId = new Map(resolved.map((r) => [r.id, r]));

    expect(byId.get('head')?.target).toBe('n0');
    expect(byId.get('head')?.targetKind).toBe('block');
    expect(byId.get('current')?.target).toBe('n1');
    expect(byId.get('current')?.targetKind).toBe('block');
  });

  it("classifies the last node's next as a NULL target", () => {
    const s = step(linkedListTrace, 'advance-1');
    const idx = indexStep(s);
    // n2.next points at NULL in the fixture.
    const n2next = idx.cells.get('n2.next');
    expect(n2next?.kind).toBe('pointer');
    if (n2next?.kind === 'pointer') {
      expect(classifyTarget(n2next.target, idx)).toBe('null');
    }
  });

  it('flags a pointer into a freed/dangling block as danger (UB), but not a live one', () => {
    const s = step(mallocFreeTrace, 'leak-c'); // final step: all four allocation states present
    const byId = new Map(resolvePointers(s).map((r) => [r.id, r]));

    expect(byId.get('old')?.target).toBe('b40');
    expect(byId.get('old')?.danger).toBe(true); // b40 is dangling
    expect(byId.get('buf')?.danger).toBe(false); // b0 is allocated
  });

  it('maps targets back to the pointers aiming at them', () => {
    const s = step(linkedListTrace, 'init-current');
    const targeted = pointersByTarget(s);
    // Both head and current aim at n0 initially.
    expect(targeted.get('n0')).toEqual(expect.arrayContaining(['head', 'current']));
  });
});
