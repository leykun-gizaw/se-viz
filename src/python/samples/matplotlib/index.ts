/**
 * The Phase 36 matplotlib sample programs (`*.py` in this folder): a line chart, a scatter plot, a
 * bar chart (never shown with `plt.show()`, so it is captured when the program ends), two histograms
 * shown one after the other, and one figure with two subplots. They need the real matplotlib, so
 * they are recorded by the opt-in `npm run py:record-packages` (network: the pinned Pyodide CDN
 * only) into `src/python/fixtures/matplotlib/<name>.json`; `npm test` only reads those recordings.
 */
const SOURCES = import.meta.glob<string>('./*.py', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface MatplotlibSample {
  /** File stem: the recording and trace name. */
  name: string;
  title: string;
  source: string;
}

function sample(name: string, title: string): MatplotlibSample {
  const source = SOURCES[`./${name}.py`];
  if (source === undefined) throw new Error(`missing matplotlib sample ${name}.py`);
  return { name, title, source };
}

export const MATPLOTLIB_SAMPLES: MatplotlibSample[] = [
  sample('line', 'matplotlib: a line chart'),
  sample('scatter', 'matplotlib: a scatter plot'),
  sample('bar', 'matplotlib: a bar chart, captured at the end'),
  sample('histogram', 'matplotlib: two histograms'),
  sample('subplots', 'matplotlib: one figure, two subplots'),
];
