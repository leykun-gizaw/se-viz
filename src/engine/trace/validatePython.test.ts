/**
 * Validation of Python traces (Phase 30): the shared invariants (step indices, unique ids, every
 * reference resolving) plus the Python rules (every block is an object with a stable kind, a
 * reference names an object, a frame id keeps its function).
 */
import { describe, expect, it } from 'vitest';
import { dict, int, list, pyStep, pyTrace, ref, str } from './pythonTestKit.ts';
import type { Trace } from './types.ts';
import { validateTrace } from './validate.ts';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/*.json', {
  eager: true,
  import: 'default',
});

function good(): Trace {
  return pyTrace([
    pyStep(0, [['f1', '<module>', { a: ref('o1') }]], { o1: list(int(1), int(2)) }),
    pyStep(1, [['f1', '<module>', { a: ref('o1'), b: ref('o1') }]], { o1: list(int(1), int(2)) }),
    pyStep(2, [['f1', '<module>', { a: ref('o1'), b: ref('o1') }]], {
      o1: list(int(1), int(2), int(3)),
    }),
  ]);
}

const messages = (t: Trace) => validateTrace(t).map((i) => `${i.stepIndex}: ${i.message}`);

describe('validateTrace on Python traces', () => {
  it('accepts a good hand-built trace', () => {
    expect(validateTrace(good())).toEqual([]);
  });

  it('accepts every committed Phase 29 recording', () => {
    const names = Object.keys(TRACES);
    expect(names.length).toBeGreaterThanOrEqual(8);
    for (const [path, trace] of Object.entries(TRACES)) {
      expect(trace.language, path).toBe('python');
      expect(validateTrace(trace), path).toEqual([]);
    }
  });

  it('flags a dangling reference (an object missing from the step)', () => {
    const t = good();
    t.steps[1].heap = [];
    expect(messages(t)).toEqual([
      '1: pointer "f1.a" targets "o1", which is not in the step',
      '1: pointer "f1.b" targets "o1", which is not in the step',
    ]);
  });

  it('flags a reference to a cell rather than an object', () => {
    const t = good();
    const a = t.steps[0].stack[0].variables[0];
    if (a.kind !== 'pointer') throw new Error('expected a reference');
    a.target = 'o1[0]';
    expect(messages(t)).toEqual(['0: reference "f1.a" targets "o1[0]", which is not an object']);
  });

  it('flags a duplicate id', () => {
    const t = pyTrace([pyStep(0, [['f1', '<module>', { o1: int(1) }]], { o1: list() })]);
    // A name whose cell id collides with the object id.
    t.steps[0].stack[0].variables[0].id = 'o1';
    expect(messages(t)).toEqual(['0: duplicate id(s) within the step: o1']);
  });

  it('flags a step index that does not match its position', () => {
    const t = good();
    t.steps[2].index = 7;
    expect(messages(t)).toEqual(['2: step.index is 7 but its array position is 2']);
  });

  it('flags a block without an objectKind', () => {
    const t = good();
    delete t.steps[1].heap[0].objectKind;
    expect(messages(t)).toEqual(['1: Python object "o1" has no objectKind']);
  });

  it('flags an object id whose kind changes (ids must be stable)', () => {
    const t = pyTrace([
      pyStep(0, [['f1', '<module>', { c: ref('o1') }]], { o1: list() }),
      pyStep(1, [['f1', '<module>', { c: ref('o1') }]], { o1: dict([str('k'), int(1)]) }),
    ]);
    expect(messages(t)).toEqual(['1: object "o1" changed kind from list to dict']);
  });

  it('flags a frame id reused for another function', () => {
    const t = pyTrace([
      pyStep(0, [
        ['f1', '<module>', {}],
        ['f2', 'f', {}],
      ]),
      pyStep(1, [
        ['f1', '<module>', {}],
        ['f2', 'g', {}],
      ]),
    ]);
    expect(messages(t)).toEqual(['1: frame "f2" changed name from f to g']);
  });

  it('allows a frame to leave and come back (a generator resumed)', () => {
    const t = pyTrace([
      pyStep(0, [
        ['f1', '<module>', {}],
        ['f2', 'gen', {}],
      ]),
      pyStep(1, [['f1', '<module>', {}]]),
      pyStep(2, [
        ['f1', '<module>', {}],
        ['f2', 'gen', {}],
      ]),
    ]);
    expect(validateTrace(t)).toEqual([]);
  });

  it('flags objectKind on a C trace', () => {
    const t = { ...good(), language: 'c' as const };
    expect(messages(t)).toEqual([
      '0: heap block "o1" has objectKind but the trace is not Python',
      '1: heap block "o1" has objectKind but the trace is not Python',
      '2: heap block "o1" has objectKind but the trace is not Python',
    ]);
  });
});
