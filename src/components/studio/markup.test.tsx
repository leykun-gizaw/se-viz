/**
 * Markup checks for the Studio shell (Phase 28), rendered with `renderToStaticMarkup` (the test
 * environment is `node`; no DOM library): landmarks, labels, focusable resize handles, section
 * defaults, the narration card, and the timeline markers.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG } from '../../content/catalog.ts';
import { factorialTrace } from '../../content/se200/recursion/factorial.ts';
import type { Beat, SteppingMode } from '../../engine/trace/beats.ts';
import type { Trace } from '../../engine/trace/types.ts';
import type { TracePlayer } from '../../engine/trace/useTrace.ts';
import { ContentSidebar } from '../ContentSidebar.tsx';
import { NarrationCard } from '../NarrationCard.tsx';
import { ExplanationPanel } from './ExplanationPanel.tsx';
import { StudioLayout } from './StudioLayout.tsx';
import { Timeline } from './Timeline.tsx';
import { COURSE_MAP, EXPLANATION } from './panelLayout.ts';
import { useCourseMapNav } from './useCourseMapNav.ts';
import { storageKey, useSidePanel } from './useSidePanel.ts';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  });
});
afterEach(() => vi.unstubAllGlobals());

/** Just enough of a player for the read-only Studio components. */
function player(
  trace: Trace,
  index: number,
  beat: Beat = 'apply',
  mode: SteppingMode = 'two-beat',
) {
  return {
    trace,
    index,
    total: trace.steps.length,
    step: trace.steps[index],
    beat,
    effectiveMode: mode,
    goTo: () => {},
  } as unknown as TracePlayer;
}

/** The `<details>` element for a section title, with its open state. */
function section(html: string, title: string): { open: boolean } | null {
  const re = new RegExp(`<details([^>]*)><summary[^>]*>(?:(?!</summary>).)*${title}</summary>`);
  const m = re.exec(html);
  return m ? { open: /\sopen=""/.test(m[1]) } : null;
}

describe('ExplanationPanel', () => {
  it('is a labeled landmark with a labeled collapse button', () => {
    const html = renderToStaticMarkup(
      <ExplanationPanel player={player(factorialTrace, 5)} onCollapse={() => {}} />,
    );
    expect(html).toMatch(/^<aside aria-label="Step explanation"/);
    expect(html).toContain('aria-label="Collapse the step explanation"');
  });

  it('opens "What this step did", "What changed", "Previous step"; closes "Coming next" and "Concept"', () => {
    const html = renderToStaticMarkup(<ExplanationPanel player={player(factorialTrace, 5)} />);
    expect(section(html, 'What this step did')).toEqual({ open: true });
    expect(section(html, 'What changed')).toEqual({ open: true });
    expect(section(html, 'Previous step')).toEqual({ open: true });
    expect(section(html, 'Coming next')).toEqual({ open: false });
    expect(section(html, 'Concept')).toEqual({ open: false });
  });

  it('renders authored inline Markdown and the header chip', () => {
    const html = renderToStaticMarkup(<ExplanationPanel player={player(factorialTrace, 4)} />);
    expect(html).toContain('Step 5 / 12');
    expect(html).toContain('<strong class="font-semibold text-ink">');
    expect(html).toContain('<code class="se-code');
    expect(html).toContain('Ran');
  });

  it('hides Concept when nothing is authored', () => {
    const html = renderToStaticMarkup(<ExplanationPanel player={player(factorialTrace, 10)} />);
    expect(section(html, 'Concept')).toBeNull();
  });

  it('on arrive, says "About to run" and holds the effects back', () => {
    const html = renderToStaticMarkup(
      <ExplanationPanel player={player(factorialTrace, 6, 'arrive')} />,
    );
    expect(html).toContain('About to run');
    expect(html).toContain('Nothing yet. The changes appear when this step runs.');
    expect(html).not.toContain('frame is popped');
  });

  it('shows "Nothing changed" for an empty diff', () => {
    const t: Trace = {
      ...factorialTrace,
      steps: [factorialTrace.steps[0], { ...factorialTrace.steps[0], id: 'again', index: 1 }],
    };
    expect(renderToStaticMarkup(<ExplanationPanel player={player(t, 1)} />)).toContain(
      'Nothing changed',
    );
  });
});

