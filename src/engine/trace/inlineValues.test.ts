import { describe, expect, it } from 'vitest';
import type { Cell, PointerCell, ScalarCell, StackFrame, Step } from './types.ts';
import { findActiveFrame, resolveInlineValues } from './inlineValues.ts';

function intCell(id: string, name: string, value: number): ScalarCell {
  return { kind: 'scalar', id, name, type: 'int', value };
}
function frame(id: string, name: string, vars: Cell[]): StackFrame {
  return { id, name, callId: 0, variables: vars };
}

const FACT_SOURCE = `int factorial(int n) {
    if (n <= 1)
        return 1;
    return n * factorial(n - 1);
}`;

describe('findActiveFrame', () => {
  const step: Step = {
    id: 's',
    index: 0,
    narration: '',
    highlightedLines: [],
    stack: [
      frame('fac4', 'factorial', [intCell('fac4.n', 'n', 4)]),
      frame('fac3', 'factorial', [intCell('fac3.n', 'n', 3)]),
      frame('fac2', 'factorial', [intCell('fac2.n', 'n', 2)]),
    ],
    heap: [],
  };

  it('finds the frame by its own id', () => {
    expect(findActiveFrame(step, 'fac3')?.id).toBe('fac3');
  });
  it('finds the frame that contains the active cell id', () => {
    expect(findActiveFrame(step, 'fac2.n')?.id).toBe('fac2');
  });
  it('falls back to the top of stack when activeId is absent/unknown', () => {
    expect(findActiveFrame(step, undefined)?.id).toBe('fac2');
    expect(findActiveFrame(step, 'ghost')?.id).toBe('fac2');
  });
});

describe('resolveInlineValues — recursion same-name correctness', () => {
  const stack = [
    frame('fac4', 'factorial', [intCell('fac4.n', 'n', 4)]),
    frame('fac3', 'factorial', [intCell('fac3.n', 'n', 3)]),
    frame('fac2', 'factorial', [intCell('fac2.n', 'n', 2)]),
  ];
  const step: Step = { id: 's', index: 0, narration: '', highlightedLines: [4], stack, heap: [] };

  it('resolves `n` against the ACTIVE frame, not another frame with the same name', () => {
    // Active frame is fac2 (n = 2). The line `return n * factorial(n - 1)` mentions n; the value
    // must be 2, even though fac4.n=4 and fac3.n=3 are also live.
    const active = findActiveFrame(step, 'fac2');
    const values = resolveInlineValues({
      lines: [4],
      source: FACT_SOURCE,
      frame: active,
      changedIds: new Set(),
    });
    expect(values).toHaveLength(1);
    expect(values[0].name).toBe('n');
    expect(values[0].display).toBe('2');
    expect(values[0].changed).toBe(false);
  });

  it('a different active frame yields that frame’s value', () => {
    const active = findActiveFrame(step, 'fac4');
    const values = resolveInlineValues({
      lines: [4],
      source: FACT_SOURCE,
      frame: active,
      changedIds: new Set(),
    });
    expect(values[0].display).toBe('4');
  });
});

describe('resolveInlineValues — classification & formatting', () => {
  const SRC = `void f(void) {
    int sum = 0;
    sum = sum + i;
    int *p = &x;
}`;
  const pPtr: PointerCell = {
    kind: 'pointer',
    id: 'p',
    name: 'p',
    type: 'int *',
    target: 'x',
    display: '0x5004',
  };
  const fr = frame('f', 'f', [intCell('sum', 'sum', 10), intCell('i', 'i', 4), pPtr]);

  it('marks changed variables (pulse) and leaves read ones muted', () => {
    const values = resolveInlineValues({
      lines: [3], // `sum = sum + i;`
      source: SRC,
      frame: fr,
      changedIds: new Set(['sum']),
    });
    const byName = new Map(values.map((v) => [v.name, v]));
    expect(byName.get('sum')?.changed).toBe(true);
    expect(byName.get('sum')?.display).toBe('10');
    expect(byName.get('i')?.changed).toBe(false);
    expect(byName.get('i')?.display).toBe('4');
  });

  it('formats pointers compactly and skips non-variable tokens', () => {
    const values = resolveInlineValues({
      lines: [4],
      source: SRC,
      frame: fr,
      changedIds: new Set(),
    });
    const p = values.find((v) => v.name === 'p');
    expect(p?.pointer).toBe(true);
    expect(p?.display).toBe('→ 0x5004');
    // `int`, `void`, `&`, `x` (no cell named x) must not appear.
    expect(values.map((v) => v.name)).toEqual(['p']);
  });

  it('returns nothing when there is no active frame', () => {
    expect(
      resolveInlineValues({ lines: [3], source: SRC, frame: null, changedIds: new Set() }),
    ).toEqual([]);
  });
});
