/**
 * The recorder's matplotlib figures (Phase 36).
 *
 * - **Offline, on every run:** the real `recorder.py` in the real Pyodide (Node), against the
 *   matplotlib stand-in (`MATPLOTLIB_STANDIN`): SVG / PNG / "too large" by size, the 6-figure cap,
 *   `fig.show()`, a figure that fails to draw, end-of-run capture, chart calls and labels, and that
 *   the recorder's patches are undone. The two programs are written to
 *   `fixtures/extra-matplotlib-*.json` (file snapshots), which the mapping tests below also use.
 * - **On the real recordings** of the five samples (`fixtures/matplotlib/*.json`, recorded with
 *   matplotlib 3.10 by `npm run py:record-packages`): figure count, the step each figure is attached
 *   to, and the format chosen.
 */
import { loadPyodide, type PyodideAPI } from 'pyodide';
import { beforeAll, describe, expect, it } from 'vitest';
import { figuresAt } from '../engine/trace/figures.ts';
import { validateTrace } from '../engine/trace/validate.ts';
import recorderSource from './recorder.py?raw';
import {
  FIGURE_BYTES_CAP,
  FIGURE_MAX_PIXELS,
  FIGURE_PNG_DPI,
  FIGURES_CAP,
  type PyFigure,
  type RunResult,
} from './protocol.ts';
import { MATPLOTLIB_SAMPLES } from './samples/matplotlib/index.ts';
import { createRecorderSession, type RecorderSession } from './session.ts';
import { MATPLOTLIB_STANDIN, MATPLOTLIB_STANDIN_PROGRAMS } from './testPrograms.ts';
import { recordingToTrace } from './toTrace.ts';

let pyodide: PyodideAPI;
let session: RecorderSession;

beforeAll(async () => {
  pyodide = await loadPyodide();
  // Installed untraced, before any run, as the worker imports the real matplotlib.
  pyodide.runPython(MATPLOTLIB_STANDIN);
  session = createRecorderSession(pyodide, recorderSource);
}, 60_000);

const program = (name: string) => {
  const p = MATPLOTLIB_STANDIN_PROGRAMS.find((x) => x.name === name);
  if (!p) throw new Error(name);
  return p;
};

/** Every figure of a run with the index of the snapshot that carries it. */
const figuresOf = (r: RunResult): (PyFigure & { snap: number })[] =>
  r.steps.flatMap((s, snap) => (s.figures ?? []).map((f) => ({ ...f, snap })));

/** The savefig calls the stand-in saw: `[figure number, format]`. */
const savefigLog = (): [number | string, string | null][] =>
  JSON.parse(
    pyodide.runPython('import json, sys\njson.dumps(sys.modules["matplotlib"].log)') as string,
  ) as [number | string, string | null][];
const clearLog = () => pyodide.runPython('import sys\nsys.modules["matplotlib"].log.clear()');

describe('caps', () => {
  it('recorder.py and protocol.ts agree', () => {
    expect(recorderSource).toContain(`FIGURES_CAP = ${FIGURES_CAP}`);
    expect(FIGURE_BYTES_CAP).toBe(300 * 1024);
    expect(recorderSource).toContain('FIGURE_BYTES_CAP = 300 * 1024');
    expect(recorderSource).toContain(`FIGURE_PNG_DPI = ${FIGURE_PNG_DPI}`);
    expect(FIGURE_MAX_PIXELS).toBe(3000 * 3000);
    expect(recorderSource).toContain('FIGURE_MAX_PIXELS = 3000 * 3000');
  });
});

