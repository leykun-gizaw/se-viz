import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMarkdown } from '../engine/markdown.ts';
import { DiagramView } from './Diagram.tsx';
import { Markdown } from './Markdown.tsx';
import {
  SECURE_KEYS,
  TOKEN_THEME_VARIABLES,
  buildMermaidConfig,
  ensureInitialized,
  nextMermaidId,
  renderMermaid,
  svgProblem,
  themeVariablesFromTokens,
  watchTheme,
  type MermaidApi,
  type ThemeObserver,
} from './mermaidRuntime.ts';

/**
 * Mermaid is mocked: the vitest env is `node` (no DOM for Mermaid to lay out in), and the point of
 * these tests is our containment logic, not Mermaid's drawing. The factory counts how often the
 * module is actually loaded, which is how the lazy-import guarantee is asserted.
 */
const mock = vi.hoisted(() => ({
  loads: 0,
  initialize: vi.fn(),
  parse: vi.fn(async () => ({ diagramType: 'flowchart', config: {} })),
  render: vi.fn(async (id: string) => ({
    svg: `<svg id="${id}"><g/></svg>`,
    diagramType: 'flowchart',
  })),
}));

vi.mock('mermaid', () => {
  mock.loads += 1;
  return {
    default: { initialize: mock.initialize, parse: mock.parse, render: mock.render },
  };
});

const DARK: Record<string, string> = {
  '--se-surface': '#16181d',
  '--se-surface-2': '#1d2026',
  '--se-text': '#e7e9ec',
  '--se-pointer': '#5b93ff',
};
const LIGHT: Record<string, string> = {
  '--se-surface': '#ffffff',
  '--se-surface-2': '#f1efea',
  '--se-text': '#1b1e24',
  '--se-pointer': '#2563eb',
};
const varsFor = (tokens: Record<string, string>, dark: boolean) =>
  themeVariablesFromTokens((t) => tokens[t] ?? '', { dark, fontFamily: 'Manrope' });

/** A fresh mocked API object per test (so `ensureInitialized`'s per-instance cache starts empty). */
function freshApi(): MermaidApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    initialize: vi.fn(() => void calls.push('init')),
    parse: vi.fn(async () => {
      calls.push('parse');
      return { diagramType: 'flowchart', config: {} };
    }),
    render: vi.fn(async (id: string) => {
      calls.push(`render:${id}`);
      return { svg: `<svg id="${id}"></svg>`, diagramType: 'flowchart' };
    }),
  } as MermaidApi & { calls: string[] };
}

beforeEach(() => {
  mock.initialize.mockClear();
  mock.parse.mockClear();
  mock.render.mockClear();
});

describe('lazy import', () => {
  it('parsing and rendering decks (incl. a mermaid fence) never loads Mermaid; rendering one does', async () => {
    const md = [
      '```call-stack',
      'main()',
      '```',
      '',
      '```mermaid',
      '%% caption: c',
      'flowchart LR',
      '  A --> B',
      '```',
    ].join('\n');
    const blocks = parseMarkdown(md);
    // In-house diagram + the Mermaid block's server render (effects don't run → no import).
    const html = renderToStaticMarkup(createElement(Markdown, { blocks, scale: 'slide' }));
    for (const b of blocks)
      if (b.type === 'diagram')
        renderToStaticMarkup(createElement(DiagramView, { diagram: b.diagram }));
    expect(html).toContain('<svg'); // the call-stack drew
    expect(html).toContain('data-mermaid="loading"'); // the Mermaid block reserved its slot
    expect(mock.loads).toBe(0);

    const out = await renderMermaid('flowchart LR\n  A --> B', {
      themeVariables: varsFor(DARK, true),
    });
    expect(out.ok).toBe(true);
    expect(mock.loads).toBe(1);
    expect(mock.render).toHaveBeenCalledTimes(1);
  });
});

