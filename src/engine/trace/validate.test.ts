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

describe('validateTrace — concept views (Phase 11)', () => {
  it('accepts a well-formed pipeline trace and resolves activeId to a node', () => {
    const t: Trace = {
      id: 'p',
      title: 'p',
      language: 'c',
      source: '',
      view: 'pipeline',
      steps: [
        {
          id: 's0',
          index: 0,
          narration: 'n',
          highlightedLines: [],
          stack: [],
          heap: [],
          activeId: 'cc',
          pipeline: {
            nodes: [
              { id: 'src', kind: 'artifact', label: 'a.c' },
              { id: 'cc', kind: 'process', label: 'cc' },
            ],
            edges: [{ from: 'src', to: 'cc' }],
          },
        },
      ],
    };
    expect(validateTrace(t)).toEqual([]);
  });

  it('flags a pipeline edge referencing a missing node', () => {
    const t: Trace = {
      id: 'p',
      title: 'p',
      language: 'c',
      source: '',
      view: 'pipeline',
      steps: [
        {
          id: 's0',
          index: 0,
          narration: 'n',
          highlightedLines: [],
          stack: [],
          heap: [],
          pipeline: {
            nodes: [{ id: 'src', kind: 'artifact', label: 'a.c' }],
            edges: [{ from: 'src', to: 'ghost' }],
          },
        },
      ],
    };
    expect(validateTrace(t)[0].message).toMatch(/edge to "ghost"/);
  });

  it('flags a before-after highlight outside its panel', () => {
    const t: Trace = {
      id: 'b',
      title: 'b',
      language: 'c',
      source: '',
      view: 'before-after',
      steps: [
        {
          id: 's0',
          index: 0,
          narration: 'n',
          highlightedLines: [],
          stack: [],
          heap: [],
          beforeAfter: { before: 'one line', after: 'one line', afterHighlights: [9] },
        },
      ],
    };
    expect(validateTrace(t)[0].message).toMatch(/afterHighlights entry 9/);
  });

  it('flags dual-trace missing left/right source, and a line out of range', () => {
    const step: Step = {
      id: 's0',
      index: 0,
      narration: 'n',
      highlightedLines: [],
      stack: [],
      heap: [],
      dualTrace: {
        left: { label: 'buggy', line: 1, rows: [] },
        right: { label: 'fixed', line: 1, rows: [] },
      },
    };
    const missing: Trace = {
      id: 'd',
      title: 'd',
      language: 'c',
      source: '',
      view: 'dual-trace',
      steps: [step],
    };
    expect(
      validateTrace(missing).some((x) => /leftSource and trace.rightSource/.test(x.message)),
    ).toBe(true);

    const outOfRange: Trace = {
      id: 'd',
      title: 'd',
      language: 'c',
      source: '',
      view: 'dual-trace',
      leftSource: 'a\nb',
      rightSource: 'a\nb',
      steps: [
        {
          ...step,
          dualTrace: {
            left: { label: 'buggy', line: 9, rows: [] },
            right: { label: 'fixed', line: 1, rows: [] },
          },
        },
      ],
    };
    expect(validateTrace(outOfRange).some((x) => /dual-trace left line 9/.test(x.message))).toBe(
      true,
    );
  });

  it('flags a concept-view step missing its payload', () => {
    const t: Trace = {
      id: 'p',
      title: 'p',
      language: 'c',
      source: '',
      view: 'pipeline',
      steps: [{ id: 's0', index: 0, narration: 'n', highlightedLines: [], stack: [], heap: [] }],
    };
    expect(validateTrace(t)[0].message).toMatch(/missing its `pipeline` payload/);
  });

  describe('static segment (Phase 24)', () => {
    /** A trace with a full static segment plus a stack pointer that targets a `.rodata` string. */
    function staticTrace(): Trace {
      return {
        id: 'st',
        title: 'st',
        language: 'c',
        source: 'int g = 1;\nint main(void){ return 0; }\n',
        staticLayout: 'full',
        steps: [
          {
            id: 's0',
            index: 0,
            narration: 'n',
            highlightedLines: [1],
            stack: [
              {
                id: 'main',
                name: 'main',
                callId: 0,
                variables: [
                  { kind: 'pointer', id: 'main.p', name: 'p', type: 'const char *', target: 'ro.msg' },
                ],
              },
            ],
            heap: [],
            staticData: {
              data: [
                { kind: 'scalar', id: 'd.counter', name: 'counter', type: 'int', value: 7 },
                // a `.data` pointer that targets a `.rodata` string (cross-sub-segment)
                { kind: 'pointer', id: 'd.label', name: 'label', type: 'const char *', target: 'ro.msg' },
              ],
              bss: [{ kind: 'scalar', id: 'b.total', name: 'total', type: 'int', value: 0 }],
              rodata: [{ kind: 'scalar', id: 'ro.msg', name: '"hi"', type: 'const char[3]', value: '"hi"' }],
            },
            activeId: 'd.counter',
          },
        ],
      };
    }

    it('accepts a well-formed static segment, incl. stack→rodata and data→rodata pointers', () => {
      expect(validateTrace(staticTrace())).toEqual([]);
    });

    it('resolves activeId into the static segment', () => {
      const t = staticTrace();
      t.steps[0].activeId = 'b.total';
      expect(validateTrace(t)).toEqual([]);
    });

    it('flags a static id that duplicates a frame id (cross-region uniqueness)', () => {
      const t = staticTrace();
      t.steps[0].staticData!.bss.push({ kind: 'scalar', id: 'main', name: 'x', type: 'int', value: 0 });
      expect(validateTrace(t)[0].message).toMatch(/duplicate id/);
    });

    it('flags a pointer in .data whose target is missing', () => {
      const t = staticTrace();
      const label = t.steps[0].staticData!.data[1];
      if (label.kind === 'pointer') label.target = 'ghost';
      expect(validateTrace(t).some((x) => /targets "ghost"/.test(x.message))).toBe(true);
    });

    it('flags a stack pointer whose static target was removed', () => {
      const t = staticTrace();
      t.steps[0].staticData!.rodata = [];
      // both main.p and d.label now point at the missing ro.msg
      expect(validateTrace(t).some((x) => /targets "ro.msg"/.test(x.message))).toBe(true);
    });

    it('leaves a staticData-less trace unaffected', () => {
      const t = staticTrace();
      delete t.steps[0].staticData;
      // remove the now-unresolvable pointers so the only change under test is the absence of staticData
      t.steps[0].stack[0].variables = [];
      t.steps[0].activeId = 'main';
      expect(validateTrace(t)).toEqual([]);
    });
  });

  describe('coach notes (Phase 17)', () => {
    it('accepts a coach note anchored to a real element', () => {
      const t = baseTrace();
      t.steps[0].coach = { variant: 'idea', body: 'b', anchorId: 'x' };
      expect(validateTrace(t)).toEqual([]);
    });
    it('accepts a coach note with no anchor (fallback)', () => {
      const t = baseTrace();
      t.steps[0].coach = { variant: 'recap', body: 'b' };
      expect(validateTrace(t)).toEqual([]);
    });
    it('flags a coach anchorId that resolves to nothing', () => {
      const t = baseTrace();
      t.steps[0].coach = { variant: 'watch-out', body: 'b', anchorId: 'ghost' };
      expect(validateTrace(t)[0].message).toMatch(/coach anchorId "ghost"/);
    });
    it('flags a coach anchorLine outside the source', () => {
      const t = baseTrace();
      t.steps[0].coach = { variant: 'predict', body: 'b', anchorLine: 99 };
      expect(validateTrace(t)[0].message).toMatch(/coach anchorLine 99/);
    });
  });
});
