#!/usr/bin/env node
/**
 * Record the package samples with the real packages, into committed fixtures:
 *
 * - Phase 29: `src/python/samples/packages/numpy-pandas.py` → `src/python/fixtures/packages-numpy-pandas.json`;
 * - Phase 34: every `src/python/samples/numpy/<name>.py` → `src/python/fixtures/numpy/<name>.json`;
 * - Phase 35: every `src/python/samples/pandas/<name>.py` → `src/python/fixtures/pandas/<name>.json`,
 *   with the sample data files (`src/python/data/*.csv`) in the working directory, as the worker
 *   writes them before every run;
 * - Phase 36: every `src/python/samples/matplotlib/<name>.py` → `src/python/fixtures/matplotlib/<name>.json`,
 *   with matplotlib (Agg backend) and its pyplot imported first, as the worker does.
 *
 *   node scripts/record-python-packages-fixture.mjs        (npm run py:record-packages)
 *
 * Opt-in and **needs network**: Pyodide in Node downloads the numpy/pandas/matplotlib wheels from jsDelivr at
 * the pinned version (into a temp cache dir, not node_modules) — the same CDN and version the app
 * uses, nothing else. `npm test` never runs this; the tests read the fixtures it writes. Each program
 * runs with the default limits, exactly as `recorder.py` runs in the worker. Node ≥ 22.18 (imports
 * `protocol.ts` directly).
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPyodide } from 'pyodide';
import { resolveLimits } from '../src/python/protocol.ts';

const recorder = readFileSync('src/python/recorder.py', 'utf8');

/** [source file, fixture file] pairs. */
const jobs = [
  ['src/python/samples/packages/numpy-pandas.py', 'src/python/fixtures/packages-numpy-pandas.json'],
];
for (const lib of ['numpy', 'pandas', 'matplotlib']) {
  const dir = `src/python/samples/${lib}`;
  mkdirSync(`src/python/fixtures/${lib}`, { recursive: true });
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.py'))
    .sort()) {
    jobs.push([join(dir, file), `src/python/fixtures/${lib}/${file.replace(/\.py$/, '.json')}`]);
  }
}
/** The sample data files (`installSampleFiles` in `src/python/data/index.ts` does the same). */
const dataDir = 'src/python/data';
const dataFiles = readdirSync(dataDir).filter((f) => f.endsWith('.csv'));

const pyodide = await loadPyodide({
  // A reusable cache dir may be given (`SE_VIZ_PYODIDE_CACHE`); by default a fresh temp dir.
  packageCacheDir:
    process.env.SE_VIZ_PYODIDE_CACHE ?? mkdtempSync(join(tmpdir(), 'se-viz-pyodide-')),
});
const t0 = performance.now();
await pyodide.loadPackage(['numpy', 'pandas', 'matplotlib'], { messageCallback: () => {} });
const loadMs = performance.now() - t0;
console.log(`numpy+pandas+matplotlib load ${Math.round(loadMs)} ms (Node ${process.version})`);
// Imported once, untraced, as the worker does (importing pandas inside the run would count against
// the program's time limit). matplotlib gets the Agg backend and its pyplot, as in the worker.
pyodide.runPython(
  [
    'import os',
    "os.environ['MPLBACKEND'] = 'Agg'",
    'import numpy',
    'import pandas',
    'import matplotlib',
    'import matplotlib.pyplot',
  ].join('\n'),
);

for (const [src, out] of jobs) {
  // A fresh recorder namespace per program, as each worker run gets fresh globals.
  for (const f of dataFiles) {
    pyodide.FS.writeFile(`${pyodide.FS.cwd()}/${f}`, readFileSync(join(dataDir, f), 'utf8'));
  }
  const namespace = pyodide.toPy({});
  pyodide.runPython(recorder, { globals: namespace, filename: 'se_viz_recorder.py' });
  const runJson = namespace.get('run_json');
  const source = readFileSync(src, 'utf8');
  const r0 = performance.now();
  const result = JSON.parse(runJson(source, '[]', JSON.stringify(resolveLimits({}))));
  const runMs = performance.now() - r0;
  writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
  console.log(
    `wrote ${out}: ${result.steps.length} snapshots, error ${result.error?.type ?? 'none'}, ` +
      `record ${Math.round(runMs)} ms`,
  );
  namespace.destroy();
}
