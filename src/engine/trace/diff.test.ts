import { describe, expect, it } from 'vitest';
import { allCatalogTraces } from '../../content/catalog.ts';
import { addTrace } from '../../content/phase0/addTrace.ts';
import { diffSteps } from './diff.ts';

/** Find a step in the Phase 0 trace by its stable id (fails loudly if the trace is reshaped). */
function step(id: string) {
  const s = addTrace.steps.find((step) => step.id === id);
  if (!s) {
    throw new Error(`Phase 0 trace is missing step "${id}"`);
  }
  return s;
}

describe('diffSteps on the Phase 0 add trace', () => {
  it('reports the add frame (with cells a and b) being pushed when add is called', () => {
    const before = step('decl-y'); // main has x, y; no add frame yet
    const after = step('add-call'); // add frame pushed with a = 3, b = 4

    const diff = diffSteps(before, after);

    // Exactly one frame pushed, and it is `add`.
    expect(diff.framesPushed).toHaveLength(1);
    const pushed = diff.framesPushed[0];
    expect(pushed.name).toBe('add');
    expect(pushed.id).toBe('add#0');

    // The pushed frame carries parameters a and b.
    expect(pushed.variables.map((c) => c.name)).toEqual(['a', 'b']);

    // Nothing popped on a call.
    expect(diff.framesPopped).toHaveLength(0);

    // The newly visible cells include add's a and b, plus main's freshly declared z.
    expect(diff.cellsAdded).toEqual(expect.arrayContaining(['add.a', 'add.b', 'main.z']));
  });

  it('reports the add frame being popped and z changing from uninitialized to 7 on return', () => {
    const before = step('add-return'); // add still on stack, z is null
    const after = step('add-pop-assign-z'); // add popped, z = 7

    const diff = diffSteps(before, after);

    // The add frame is popped.
    expect(diff.framesPopped.map((f) => f.id)).toEqual(['add#0']);
    expect(diff.framesPushed).toHaveLength(0);

    // add's cells are removed.
    expect(diff.cellsRemoved).toEqual(expect.arrayContaining(['add.a', 'add.b', 'add.sum']));

    // z transitions from uninitialized (null) to 7 — a value change, not an add/remove.
    expect(diff.valuesChanged).toContainEqual({ id: 'main.z', from: null, to: 7 });
  });
});

describe('diff includes static-segment cells (Phase 24)', () => {
  const withTotal = (index: number, total: number): import('./types.ts').Step => ({
    id: `s${index}`,
    index,
    narration: '',
    highlightedLines: [],
    stack: [],
    heap: [],
    staticData: {
      data: [],
      bss: [{ kind: 'scalar', id: 'g.total', name: 'total', type: 'int', value: total }],
      rodata: [],
    },
  });

  it('detects a .bss scalar value change as a pulse (so static globals animate)', () => {
    const diff = diffSteps(withTotal(0, 0), withTotal(1, 16));
    expect(diff.valuesChanged).toContainEqual({ id: 'g.total', from: 0, to: 16 });
  });

  it('treats an appearing static cell as added', () => {
    const prev: import('./types.ts').Step = {
      id: 's0',
      index: 0,
      narration: '',
      highlightedLines: [],
      stack: [],
      heap: [],
    };
    expect(diffSteps(prev, withTotal(1, 0)).cellsAdded).toContain('g.total');
  });
});

describe('kindsChanged (Phase 30)', () => {
  it('is always empty on C traces: their cells never change kind', () => {
    for (const trace of allCatalogTraces().filter((t) => t.language === 'c')) {
      trace.steps.forEach((step, i) => {
        const prev = i > 0 ? trace.steps[i - 1] : null;
        expect(diffSteps(prev, step).kindsChanged, `${trace.id} step ${i}`).toEqual([]);
      });
    }
  });
});
