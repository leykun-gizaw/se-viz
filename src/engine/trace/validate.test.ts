import { describe, expect, it } from 'vitest';
import type { Step, Trace } from './types.ts';
import { validateTrace } from './validate.ts';

/** A tiny, valid two-step trace used as the base for negative-case mutations. */
function baseTrace(): Trace {
  const step = (index: number, extra: Partial<Step> = {}): Step => ({
    id: `s${index}`,
    index,
    narration: 'n',
    highlightedLines: [1],
    stack: [
      {
        id: 'main',
        name: 'main',
        callId: 0,
        variables: [{ kind: 'scalar', id: 'x', name: 'x', type: 'int', value: index }],
      },
    ],
    heap: [],
    ...extra,
  });
  return {
    id: 't',
    title: 't',
    language: 'c',
    source: 'int main(void) { return 0; }\n',
    steps: [step(0, { activeId: 'x' }), step(1, { activeId: 'main' })],
  };
}

describe('validateTrace', () => {
  it('accepts a well-formed trace', () => {
    expect(validateTrace(baseTrace())).toEqual([]);
  });

  it('flags a step whose index does not match its position', () => {
    const t = baseTrace();
    t.steps[1].index = 5;
    const issues = validateTrace(t);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/index/);
  });

  it('flags a highlightedLines entry outside the source', () => {
    const t = baseTrace();
    t.steps[0].highlightedLines = [99];
    expect(validateTrace(t)[0].message).toMatch(/outside the source/);
  });

  it('flags a duplicate id within a step', () => {
    const t = baseTrace();
    t.steps[0].stack[0].variables.push({
      kind: 'scalar',
      id: 'x',
      name: 'x2',
      type: 'int',
      value: 0,
    });
    expect(validateTrace(t)[0].message).toMatch(/duplicate id/);
  });

  it('flags an activeId that resolves to nothing', () => {
    const t = baseTrace();
    t.steps[0].activeId = 'ghost';
    expect(validateTrace(t)[0].message).toMatch(/activeId/);
  });

  it('flags a pointer whose target is missing (but allows NULL)', () => {
    const t = baseTrace();
    t.steps[0].stack[0].variables.push({
      kind: 'pointer',
      id: 'p',
      name: 'p',
      type: 'int *',
      target: 'nowhere',
    });
    expect(validateTrace(t)[0].message).toMatch(/targets "nowhere"/);

    const ok = baseTrace();
    ok.steps[0].stack[0].variables.push({
      kind: 'pointer',
      id: 'p',
      name: 'p',
      type: 'int *',
      target: null,
    });
    expect(validateTrace(ok)).toEqual([]);
  });

  it('flags an annotation endpoint that is missing', () => {
    const t = baseTrace();
    t.steps[0].annotations = [{ id: 'a', fromId: 'x', toId: 'missing', label: 'l' }];
    expect(validateTrace(t)[0].message).toMatch(/toId "missing"/);
  });
});
