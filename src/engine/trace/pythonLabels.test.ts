/**
 * Python wording in the shared labels (Phase 30): frame labels read `factorial(n=3)` and `global
 * frame` (not C signature parsing), timeline markers use them, inline values use the Python
 * tokenizer, and a name rebound across kinds shows in "What changed".
 */
import { describe, expect, it } from 'vitest';
import { explainBeat } from './explain.ts';
import { resolveInlineValues } from './inlineValues.ts';
import { frameLabel, pythonParams } from './labels.ts';
import { int, list, pyStep, pyTrace, ref } from './pythonTestKit.ts';
import { deriveTimelineMarkers } from './timeline.ts';
import type { Trace } from './types.ts';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/*.json', {
  eager: true,
  import: 'default',
});
const trace = (name: string) => TRACES[`../../content/fixtures/python/${name}.json`];

describe('Python frame labels', () => {
  it('reads parameter names from the def line', () => {
    const src = 'def f(a, b=2, *rest, k: int = 3, **kw):\n    pass\nasync def g(x, /, *, y): pass';
    expect(pythonParams(src, 'f')).toEqual(['a', 'b', 'rest', 'k', 'kw']);
    expect(pythonParams(src, 'g')).toEqual(['x', 'y']);
    expect(pythonParams(src, 'h')).toBeNull();
  });

  it('labels recursion frames with their arguments, and the module as the global frame', () => {
    const t = trace('recursion');
    const deepest = t.steps[8].stack;
    expect(deepest.map((f) => frameLabel(f, t.source, 'python'))).toEqual([
      'global frame',
      'factorial(n=4)',
      'factorial(n=3)',
      'factorial(n=2)',
      'factorial(n=1)',
    ]);
    // C parsing (the default) can't read a def line: the bare name, as before.
    expect(frameLabel(deepest[1], t.source)).toBe('factorial');
  });

  it('shows … for a parameter holding a reference', () => {
    const t = trace('mutation-through-argument');
    const call = t.steps.find((s) => s.stack.length === 2)!;
    expect(frameLabel(call.stack[1], t.source, 'python')).toBe("add_crop(basket=…, crop='wheat')");
  });

  it('timeline markers use the Python labels', () => {
    const labels = deriveTimelineMarkers(trace('recursion')).map((m) => m.label);
    expect(labels.slice(0, 2)).toEqual(['factorial(n=4) called', 'factorial(n=3) called']);
    expect(labels).toContain('factorial(n=1) returns');
  });
});

describe('Python in the explanation panel and inline values', () => {
  it('"What changed" lists a name rebound from a primitive to a reference', () => {
    const t = pyTrace([
      pyStep(0, [['f1', '<module>', { x: int(1) }]]),
      pyStep(1, [['f1', '<module>', { x: ref('o1') }]], { o1: list(int(1)) }),
    ]);
    const ex = explainBeat(t, 1, 'apply', 'two-beat');
    expect(ex.changes).toContainEqual({
      kind: 'pointer',
      subject: 'x in global frame',
      from: '1',
      to: 'list',
    });
  });

  it('inline values skip Python keywords (`in`) and resolve names in the active frame', () => {
    const t = trace('harvest');
    const step = t.steps.find((s) => s.highlightedLines[0] === 3 && s.index > 2)!;
    const values = resolveInlineValues({
      lines: [3],
      source: t.source,
      frame: step.stack[0],
      changedIds: new Set(),
      language: 'python',
    });
    expect(values.map((v) => v.name)).toEqual(['crop', 'harvest']);
  });
});
