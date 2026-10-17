import { describe, expect, it } from 'vitest';
import { allCatalogModules } from '../../content/catalog.ts';
import { buildPipelineTrace } from '../../content/fixtures/buildPipeline.ts';
import { dualTraceTrace } from '../../content/fixtures/dualTrace.ts';
import { preprocessorTrace } from '../../content/fixtures/preprocessor.ts';
import { factorialTrace } from '../../content/se200/recursion/factorial.ts';
import { insertHeadTrace } from '../../content/se201/linked-lists/insertHead.ts';
import { explainBeat } from './explain.ts';
import type { HeapBlock, StackFrame, Step, Trace } from './types.ts';

const SOURCE = [
  'int twice(int k) {', // 1
  '    return k * 2;', // 2
  '}', // 3
  'int main(void) {', // 4
  '    int x = 1;', // 5
  '    int *p = &x;', // 6
  '    x = twice(x);', // 7
  '    printf("%d", x);', // 8
  '}', // 9
].join('\n');

function main(x: number | null, p: string | null): StackFrame {
  return {
    id: 'main',
    name: 'main',
    callId: 0,
    variables: [
      { kind: 'scalar', id: 'x', name: 'x', type: 'int', value: x },
      { kind: 'pointer', id: 'p', name: 'p', type: 'int *', target: p },
    ],
  };
}

const twice: StackFrame = {
  id: 'twice#1',
  name: 'twice',
  callId: 1,
  variables: [{ kind: 'scalar', id: 'k', name: 'k', type: 'int', value: 1 }],
};

const block = (state?: HeapBlock['state']): HeapBlock => ({
  id: 'b',
  label: 'node',
  address: '0x10',
  cells: [{ kind: 'scalar', id: 'b.v', name: 'value', type: 'int', value: 3 }],
  ...(state ? { state } : {}),
});

function step(index: number, extra: Partial<Step>): Step {
  return {
    id: `s${index}`,
    index,
    narration: `narration ${index}`,
    highlightedLines: [5],
    stack: [main(null, null)],
    heap: [],
    ...extra,
  };
}

/** A small hand-built trace covering every kind of memory change. */
const trace: Trace = {
  id: 't',
  title: 't',
  language: 'c',
  source: SOURCE,
  steps: [
    step(0, { highlightedLines: [5] }),
    step(1, {
      highlightedLines: [5],
      stack: [main(1, null)],
      explain: {
        did: ['Stores `1` in `x`.', 'Nothing else.'],
        concept: 'Assignment **copies** a value.',
      },
    }),
    step(2, { highlightedLines: [6], stack: [main(1, 'x')], heap: [block()] }),
    step(3, { highlightedLines: [7, 1], stack: [main(1, 'x'), twice], heap: [block('freed')] }),
    step(4, { highlightedLines: [7], stack: [main(2, 'x')], heap: [] }),
    step(5, { highlightedLines: [8], stack: [main(2, 'x')], stdout: ['2'] }),
    step(6, { highlightedLines: [8], stack: [main(2, 'x')], stdout: ['2'], explain: { did: [] } }),
  ],
};

describe('explainBeat — what this step did', () => {
  it('uses authored explain.did when present (authored wins over narration)', () => {
    const ex = explainBeat(trace, 1, 'apply', 'two-beat');
    expect(ex.did).toEqual({ items: ['Stores `1` in `x`.', 'Nothing else.'], authored: true });
    expect(ex.concept).toBe('Assignment **copies** a value.');
  });

  it('falls back to the narration, and hides Concept, when nothing is authored', () => {
    const ex = explainBeat(trace, 2, 'apply', 'two-beat');
    expect(ex.did).toEqual({ items: ['narration 2'], authored: false });
    expect(ex.concept).toBeNull();
  });

  it('treats an empty authored did list as absent', () => {
    expect(explainBeat(trace, 6, 'apply', 'single').did).toEqual({
      items: ['narration 6'],
      authored: false,
    });
  });
});

describe('explainBeat — what changed (derived from the diff)', () => {
  it('reports a value change old → new with its owner', () => {
    expect(explainBeat(trace, 1, 'apply', 'single').changes).toEqual([
      { kind: 'value', subject: 'x in main()', from: '?', to: '1' },
    ]);
  });

  it('reports a pointer retarget and a heap allocation', () => {
    expect(explainBeat(trace, 2, 'apply', 'single').changes).toEqual([
      { kind: 'alloc', subject: 'node 0x10' },
      { kind: 'pointer', subject: 'p in main()', from: 'NULL', to: 'x in main()' },
    ]);
  });

  it('reports a pushed frame (with its call label) and a freed block', () => {
    expect(explainBeat(trace, 3, 'apply', 'single').changes).toEqual([
      { kind: 'call', subject: 'twice(1)' },
      { kind: 'free', subject: 'node 0x10' },
    ]);
  });

  it('reports a popped frame and the value it produced', () => {
    expect(explainBeat(trace, 4, 'apply', 'single').changes).toEqual([
      { kind: 'return', subject: 'twice(1)' },
      { kind: 'value', subject: 'x in main()', from: '1', to: '2' },
    ]);
  });

  it('reports printed output', () => {
    expect(explainBeat(trace, 5, 'apply', 'single').changes).toEqual([
      { kind: 'output', subject: '2' },
    ]);
  });

  it('is empty ("Nothing changed") when the diff is empty', () => {
    const ex = explainBeat(trace, 6, 'apply', 'single');
    expect(ex.changes).toEqual([]);
    expect(ex.changesNote).toBeNull();
  });

  it('a freed → removed block is not reported twice', () => {
    // Step 3 freed it; step 4 drops it. Only step 3 says "free".
    expect(explainBeat(trace, 4, 'apply', 'single').changes?.some((r) => r.kind === 'free')).toBe(
      false,
    );
  });
});

