import { describe, expect, it } from 'vitest';
import { buildPipelineTrace } from '../../content/fixtures/buildPipeline.ts';
import { dualTraceTrace } from '../../content/fixtures/dualTrace.ts';
import { nestedLoopsTrace } from '../../content/se200/functions-nested-loops/nestedLoops.ts';
import { factorialTrace } from '../../content/se200/recursion/factorial.ts';
import { singlyTraverseTrace } from '../../content/se201/linked-lists/traverse.ts';
import { deriveTimelineMarkers } from './timeline.ts';
import type { StackFrame, Step, Trace } from './types.ts';

const labels = (t: Trace) => deriveTimelineMarkers(t).map((m) => `${m.index}:${m.label}`);

describe('deriveTimelineMarkers — calls and returns', () => {
  it('labels each recursive call and return with its argument', () => {
    expect(labels(factorialTrace)).toEqual([
      '1:factorial(4) called',
      '2:factorial(3) called',
      '3:factorial(2) called',
      '4:factorial(1) called',
      '6:factorial(1) returns',
      '7:factorial(2) returns',
      '8:factorial(3) returns',
      '9:factorial(4) returns',
    ]);
  });

  it('never marks the first step (it is the starting state, not an event)', () => {
    expect(deriveTimelineMarkers(factorialTrace).some((m) => m.index === 0)).toBe(false);
  });
});

describe('deriveTimelineMarkers — loops', () => {
  it('a while loop: iterations from the second test on, then the exit', () => {
    expect(labels(singlyTraverseTrace)).toEqual([
      '4:loop iteration 2',
      '7:loop iteration 3',
      '10:loop exits',
    ]);
  });

  it('for loops traced as increment + test, nested: the inner count resets on re-entry', () => {
    expect(labels(nestedLoopsTrace)).toEqual([
      '7:loop iteration 2', // inner, i = 1
      '10:loop exits', // inner
      '13:loop iteration 2', // outer
      '18:loop iteration 2', // inner again (reset), i = 2
      '21:loop exits', // inner
      '24:loop exits', // outer
    ]);
  });

  /** A loop whose back-edge steps carry no condition chip. */
  function uncheckedLoop(): Trace {
    const frame: StackFrame = { id: 'main', name: 'main', callId: 0, variables: [] };
    const at = (index: number, line: number, extra: Partial<Step> = {}): Step => ({
      id: `s${index}`,
      index,
      narration: '',
      highlightedLines: [line],
      stack: [frame],
      heap: [],
      ...extra,
    });
    return {
      id: 'unchecked',
      title: 'unchecked',
      language: 'c',
      source: ['int main(void) {', '    while (go()) {', '        work();', '    }', '}'].join(
        '\n',
      ),
      steps: [
        at(0, 1),
        at(1, 2),
        at(2, 3),
        at(3, 2),
        at(4, 3),
        at(5, 2, { condition: { expr: 'go()', result: false } }),
      ],
    };
  }

  it('no condition on the back-edge → no marker (iteration vs final check is unknowable)', () => {
    const t = uncheckedLoop();
    // Step 3 jumps back without a condition: no marker. Step 5 has one, so it can be labelled.
    expect(labels(t)).toEqual(['5:loop exits']);
  });

  it('a backwards jump to a line that is not a loop header is not a loop', () => {
    const t = uncheckedLoop();
    t.source = ['int main(void) {', '    x = 1;', '    work();', '    }', '}'].join('\n');
    expect(labels(t)).toEqual([]);
  });
});

describe('deriveTimelineMarkers — concept views', () => {
  it('has no markers for pipeline and dual-trace views', () => {
    expect(deriveTimelineMarkers(buildPipelineTrace)).toEqual([]);
    expect(deriveTimelineMarkers(dualTraceTrace)).toEqual([]);
  });
});