describe('themeVariablesFromTokens', () => {
  it('maps every listed variable from its --se-* token, flat (no gradient / shadow)', () => {
    const vars = varsFor(DARK, true);
    expect(vars).toMatchObject({
      darkMode: true,
      fontFamily: 'Manrope',
      useGradient: false,
      dropShadow: 'none',
      background: '#16181d',
      primaryColor: '#1d2026',
      primaryTextColor: '#e7e9ec',
      lineColor: '#5b93ff', // arrows are azure
      transitionColor: '#5b93ff',
      signalColor: '#5b93ff',
    });
    expect(Object.values(TOKEN_THEME_VARIABLES).every((t) => t.startsWith('--se-'))).toBe(true);
  });

  it('skips empty tokens so Mermaid derives them instead of choking on ""', () => {
    const vars = themeVariablesFromTokens((t) => (t === '--se-pointer' ? ' #5b93ff ' : ''), {
      dark: false,
    });
    expect(vars.lineColor).toBe('#5b93ff'); // trimmed
    expect('primaryColor' in vars).toBe(false);
    expect(vars.fontFamily).toMatch(/Manrope/); // fallback stack
  });

  it('differs between the two themes', () => {
    expect(varsFor(DARK, true)).not.toEqual(varsFor(LIGHT, false));
    expect(varsFor(LIGHT, false).darkMode).toBe(false);
  });
});

describe('buildMermaidConfig', () => {
  it('is strict, base-themed, classic-look, no HTML labels, no auto-start', () => {
    const vars = varsFor(DARK, true);
    const cfg = buildMermaidConfig(vars);
    expect(cfg).toMatchObject({
      startOnLoad: false,
      securityLevel: 'strict',
      htmlLabels: false,
      theme: 'base',
      look: 'classic',
      layout: 'dagre', // not Mermaid 12's default ELK (a ~1.4 MB extra chunk)
      suppressErrorRendering: true,
      fontFamily: 'Manrope',
    });
    expect(cfg.themeVariables).toBe(vars);
  });

  it("locks the security and theme keys against a diagram's own directives", () => {
    for (const key of [
      'securityLevel',
      'htmlLabels',
      'theme',
      'themeVariables',
      'themeCSS',
      'look',
    ]) {
      expect(SECURE_KEYS).toContain(key);
    }
    expect(buildMermaidConfig({}).secure).toBe(SECURE_KEYS);
  });
});