describe('explainBeat — first and last step', () => {
  it('first step: no previous step, and a note instead of a diff', () => {
    const ex = explainBeat(trace, 0, 'apply', 'two-beat');
    expect(ex.previous).toBeNull();
    expect(ex.changes).toEqual([]);
    expect(ex.changesNote).toMatch(/first step/);
    expect(ex.next?.number).toBe(2);
    expect(ex.current).toEqual({
      index: 0,
      number: 1,
      lines: [5],
      code: ['int x = 1;'],
      narration: 'narration 0',
    });
  });

  it('last step: no next step', () => {
    const ex = explainBeat(trace, 6, 'apply', 'two-beat');
    expect(ex.next).toBeNull();
    expect(ex.previous?.narration).toBe('narration 5');
  });

  it('sorts highlighted lines and reads their source text', () => {
    const ex = explainBeat(trace, 3, 'apply', 'single');
    expect(ex.current.lines).toEqual([1, 7]);
    expect(ex.current.code).toEqual(['int twice(int k) {', 'x = twice(x);']);
    expect(ex.total).toBe(7);
  });
});

describe('explainBeat — arrive vs apply (two-beat stepping)', () => {
  it('arrive: about to run, effects withheld', () => {
    const ex = explainBeat(trace, 2, 'arrive', 'two-beat');
    expect(ex.status).toBe('about-to-run');
    expect(ex.did).toBeNull();
    expect(ex.changes).toBeNull();
    expect(ex.current.narration).toBeNull();
    // The next step's narration would reveal this step's effects too.
    expect(ex.next?.narration).toBeNull();
    expect(ex.next?.code).toEqual(['int twice(int k) {', 'x = twice(x);']);
    // The previous step has run, so it is fully described.
    expect(ex.previous?.narration).toBe('narration 1');
  });

  it('apply: ran, effects shown', () => {
    const ex = explainBeat(trace, 2, 'apply', 'two-beat');
    expect(ex.status).toBe('ran');
    expect(ex.did).not.toBeNull();
    expect(ex.changes).not.toBeNull();
    expect(ex.next?.narration).toBe('narration 3');
  });

  it('single-beat mode treats every position as apply, whatever the beat says', () => {
    expect(explainBeat(trace, 2, 'arrive', 'single').status).toBe('ran');
  });

  it('arrive on the first step has neither effects nor a previous step', () => {
    const ex = explainBeat(trace, 0, 'arrive', 'two-beat');
    expect(ex.previous).toBeNull();
    expect(ex.changes).toBeNull();
  });
});

describe('explainBeat — concept views', () => {
  it('pipeline: node state changes', () => {
    const rows = explainBeat(buildPipelineTrace, 1, 'apply', 'single').changes ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.kind === 'state')).toBe(true);
  });

  it('dual-trace: rows flagged changed', () => {
    const all = dualTraceTrace.steps.flatMap((_, i) =>
      i === 0 ? [] : (explainBeat(dualTraceTrace, i, 'apply', 'two-beat').changes ?? []),
    );
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((r) => r.kind === 'value' && r.to !== undefined)).toBe(true);
  });

  it('before-after: points at the panels instead of listing rows', () => {
    const ex = explainBeat(preprocessorTrace, 1, 'apply', 'single');
    expect(ex.changes).toEqual([]);
    expect(ex.changesNote).toMatch(/before and after/);
  });
});

describe('exemplar modules (authored explain on every step)', () => {
  for (const t of [factorialTrace, insertHeadTrace]) {
    it(`${t.id}: every step has authored "did" on apply and withholds it on arrive`, () => {
      t.steps.forEach((s, i) => {
        expect(s.explain?.did?.length, `${t.id} step ${i}`).toBeGreaterThan(0);
        for (const mode of ['two-beat', 'single'] as const) {
          const applied = explainBeat(t, i, 'apply', mode);
          expect(applied.did?.authored).toBe(true);
          expect(applied.changes).not.toBeNull();
        }
        expect(explainBeat(t, i, 'arrive', 'two-beat').did).toBeNull();
      });
    });
  }

  it('factorial: the base-case unwinding step reads as return + resolved value', () => {
    const i = factorialTrace.steps.findIndex((s) => s.id === 'unwind-2');
    expect(explainBeat(factorialTrace, i, 'apply', 'two-beat').changes).toEqual([
      { kind: 'return', subject: 'factorial(1)' },
      { kind: 'value', subject: 'return in factorial(2)', from: '2 * factorial(1)', to: '2' },
    ]);
  });

  it('insert at head: malloc declares `new` and allocates the node', () => {
    const i = insertHeadTrace.steps.findIndex((s) => s.id === 'malloc');
    expect(explainBeat(insertHeadTrace, i, 'apply', 'two-beat').changes).toEqual([
      { kind: 'declare', subject: 'new in insert_head', to: 'node 0x8e0' },
      { kind: 'alloc', subject: 'node 0x8e0' },
    ]);
  });
});

describe('fallbacks for every catalog module', () => {
  it('every step of every module explains in both modes without throwing', () => {
    for (const { trace: t } of allCatalogModules()) {
      t.steps.forEach((s, i) => {
        for (const beat of ['arrive', 'apply'] as const) {
          const ex = explainBeat(t, i, beat, 'two-beat');
          expect(ex.current.number).toBe(i + 1);
        }
        const ex = explainBeat(t, i, 'apply', 'single');
        const expected = s.explain?.did?.length ? s.explain.did : [s.narration];
        expect(ex.did?.items, `${t.id} step ${i}`).toEqual(expected);
      });
    }
  });
});
