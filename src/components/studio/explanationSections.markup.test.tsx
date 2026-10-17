/**
 * The explanation panel's derived sections (Phase 32), rendered with `renderToStaticMarkup`: the
 * Python harvest module shows "Branch taken" / "Loop iteration" with code spans, the arrive beat
 * shows what is about to run, and sections with nothing to say are not rendered.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../engine/explain/python.ts';
import { sampleTrace, stepAt } from '../../engine/explain/testTraces.ts';
import type { Beat } from '../../engine/trace/beats.ts';
import type { Trace } from '../../engine/trace/types.ts';
import type { TracePlayer } from '../../engine/trace/useTrace.ts';
import { ExplanationPanel } from './ExplanationPanel.tsx';

function player(trace: Trace, index: number, beat: Beat = 'apply') {
  return {
    trace,
    index,
    total: trace.steps.length,
    step: trace.steps[index],
    beat,
    effectiveMode: 'two-beat',
    goTo: () => {},
  } as unknown as TracePlayer;
}

const harvest = sampleTrace('harvest');
const render = (i: number, beat: Beat = 'apply') =>
  renderToStaticMarkup(<ExplanationPanel player={player(harvest, i, beat)} />);

describe('derived sections in the panel', () => {
  it('an if step shows "Branch taken" (open) and no empty sections', () => {
    const html = render(stepAt(harvest, 4, 1));
    expect(html).toMatch(/<details open=""[^>]*><summary[^>]*>(?:(?!<\/summary>).)*Branch taken/);
    expect(html).toContain('<code class="se-code');
    expect(html).not.toContain('Loop iteration');
    expect(html).not.toContain('Calls and returns');
    expect(html).not.toContain('Exceptions');
  });

  it('a for step shows "Loop iteration" and a derived concept', () => {
    const html = render(stepAt(harvest, 3, 2));
    expect(html).toContain('Loop iteration');
    expect(html).toContain('Iteration 2 of the');
    expect(html).toContain('Concept');
  });

  it('"What changed" lists a key added inside the dict (no more "Nothing changed")', () => {
    const html = render(stepAt(harvest, 7, 1));
    expect(html).toContain('added');
    expect(html).toContain('<span>Key </span><code');
    expect(html).not.toContain('Nothing changed');
  });

  it('on arrive, says what is about to run and holds every effect back', () => {
    const html = render(stepAt(harvest, 5, 1), 'arrive');
    expect(html).toContain('About to run line 5: it works out');
    expect(html).toContain('Nothing yet. The changes appear when this step runs.');
    expect(html).not.toContain('Branch taken');
  });
});