describe('the stand-in programs record (offline)', () => {
  it.each(MATPLOTLIB_STANDIN_PROGRAMS.map((p) => [p.name, p.request] as const))(
    '%s matches its committed fixture',
    async (name, request) => {
      const result = session.run(request);
      expect(result.error).toBeUndefined();
      await expect(`${JSON.stringify(result, null, 1)}\n`).toMatchFileSnapshot(
        `./fixtures/${name}.json`,
      );
    },
  );

  it('picks SVG under the cap, else PNG at 100 dpi, else a "too large" note', () => {
    clearLog();
    const r = session.run(program('extra-matplotlib-standin').request);
    const figs = figuresOf(r);
    expect(figs.map((f) => [f.id, f.format, f.reason ?? null])).toEqual([
      ['fig1', 'svg', null],
      ['fig2', 'png', null], // SVG 400 KB: over the cap; PNG 2 KB
      ['fig3', 'none', 'too-large'], // 40 × 40 in at 100 dpi = 16 M pixels: no PNG even tried
      ['fig4', 'none', 'too-large'], // PNG 400 KB: over the cap too
      ['fig5', 'none', 'error'], // savefig raised
      ['fig6', 'svg', null],
      ['fig7', 'none', 'cap'], // the 7th figure of the run
      ['fig8', 'none', 'cap'],
    ]);
    expect(figs[0].data).toMatch(/^<svg /);
    expect(figs[0].bytes).toBe(600);
    expect(figs[1].data).toMatch(/^data:image\/png;base64,iVBOR/);
    expect(figs[1].bytes).toBe(2000);
    expect(figs[2].bytes).toBe(400 * 1024);
    expect(figs[3].bytes).toBe(400 * 1024);
    expect(figs[4].error).toBe('ValueError');
    for (const f of figs.filter((x) => x.format === 'none')) expect(f.data).toBeUndefined();
    // SVG as text (svg.fonttype none); a PNG only for the figures that may have one; nothing
    // rendered for the capped figures.
    // (Figure numbers restart at 1 once plt.show() has closed every figure, as in matplotlib.)
    expect(savefigLog().filter(([n]) => n !== 'rcdefaults')).toEqual([
      [1, 'svg:none'], // fig1
      [1, 'svg:none'], // fig2 (big): SVG over the cap ...
      [1, 'png'], // ... so a PNG
      [2, 'svg:none'], // fig3 (huge): no PNG tried
      [3, 'svg:none'], // fig4 (heavy)
      [3, 'png'],
      [1, 'svg:none'], // fig5 (broken): raised
      [1, 'svg:none'], // fig6; fig7 and fig8 are never rendered
    ]);
    expect(FIGURES_CAP).toBe(6);
  });

  it('attaches each figure to the snapshot after the line that showed it', () => {
    const r = session.run(program('extra-matplotlib-standin').request);
    const figs = figuresOf(r);
    const at = (id: string) => {
      const f = figs.find((x) => x.id === id)!;
      return { line: r.steps[f.snap].line, prevLine: r.steps[f.snap - 1].line };
    };
    expect(at('fig1')).toEqual({ prevLine: 5, line: 6 }); // plt.show() on line 5
    for (const id of ['fig2', 'fig3', 'fig4']) expect(at(id)).toEqual({ prevLine: 15, line: 16 });
    expect(at('fig5')).toEqual({ prevLine: 18, line: 19 }); // broken.show()
    // In the loop: plt.show() on line 23, then back to the for line.
    for (const id of ['fig6', 'fig7', 'fig8']) expect(at(id)).toEqual({ prevLine: 23, line: 19 });
    expect(new Set(figs.map((f) => f.trigger))).toEqual(new Set(['show']));
  });

  it('records the chart calls (outermost only), labels and sizes', () => {
    const figs = figuresOf(session.run(program('extra-matplotlib-standin').request));
    expect(figs[0].axes).toEqual([{ kinds: ['plot'], title: 'small' }]);
    expect(figs[0].title).toBe('small');
    expect(figs[1].axes).toEqual([{ kinds: ['hist'] }]); // hist draws with bar: not counted
    expect(figs[2]).toMatchObject({ width: 40, height: 40 });
    expect(figs[5].axes).toEqual([{ kinds: ['scatter'], xlabel: 'x' }]);
  });

  it('keeps the program output clean: no warnings, the real show never runs', () => {
    const r = session.run(program('extra-matplotlib-standin').request);
    expect(r.stdout).toBe('done\n');
  });

  it('captures figures still open at the end, with their axes, legend and suptitle', () => {
    const r = session.run(program('extra-matplotlib-end').request);
    const figs = figuresOf(r);
    expect(figs).toHaveLength(2);
    const lastSnap = r.steps.length - 1;
    expect(r.steps[lastSnap].event).toBe('return');
    expect(r.steps[lastSnap].frames).toHaveLength(1); // the module's own return
    for (const f of figs) {
      expect(f.snap).toBe(lastSnap);
      expect(f.trigger).toBe('end');
      expect(f.format).toBe('svg');
    }
    expect(figs[0]).toMatchObject({
      title: 'Two charts',
      axes: [{ kinds: ['plot', 'bar'], legend: ['rain'], ylabel: 'kg' }, { kinds: ['pie'] }],
    });
    expect(figs[1].axes).toEqual([{ kinds: ['bar'] }]);
    expect(figs[1].title).toBeUndefined();
  });

  it('undoes its patches after the run, and starts each run with no figure open', () => {
    session.run(program('extra-matplotlib-standin').request);
    // pyplot.show, Figure.show and the Axes methods are the stand-in's own again.
    expect(
      pyodide
        .runPython(
          [
            'import sys',
            'plt = sys.modules["matplotlib.pyplot"]',
            'Axes = sys.modules["matplotlib.axes"].Axes',
            'Figure = sys.modules["matplotlib.figure"].Figure',
            '(plt.show.__name__, Figure.show.__qualname__, Axes.hist.__qualname__,',
            ' hasattr(Axes.hist, "__wrapped__"), len(plt.get_fignums()))',
          ].join('\n'),
        )
        .toJs(),
    ).toEqual(['show', 'Figure.show', 'Axes.hist', false, 0]);
    // A figure left open outside a run (an earlier, killed run) is not this run's output.
    pyodide.runPython('import sys\nsys.modules["matplotlib.pyplot"].figure()');
    const r = session.run({ source: 'x = 1\n' });
    expect(figuresOf(r)).toEqual([]);
  });

  it('describes matplotlib objects as one opaque object each, without memory addresses', () => {
    const r = session.run(program('extra-matplotlib-standin').request);
    const last = r.steps[r.steps.length - 1];
    const ref = last.frames[0].vars.find((v) => v.name === 'ax')!.value;
    expect(ref.kind).toBe('ref');
    const ax = last.objects[(ref as { id: string }).id];
    expect(ax).toEqual({ kind: 'other', type: 'Axes', repr: '<Axes>' });
  });

  it('does nothing when matplotlib is not loaded', () => {
    // The Phase 29–35 recordings (recorder.test.ts) prove programs without it record as before;
    // here: with the modules gone, a run neither imports nor patches anything.
    pyodide.runPython(
      'import sys\nsaved = {k: sys.modules.pop(k) for k in list(sys.modules) if k.startswith("matplotlib")}',
    );
    try {
      const r = session.run({ source: 'import sys\nloaded = "matplotlib" in sys.modules\n' });
      const last = r.steps[r.steps.length - 1];
      expect(last.frames[0].vars.find((v) => v.name === 'loaded')?.value).toMatchObject({
        repr: 'False',
      });
      expect(figuresOf(r)).toEqual([]);
    } finally {
      pyodide.runPython('import sys\nsys.modules.update(saved)');
    }
  });
});