describe('nextMermaidId', () => {
  it('is unique per call and CSS-selector safe', () => {
    const ids = Array.from({ length: 50 }, () => nextMermaidId());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('gives two diagrams rendered at once (one slide) different ids', async () => {
    const api = freshApi();
    const themeVariables = varsFor(DARK, true);
    const [a, b] = await Promise.all([
      renderMermaid('flowchart LR\n A', { themeVariables, load: async () => api }),
      renderMermaid('flowchart LR\n B', { themeVariables, load: async () => api }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.id).not.toBe(b.id);
      expect(a.svg).toContain(`id="${a.id}"`);
    }
  });
});

describe('renderMermaid — fallback decisions', () => {
  it('a mermaid.parse rejection is a parse failure and never reaches render', async () => {
    const api = freshApi();
    vi.mocked(api.parse).mockRejectedValueOnce(new Error('Parse error on line 1'));
    const out = await renderMermaid('not mermaid (((', {
      themeVariables: varsFor(DARK, true),
      load: async () => api,
    });
    expect(out).toMatchObject({ ok: false, stage: 'parse' });
    expect(api.render).not.toHaveBeenCalled();
  });

  it('a failed import is an import failure (never throws)', async () => {
    const out = await renderMermaid('flowchart LR', {
      themeVariables: varsFor(DARK, true),
      load: () => Promise.reject(new Error('chunk load failed')),
    });
    expect(out).toMatchObject({ ok: false, stage: 'import' });
  });

  it('a render rejection, or output that would need HTML, is a render failure', async () => {
    const api = freshApi();
    vi.mocked(api.render).mockRejectedValueOnce(new Error('boom'));
    const opts = { themeVariables: varsFor(DARK, true), load: async () => api };
    expect(await renderMermaid('flowchart LR', opts)).toMatchObject({ ok: false, stage: 'render' });

    vi.mocked(api.render).mockResolvedValueOnce({
      svg: '<svg><foreignObject><div>x</div></foreignObject></svg>',
      diagramType: 'flowchart',
    });
    expect(await renderMermaid('flowchart LR', opts)).toMatchObject({ ok: false, stage: 'render' });
  });

  it('serializes initialize → parse → render so concurrent diagrams never interleave', async () => {
    const api = freshApi();
    const opts = (dark: boolean) => ({
      themeVariables: varsFor(dark ? DARK : LIGHT, dark),
      load: async () => api,
      id: dark ? 'dark' : 'light',
    });
    await Promise.all([renderMermaid('a', opts(true)), renderMermaid('b', opts(false))]);
    expect(api.calls).toEqual(['init', 'parse', 'render:dark', 'init', 'parse', 'render:light']);
  });
});

describe('svgProblem', () => {
  it('accepts plain SVG and rejects HTML labels, scripts, handlers and javascript: URLs', () => {
    expect(svgProblem('<svg id="x"><text>count == CAP, on empty</text></svg>')).toBeNull();
    expect(svgProblem('<div>no</div>')).toMatch(/not an <svg>/);
    expect(svgProblem('<svg><foreignObject/></svg>')).toMatch(/HTML labels/);
    expect(svgProblem('<svg><script>x()</script></svg>')).toMatch(/script/);
    expect(svgProblem('<svg><g onclick="x()"/></svg>')).toMatch(/event handler/);
    expect(svgProblem('<svg><a href="javascript:x()"/></svg>')).toMatch(/javascript/);
  });
});

/** A hand-driven stand-in for MutationObserver (node has none). */
class FakeObserver implements ThemeObserver {
  static last: FakeObserver | null = null;
  observed: MutationObserverInit | null = null;
  disconnected = false;
  private readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeObserver.last = this;
  }
  observe(_target: Node, options: MutationObserverInit) {
    this.observed = options;
  }
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.callback();
  }
}

function fakeRoot(theme: string) {
  return { dataset: { theme } } as unknown as Node & { dataset: DOMStringMap };
}

describe('theme changes', () => {
  it('watchTheme fires only when data-theme actually changes, and unsubscribes', () => {
    const root = fakeRoot('dark');
    const onChange = vi.fn();
    const stop = watchTheme(root, onChange, FakeObserver);
    const obs = FakeObserver.last!;
    expect(obs.observed).toEqual({ attributes: true, attributeFilter: ['data-theme'] });

    obs.fire(); // attribute rewritten to the same value
    expect(onChange).not.toHaveBeenCalled();
    root.dataset.theme = 'light';
    obs.fire();
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    expect(obs.disconnected).toBe(true);
  });

  it('a theme flip re-renders with the new tokens: re-initialize + a fresh id', async () => {
    const api = freshApi();
    const root = fakeRoot('dark');
    const ids: string[] = [];
    const tokens = () => (root.dataset.theme === 'dark' ? DARK : LIGHT);
    const draw = async () => {
      const out = await renderMermaid('flowchart LR', {
        themeVariables: varsFor(tokens(), root.dataset.theme === 'dark'),
        load: async () => api,
      });
      if (out.ok) ids.push(out.id);
    };
    // The component's wiring: render once, then again on every theme change.
    await draw();
    let pending: Promise<void> = Promise.resolve();
    watchTheme(root, () => void (pending = draw()), FakeObserver);
    root.dataset.theme = 'light';
    FakeObserver.last!.fire();
    await pending;

    expect(api.render).toHaveBeenCalledTimes(2);
    expect(new Set(ids).size).toBe(2);
    expect(api.initialize).toHaveBeenCalledTimes(2);
    const lightCfg = vi.mocked(api.initialize).mock.calls[1][0];
    expect(lightCfg.themeVariables).toMatchObject({ darkMode: false, lineColor: '#2563eb' });
  });

  it('initializes once per theme, not once per diagram', () => {
    const api = freshApi();
    expect(ensureInitialized(api, varsFor(DARK, true))).toBe(true);
    expect(ensureInitialized(api, varsFor(DARK, true))).toBe(false);
    expect(ensureInitialized(api, varsFor(LIGHT, false))).toBe(true);
    expect(api.initialize).toHaveBeenCalledTimes(2);
  });
});
