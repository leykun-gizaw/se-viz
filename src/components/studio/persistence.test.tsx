/**
 * Hook-level persistence (Phase 28): side-panel widths and collapsed states survive a reload.
 *
 * The test environment is `node` (no DOM), so "a reload" is a fresh server render of a component
 * using the real hooks against the same stubbed `localStorage`. Writes go through the hooks' own
 * setters, called during render (React allows a component to update its own state while rendering).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistentState } from '../../hooks/usePersistentState.ts';
import { COURSE_MAP, EXPLANATION, type SidePanelSpec } from './panelLayout.ts';
import { storageKey, useSidePanel, type SidePanelControls } from './useSidePanel.ts';

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Render a component using `useSidePanel`, optionally acting on it once during render. */
function renderPanel(
  spec: SidePanelSpec,
  act?: (c: SidePanelControls) => void,
): { width: number; collapsed: boolean } {
  let acted = false;
  let seen = { width: -1, collapsed: false };
  function Probe() {
    const c = useSidePanel(spec);
    if (act && !acted) {
      acted = true;
      act(c);
    }
    seen = c.state;
    return <span />;
  }
  renderToStaticMarkup(<Probe />);
  return seen;
}

const key = (k: string) =>
  ({
    key: k,
    shiftKey: false,
    preventDefault: () => {},
  }) as unknown as React.KeyboardEvent<HTMLElement>;

describe('side panels persist across reloads', () => {
  it('first visit: defaults (both panels open at their default widths)', () => {
    expect(renderPanel(COURSE_MAP)).toEqual({ width: COURSE_MAP.defaultWidth, collapsed: false });
    expect(renderPanel(EXPLANATION)).toEqual({ width: EXPLANATION.defaultWidth, collapsed: false });
  });

  it('a keyboard resize is written and read back after a reload', () => {
    renderPanel(EXPLANATION, (c) => c.onSeparatorKeyDown(key('ArrowLeft')));
    expect(JSON.parse(store.get(storageKey(EXPLANATION))!)).toEqual({
      width: EXPLANATION.defaultWidth + 16,
      collapsed: false,
    });
    // "Reload": a fresh render reads the stored state.
    expect(renderPanel(EXPLANATION)).toEqual({
      width: EXPLANATION.defaultWidth + 16,
      collapsed: false,
    });
  });

  it('collapse survives a reload and restore brings back the same width', () => {
    renderPanel(COURSE_MAP, (c) => c.onSeparatorKeyDown(key('End'))); // widest
    renderPanel(COURSE_MAP, (c) => c.collapse());
    expect(renderPanel(COURSE_MAP)).toEqual({ width: COURSE_MAP.maxWidth, collapsed: true });
    renderPanel(COURSE_MAP, (c) => c.expand());
    expect(renderPanel(COURSE_MAP)).toEqual({ width: COURSE_MAP.maxWidth, collapsed: false });
  });

  it('the two panels persist independently', () => {
    renderPanel(EXPLANATION, (c) => c.collapse());
    expect(renderPanel(EXPLANATION).collapsed).toBe(true);
    expect(renderPanel(COURSE_MAP).collapsed).toBe(false);
  });

  it('corrupt or out-of-range stored state falls back safely', () => {
    store.set(storageKey(COURSE_MAP), '{not json');
    expect(renderPanel(COURSE_MAP)).toEqual({ width: COURSE_MAP.defaultWidth, collapsed: false });
    store.set(storageKey(COURSE_MAP), JSON.stringify({ width: 5, collapsed: true }));
    expect(renderPanel(COURSE_MAP)).toEqual({ width: COURSE_MAP.minWidth, collapsed: true });
  });
});

describe('usePersistentState', () => {
  it('writes through its setter and reads the value back on the next mount', () => {
    let acted = false;
    function Writer() {
      const [v, set] = usePersistentState('se-viz-test', 1);
      if (!acted) {
        acted = true;
        set((p) => p + 41);
      }
      return <i>{v}</i>;
    }
    expect(renderToStaticMarkup(<Writer />)).toBe('<i>42</i>');
    function Reader() {
      const [v] = usePersistentState('se-viz-test', 0);
      return <i>{v}</i>;
    }
    expect(renderToStaticMarkup(<Reader />)).toBe('<i>42</i>');
  });
});
