/**
 * Markup checks for Python live coding (Phase 31), rendered with `renderToStaticMarkup` (node test
 * environment, no DOM): the course-map entry is always there while C stays gated, and the view's
 * shell has the editor, stdin, limits, Reset and Run, restoring what was stored.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG } from '../../content/catalog.ts';
import { factorialTrace } from '../../content/se200/recursion/factorial.ts';
import { PY_LIMITS_KEY, PY_STDIN_KEY } from '../../python/live/input.ts';
import { LIVE_PYTHON_ID } from '../../python/live/config.ts';
import { ContentSidebar } from '../ContentSidebar.tsx';
import { useCourseMapNav } from '../studio/useCourseMapNav.ts';
import { PythonLiveView } from './PythonLiveView.tsx';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

function Sidebar({
  liveCodingEnabled,
  selectedId,
}: {
  liveCodingEnabled: boolean;
  selectedId: string;
}) {
  const nav = useCourseMapNav(CATALOG, factorialTrace.id);
  return (
    <ContentSidebar
      courses={CATALOG}
      selectedId={selectedId}
      onSelect={() => {}}
      collapsed={false}
      onCollapse={() => {}}
      onExpand={() => {}}
      liveCodingEnabled={liveCodingEnabled}
      nav={nav}
    />
  );
}

describe('course map entry', () => {
  it('"Live coding · Python" is always present; the C entry only when enabled', () => {
    const without = renderToStaticMarkup(
      <Sidebar liveCodingEnabled={false} selectedId={factorialTrace.id} />,
    );
    expect(without).toContain('Live coding · Python');
    expect(without).not.toContain('run C');
    const withC = renderToStaticMarkup(
      <Sidebar liveCodingEnabled selectedId={factorialTrace.id} />,
    );
    expect(withC).toContain('Live coding · Python');
    expect(withC).toContain('run C');
  });

  it('marks the Python entry current when selected', () => {
    const html = renderToStaticMarkup(
      <Sidebar liveCodingEnabled={false} selectedId={LIVE_PYTHON_ID} />,
    );
    expect(html).toMatch(/aria-current="true"[^>]*>.*Live coding · Python/);
  });
});

describe('PythonLiveView shell', () => {
  const render = () =>
    renderToStaticMarkup(
      <PythonLiveView
        theme="dark"
        onToggleTheme={() => {}}
        explanationSlot={null}
        onCollapseExplanation={() => {}}
        explanationWidth={320}
      />,
    );

  it('has the editor, stdin box, limits with defaults, Reset and Run', () => {
    const html = render();
    expect(html).toContain('Live coding · Python');
    expect(html).toContain('aria-label="Python source editor"');
    expect(html).toContain('main.py');
    expect(html).toContain('one line per input()');
    expect(html).toContain('aria-label="Steps limit"');
    expect(html).toMatch(/max="5000" aria-label="Steps limit"[^>]*value="1000"/);
    expect(html).toMatch(/aria-label="Time limit"[^>]*value="10"/);
    expect(html).toMatch(/aria-label="Output limit"[^>]*value="500"/);
    expect(html).toContain('>Reset<');
    expect(html).toContain('title="Run (⌘/Ctrl+Enter)"');
    expect(html).toContain('press Run (⌘/Ctrl+Enter)');
  });

  it('restores the stored stdin and (clamped) limits', () => {
    store.set(PY_STDIN_KEY, JSON.stringify('Ada\nBob'));
    store.set(PY_LIMITS_KEY, JSON.stringify({ maxSteps: 99999, timeoutS: 5 }));
    const html = render();
    expect(html).toContain('Ada\nBob</textarea>');
    expect(html).toMatch(/aria-label="Steps limit"[^>]*value="5000"/);
    expect(html).toMatch(/aria-label="Time limit"[^>]*value="5"/);
  });
});
