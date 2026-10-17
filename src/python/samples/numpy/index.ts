/**
 * The Phase 34 NumPy sample programs (`*.py` in this folder). They need the real NumPy, so they are
 * recorded by the opt-in `npm run py:record-packages` (network: the pinned Pyodide CDN only) into
 * `src/python/fixtures/numpy/<name>.json`; `npm test` only reads those recordings.
 */
const SOURCES = import.meta.glob<string>('./*.py', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface NumpySample {
  /** File stem: the recording and trace name. */
  name: string;
  title: string;
  source: string;
}

function sample(name: string, title: string): NumpySample {
  const source = SOURCES[`./${name}.py`];
  if (source === undefined) throw new Error(`missing NumPy sample ${name}.py`);
  return { name, title, source };
}

export const NUMPY_SAMPLES: NumpySample[] = [
  sample('create', 'NumPy: creating arrays (1-D, 2-D, 3-D)'),
  sample('index-slice', 'NumPy: indexing and slicing'),
  sample('views', 'NumPy: views versus copies'),
  sample('arithmetic', 'NumPy: elementwise arithmetic and broadcasting'),
  sample('aggregate', 'NumPy: sum, mean and max, with axis'),
  sample('reshape', 'NumPy: reshape and transpose'),
  sample('masks', 'NumPy: boolean masks'),
  sample('capped', 'NumPy: a large array (capped) and a 4-D array'),
  sample('mixed', 'NumPy: chained calls, views of an unnamed array, a 3-D slice'),
];