/* ───────────────────────── the recorded samples ───────────────────────── */

const RAW = import.meta.glob<string>('./fixtures/**/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const recording = (name: string): RunResult => {
  const text = RAW[`./fixtures/${name}.json`];
  if (text === undefined) throw new Error(`missing recording ${name}`);
  return JSON.parse(text) as RunResult;
};
const sampleTrace = (name: string) => {
  const s = MATPLOTLIB_SAMPLES.find((x) => x.name === name)!;
  return recordingToTrace(recording(`matplotlib/${name}`), s.source, { id: name, title: name });
};

describe('the recorded matplotlib samples (Phase 36)', () => {
  it('figure count, chart calls and format per sample', () => {
    const summary = Object.fromEntries(
      MATPLOTLIB_SAMPLES.map((s) => {
        const figs = figuresOf(recording(`matplotlib/${s.name}`));
        return [
          s.name,
          figs.map((f) => ({
            format: f.format,
            trigger: f.trigger,
            kinds: f.axes.map((a) => a.kinds.join('+')),
          })),
        ];
      }),
    );
    expect(summary).toEqual({
      line: [{ format: 'svg', trigger: 'show', kinds: ['plot'] }],
      scatter: [{ format: 'svg', trigger: 'show', kinds: ['scatter'] }],
      bar: [{ format: 'svg', trigger: 'end', kinds: ['bar'] }],
      histogram: [
        { format: 'svg', trigger: 'show', kinds: ['hist'] },
        { format: 'svg', trigger: 'show', kinds: ['hist'] },
      ],
      subplots: [{ format: 'svg', trigger: 'show', kinds: ['plot', 'bar'] }],
    });
  });

  it('every SVG is under the 300 KB cap, and its byte count is its size', () => {
    for (const s of MATPLOTLIB_SAMPLES) {
      for (const f of figuresOf(recording(`matplotlib/${s.name}`))) {
        expect(f.bytes).toBeLessThan(FIGURE_BYTES_CAP);
        expect(new TextEncoder().encode(f.data).length).toBe(f.bytes);
      }
    }
  });

  it('each figure is on the step whose line showed it (bar: the last step)', () => {
    const showLines: Record<string, number[]> = {
      line: [10],
      scatter: [11],
      histogram: [8, 14],
      subplots: [16],
    };
    for (const s of MATPLOTLIB_SAMPLES) {
      const trace = sampleTrace(s.name);
      expect(validateTrace(trace)).toEqual([]);
      const lines = (trace.figures ?? []).map((f) => trace.steps[f.step].highlightedLines[0]);
      if (s.name === 'bar') {
        expect(trace.figures?.map((f) => f.step)).toEqual([trace.steps.length - 1]);
      } else {
        expect(lines).toEqual(showLines[s.name]);
      }
    }
  });

  it('labels and titles come from matplotlib', () => {
    const figs = figuresOf(recording('matplotlib/subplots'));
    expect(figs[0]).toMatchObject({
      title: 'Dairy week',
      width: 9,
      height: 3.5,
      axes: [
        { title: 'Milk per day', xlabel: 'Day', ylabel: 'Litres' },
        { title: 'Milk per goat' },
      ],
    });
  });
});

describe('the stand-in recordings as traces', () => {
  it('map to valid traces whose figures follow the steps', () => {
    const p = program('extra-matplotlib-standin');
    const trace = recordingToTrace(recording('extra-matplotlib-standin'), p.request.source, {
      id: 'x',
      title: 'x',
    });
    expect(validateTrace(trace)).toEqual([]);
    expect(trace.figures).toHaveLength(8);
    const end = trace.steps.length - 1;
    expect(figuresAt(trace.figures, end)).toHaveLength(8);
    expect(figuresAt(trace.figures, 0)).toHaveLength(0);
  });
});
