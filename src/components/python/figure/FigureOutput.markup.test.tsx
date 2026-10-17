/**
 * Figure output (Phase 36), server-rendered: the console thumbnails (names, the "new" mark, PNG
 * and note badges), a PNG shown only from a valid `data:image/png;base64,` URL, notes for figures
 * without an image, the large view's header, and the stage showing the strip only once a figure
 * exists. An SVG is mounted by a layout effect (DOMParser, in the browser), so server markup never
 * contains figure SVG at all.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Trace, TraceFigure } from '../../../engine/trace/types.ts';
import { useTrace } from '../../../engine/trace/useTrace.ts';
import { Stage } from '../../Stage.tsx';
import { FigureImage, FigureStrip, FigureViewer } from './FigureOutput.tsx';
import { chartWords, formatText, missingText } from './figureText.ts';

const base: TraceFigure = {
  id: 'fig1',
  step: 3,
  number: 1,
  trigger: 'show',
  title: 'Rainfall by month',
  width: 6.4,
  height: 4.8,
  axes: [
    { kinds: ['plot'], title: 'Rainfall by month', xlabel: 'Month', ylabel: 'mm', legend: null },
  ],
  format: 'svg',
  bytes: 12_344,
  data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>',
};
const png: TraceFigure = {
  ...base,
  id: 'fig2',
  step: 5,
  title: null,
  axes: [{ kinds: ['scatter'], title: null, xlabel: null, ylabel: null, legend: null }],
  format: 'png',
  bytes: 2000,
  data: 'data:image/png;base64,iVBORw0KGgo=',
};
/** The base figure without its image. */
const noImage: Omit<TraceFigure, 'data'> = Object.fromEntries(
  Object.entries(base).filter(([k]) => k !== 'data'),
) as Omit<TraceFigure, 'data'>;
const capped: TraceFigure = {
  ...noImage,
  id: 'fig7',
  format: 'none',
  reason: 'cap',
  bytes: null,
};
const large: TraceFigure = {
  ...noImage,
  id: 'fig3',
  format: 'none',
  reason: 'too-large',
  bytes: 1_500_000,
};

describe('FigureStrip', () => {
  const html = renderToStaticMarkup(
    <FigureStrip
      figures={[base, png, large, capped]}
      current={5}
      openId={null}
      onOpen={() => {}}
    />,
  );

  it('lists every visible figure as a button, with its name and title', () => {
    expect(html).toContain('aria-label="Figures"');
    expect(html.match(/<button/g)).toHaveLength(4);
    for (const name of ['Figure 1', 'Figure 2', 'Figure 3', 'Figure 7'])
      expect(html).toContain(name);
    expect(html).toContain('Rainfall by month');
    expect(html).toContain('scatter plot'); // no title: the chart words
  });

  it('marks only the figures this step produced as new', () => {
    expect(html.match(/>new</g)).toHaveLength(1);
    expect(html.indexOf('>new<')).toBeGreaterThan(html.indexOf('Figure 2'));
  });

  it('shows a PNG only as its data URL, and notes for figures without an image', () => {
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).toContain('Figure too large to show');
    expect(html).toContain('Not kept: at most 6 figures per run');
  });

  it('never puts figure SVG into server markup', () => {
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('script');
  });

  it('renders nothing with no figures', () => {
    expect(
      renderToStaticMarkup(
        <FigureStrip figures={[]} current={0} openId={null} onOpen={() => {}} />,
      ),
    ).toBe('');
  });
});

describe('FigureImage', () => {
  it('refuses a PNG figure whose data is not a base64 PNG data URL', () => {
    for (const data of [
      'javascript:alert(1)',
      'https://evil.example/x.png',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png;base64,AAA" onerror="alert(1)',
    ]) {
      const html = renderToStaticMarkup(<FigureImage figure={{ ...png, data }} />);
      expect(html).not.toContain('<img');
      expect(html).toContain('could not be shown safely');
    }
  });
});

describe('FigureViewer', () => {
  it('names the figure, its chart, format, size and step, and has a Close button', () => {
    const html = renderToStaticMarkup(<FigureViewer figure={base} total={2} onClose={() => {}} />);
    expect(html).toContain('Figure 1, large view');
    expect(html).toContain(
      'line plot · SVG · 12 KB · step 4 · shown by plt.show() · 1 of 2 shown so far',
    );
    expect(html).toMatch(/<button[^>]*>Close/);
  });
});

describe('figure text', () => {
  it('chart words, format and missing-image notes', () => {
    expect(
      chartWords({ ...base, axes: [...base.axes, { ...base.axes[0], kinds: ['bar', 'hist'] }] }),
    ).toBe('line plot, bar chart and histogram');
    expect(chartWords({ ...base, axes: [] })).toBeNull();
    expect(formatText(large)).toBe('no image · 1.4 MB');
    expect(formatText(capped)).toBe('not kept');
    expect(formatText(png)).toBe('PNG · 2 KB');
    expect(missingText({ ...large, reason: 'error' })).toBe(
      'matplotlib could not draw this figure',
    );
  });
});

/* ── the stage ── */

const TRACES = import.meta.glob<Trace>('../../../content/fixtures/python/matplotlib/*.json', {
  eager: true,
  import: 'default',
});

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  });
});
afterEach(() => vi.unstubAllGlobals());

function Host({ trace }: { trace: Trace }) {
  return <Stage player={useTrace(trace)} />;
}

describe('the stage with a matplotlib trace', () => {
  it.each(Object.entries(TRACES))(
    '%s renders, with no figure strip at the first step',
    (_p, trace) => {
      expect(trace.figures?.length).toBeGreaterThan(0);
      // The first figure comes after the first step in every sample, so there is nothing to show yet.
      expect(trace.figures![0].step).toBeGreaterThan(0);
      const html = renderToStaticMarkup(<Host trace={trace} />);
      expect(html).not.toContain('Loading figures');
      expect(html).not.toContain('aria-label="Figures"');
    },
  );
});
