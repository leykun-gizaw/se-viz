/**
 * The Phase 35 pandas sample programs (`*.py` in this folder). They need the real pandas, so they are
 * recorded by the opt-in `npm run py:record-packages` (network: the pinned Pyodide CDN only) into
 * `src/python/fixtures/pandas/<name>.json`; `npm test` only reads those recordings. Most read the
 * bundled sample file `farm.csv` (`src/python/data/`), which the worker writes into Pyodide's file
 * system before every run.
 */
const SOURCES = import.meta.glob<string>('./*.py', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface PandasSample {
  /** File stem: the recording and trace name. */
  name: string;
  title: string;
  source: string;
}

function sample(name: string, title: string): PandasSample {
  const source = SOURCES[`./${name}.py`];
  if (source === undefined) throw new Error(`missing pandas sample ${name}.py`);
  return { name, title, source };
}

export const PANDAS_SAMPLES: PandasSample[] = [
  sample('read', 'pandas: reading farm.csv, head and info'),
  sample('select', 'pandas: selecting columns and rows (loc, iloc)'),
  sample('series', 'pandas: a Series'),
  sample('filter', 'pandas: boolean filtering'),
  sample('columns', 'pandas: new and changed columns'),
  sample('sort', 'pandas: sort_values'),
  sample('groupby', 'pandas: groupby, split, apply, combine'),
  sample('merge', 'pandas: merge'),
  sample('missing', 'pandas: missing values (isna, fillna, dropna)'),
  sample('capped', 'pandas: a large and a wide DataFrame (capped)'),
];
