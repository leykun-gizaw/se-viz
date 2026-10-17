/**
 * The Python canvas, server-rendered (Phase 30): snapshots for aliasing, nested containers,
 * recursion and an instance, plus the structure each one must show.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { int, pyStep, ref, set, str, tuple } from '../../engine/trace/pythonTestKit.ts';
import type { Trace } from '../../engine/trace/types.ts';
import PythonCanvas from './PythonCanvas.tsx';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/**/*.json', {
  eager: true,
  import: 'default',
});
const trace = (name: string) => TRACES[`../../content/fixtures/python/${name}.json`];

function render(name: string, index: number): string {
  const t = trace(name);
  return renderToStaticMarkup(<PythonCanvas trace={t} step={t.steps[index]} />);
}

/** The anchors drawn, in document order (frames, names, references, objects). */
const anchors = (html: string) =>
  [...html.matchAll(/data-coach-anchor="([^"]+)"/g)].map((m) => m[1]);

describe('PythonCanvas', () => {
  it('aliasing: two names, two reference chips, one list box (mutated in place)', () => {
    const html = render('aliasing', 2);
    expect(anchors(html)).toEqual(['f1', 'f1.a', 'f1.b', 'o1']);
    expect(html).toContain('Global frame');
    // The one list holds 1, 2, 3 (b.append(3) changed the box both names point at).
    const values = [...html.matchAll(/font-semibold text-ink">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(values).toEqual(['Global frame', '1', '2', '3']);
    expect(html).not.toMatch(/allocated|malloc/i);
    expect(html).toMatchSnapshot();
  });

  it('nested containers: inner objects sit next to the container that holds them', () => {
    const html = render('nested-containers', 3);
    // fields' dict o1 with its two lists, then animals' list o4 with its two dicts.
    expect(anchors(html).filter((a) => /^o\d+$/.test(a))).toEqual([
      'o1',
      'o2',
      'o3',
      'o4',
      'o5',
      'o6',
    ]);
    expect(html).toContain('&#x27;sheep&#x27;');
    expect(html).toMatchSnapshot();
  });

  it('recursion: one frame per active call, in call order, the top one current', () => {
    const html = render('recursion', 9); // factorial(1) returns 1
    const frames = anchors(html).filter((a) => /^f\d+$/.test(a));
    expect(frames).toEqual(['f1', 'f2', 'f3', 'f4', 'f5']);
    // Four frame headers (the global frame's own `factorial` name is a row, not a header).
    expect(html.match(/text-\[13px\] font-semibold text-ink">factorial</g)).toHaveLength(4);
    expect(html).toContain('Return value');
    // The top frame (f5) carries the amber ring.
    expect(html).toMatch(/data-coach-anchor="f5" class="[^"]*border-active/);
    expect(html).toMatchSnapshot();
  });

  it('instance: class name, attribute rows, and the class and function boxes', () => {
    const html = render('class-instances', 14); // red.drive(3) returns; fuel is 70
    expect(html).toContain('>Tractor</span>');
    expect(html).toContain('instance');
    expect(html).toContain('>fuel</span>');
    expect(html).toContain('>70</span>');
    expect(html).toContain('>class</span>');
    expect(html).toMatchSnapshot();
  });

  it('the harvest dict shows key → value rows', () => {
    const t = trace('harvest');
    const html = render('harvest', t.steps.length - 1);
    for (const key of ['corn', 'wheat', 'beans']) expect(html).toContain(`&#x27;${key}&#x27;`);
    expect(html).toContain('>dict</span>');
  });

  it('tuple, set and NumPy / pandas summaries (placeholders for Phases 34–35)', () => {
    const step = pyStep(0, [['f1', '<module>', { t: ref('o1'), s: ref('o2'), g: ref('o3') }]], {
      o1: tuple(int(1), int(2)),
      o2: set(str('a'), str('b')),
      o3: { kind: 'summary', type: 'ndarray', library: 'numpy', shape: [2, 3], dtype: 'float64' },
    });
    const t: Trace = { id: 't', title: 't', language: 'python', source: 'pass\n', steps: [step] };
    const html = renderToStaticMarkup(<PythonCanvas trace={t} step={step} />);
    expect(html).toContain('>tuple</span>');
    expect(html).toContain('immutable');
    expect(html).toContain('unordered');
    expect(html).toContain('>numpy ndarray</span>');
    expect(html).toContain('>(2, 3)</span>');
    expect(html).toContain('>float64</span>');
    expect(html).toContain('summary only');
  });

  it('every step of every recording renders', () => {
    for (const [path, t] of Object.entries(TRACES)) {
      for (const step of t.steps) {
        expect(
          () => renderToStaticMarkup(<PythonCanvas trace={t} step={step} />),
          path,
        ).not.toThrow();
      }
    }
  });
});
