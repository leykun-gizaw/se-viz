#!/usr/bin/env node
/**
 * Record the package samples with the real packages, into committed fixtures:
 *
 * - Phase 29: `src/python/samples/packages/numpy-pandas.py` → `src/python/fixtures/packages-numpy-pandas.json`;
 * - Phase 34: every `src/python/samples/numpy/<name>.py` → `src/python/fixtures/numpy/<name>.json`.
 *
 *   node scripts/record-python-packages-fixture.mjs        (npm run py:record-packages)
 *
 * Opt-in and **needs network**: Pyodide in Node downloads the numpy/pandas wheels from jsDelivr at
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
const jobs = [['src/python/samples/packages/numpy-pandas.py', 'src/python/fixtures/packages-numpy-pandas.json']];
const numpyDir = 'src/python/samples/numpy';
mkdirSync('src/python/fixtures/numpy', { recursive: true });
for (const file of readdirSync(numpyDir).filter((f) => f.endsWith('.py')).sort()) {
  jobs.push([join(numpyDir, file), `src/python/fixtures/numpy/${file.replace(/\.py$/, '.json')}`]);
}

const pyodide = await loadPyodide({
  packageCacheDir: mkdtempSync(join(tmpdir(), 'se-viz-pyodide-')),
});
const t0 = performance.now();
await pyodide.loadPackage(['numpy', 'pandas'], { messageCallback: () => {} });
const loadMs = performance.now() - t0;
console.log(`numpy+pandas load ${Math.round(loadMs)} ms (Node ${process.version})`);

for (const [src, out] of jobs) {
  // A fresh recorder namespace per program, as each worker run gets fresh globals.
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
