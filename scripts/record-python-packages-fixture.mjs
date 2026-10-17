#!/usr/bin/env node
/**
 * Phase 29: record the NumPy/pandas sample with the real packages, into a committed fixture.
 *
 *   node scripts/record-python-packages-fixture.mjs
 *
 * Opt-in and **needs network**: Pyodide in Node downloads the numpy/pandas wheels from jsDelivr at
 * the pinned version (into a temp cache dir, not node_modules). `npm test` never runs this; the
 * mapping tests read the fixture it writes. Node ≥ 22.18 (imports `protocol.ts` directly).
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPyodide } from 'pyodide';
import { resolveLimits } from '../src/python/protocol.ts';

const recorder = readFileSync('src/python/recorder.py', 'utf8');
const source = readFileSync('src/python/samples/packages/numpy-pandas.py', 'utf8');
const out = 'src/python/fixtures/packages-numpy-pandas.json';

const pyodide = await loadPyodide({
  packageCacheDir: mkdtempSync(join(tmpdir(), 'se-viz-pyodide-')),
});
const t0 = performance.now();
await pyodide.loadPackage(['numpy', 'pandas'], { messageCallback: () => {} });
const loadMs = performance.now() - t0;

const namespace = pyodide.toPy({});
pyodide.runPython(recorder, { globals: namespace, filename: 'se_viz_recorder.py' });
const runJson = namespace.get('run_json');
const r0 = performance.now();
const result = JSON.parse(runJson(source, '[]', JSON.stringify(resolveLimits({}))));
const runMs = performance.now() - r0;

writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
console.log(
  `wrote ${out}: ${result.steps.length} snapshots, error ${result.error?.type ?? 'none'}; ` +
    `numpy+pandas load ${Math.round(loadMs)} ms, record ${Math.round(runMs)} ms (Node ${process.version})`,
);