describe('StudioLayout', () => {
  function Shell({ withExplanation }: { withExplanation: boolean }) {
    const map = useSidePanel(COURSE_MAP);
    const explanation = useSidePanel(EXPLANATION);
    const nav = useCourseMapNav(CATALOG, factorialTrace.id);
    return (
      <StudioLayout
        courseMap={map}
        explanation={withExplanation ? explanation : null}
        onExplanationSlot={() => {}}
        sidebar={
          <ContentSidebar
            courses={CATALOG}
            selectedId={factorialTrace.id}
            onSelect={() => {}}
            collapsed={map.state.collapsed}
            onCollapse={map.collapse}
            onExpand={map.expand}
            nav={nav}
          />
        }
      >
        <main>stage</main>
      </StudioLayout>
    );
  }

  it('has focusable, labeled resize handles for both side panels', () => {
    const html = renderToStaticMarkup(<Shell withExplanation />);
    const handles = html.match(/<div[^>]*role="separator"[^>]*>/g) ?? [];
    expect(handles).toHaveLength(2);
    expect(handles[0]).toContain('aria-label="Resize the course map"');
    expect(handles[1]).toContain('aria-label="Resize the step explanation"');
    for (const h of handles) expect(h).toContain('tabindex="0"');
  });

  it('theory decks and live coding get no explanation panel or its handle', () => {
    const html = renderToStaticMarkup(<Shell withExplanation={false} />);
    expect(html.match(/role="separator"/g)).toHaveLength(1);
    expect(html).not.toContain('Step explanation');
  });

  it('course map: labeled landmark, sentence-case topics, current item marked', () => {
    const html = renderToStaticMarkup(<Shell withExplanation />);
    expect(html).toContain('<aside aria-label="Course map"');
    expect(html).toContain('aria-label="Collapse the course map"');
    expect(html).toContain('Even more pointers, arrays and strings');
    expect(html).not.toContain('uppercase');
    expect(html).toMatch(/aria-current="true"[^>]*>factorial\(n\)</);
  });

  it('collapsed panels render rails: an expand button, plus a vertical label for the explanation', () => {
    store.set(storageKey(COURSE_MAP), JSON.stringify({ width: 280, collapsed: true }));
    store.set(storageKey(EXPLANATION), JSON.stringify({ width: 340, collapsed: true }));
    const html = renderToStaticMarkup(<Shell withExplanation />);
    expect(html).toContain('aria-label="Expand the course map"');
    expect(html).not.toContain('Course</'); // no course picker in the rail
    expect(html).toContain('aria-label="Expand the step explanation"');
    expect(html).toMatch(/\[writing-mode:vertical-rl\][^>]*>Step explanation</);
    expect(html).toContain('<aside aria-label="Step explanation"');
  });
});

describe('NarrationCard and Timeline', () => {
  it('narration card names the line, shows the condition chip, and is a polite live region', () => {
    const html = renderToStaticMarkup(<NarrationCard player={player(factorialTrace, 1)} />);
    expect(html).toContain('Lines 4, 6');
    expect(html).toContain('n &lt;= 1');
    expect(html).toContain('aria-live="polite"');
  });

  it('timeline: a labeled step bar plus clickable event markers, the current one marked', () => {
    const html = renderToStaticMarkup(<Timeline player={player(factorialTrace, 7)} />);
    expect(html).toContain('aria-label="Timeline: jump to a step"');
    expect(html).toContain('aria-valuetext="Step 8 of 12"');
    expect(html.match(/title="Jump to step/g)).toHaveLength(8);
    expect(html).toMatch(/aria-current="step" title="Jump to step 8: factorial\(2\) returns"/);
  });

  it('timeline: no marker row when nothing reliable can be derived', () => {
    const t: Trace = { ...factorialTrace, steps: factorialTrace.steps.slice(0, 1) };
    const html = renderToStaticMarkup(<Timeline player={player(t, 0)} />);
    expect(html).not.toContain('aria-label="Events"');
  });
});
