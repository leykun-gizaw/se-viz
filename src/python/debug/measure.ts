/**
 * Measurement helpers for the Phase 29 report, exposed on `window.__pythonSpike` by the dev-only
 * debug page so a browser automation (or a human in DevTools) can call them one at a time and
 * control what is cached.
 */
import { PythonRunner } from '../client.ts';
import type { AllowedPackage, RunRequest } from '../protocol.ts';
import { SAMPLES } from '../samples/index.ts';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round = (ms: number | null) => (ms === null ? null : Math.round(ms * 10) / 10);

/** A fresh worker's Pyodide load (`bootMs`) and its first trivial run, end to end. */
export async function coldLoad() {
  const runner = new PythonRunner();
  const outcome = await runner.run({ source: 'x = 1\n' });
  runner.dispose();
  return {
    bootMs: round(outcome.timings.bootMs),
    firstRunTotalMs: round(outcome.timings.totalMs),
  };
}

/** Warm runs: one worker, Pyodide already loaded; median of `n` round trips of a 1-line program. */
export async function warmRun(n = 7) {
  const runner = new PythonRunner();
  await runner.run({ source: 'x = 1\n' });
  const totals: number[] = [];
  const runs: number[] = [];
  for (let i = 0; i < n; i++) {
    const o = await runner.run({ source: 'x = 1\n' });
    totals.push(o.timings.totalMs);
    runs.push(o.timings.runMs ?? 0);
  }
  runner.dispose();
  return { medianTotalMs: round(median(totals)), medianRunMs: round(median(runs)) };
}

/** Package load in a fresh worker (Pyodide load excluded): `packagesMs` reported by the worker. */
export async function packageLoad(packages: AllowedPackage[], source = 'pass\n') {
  const runner = new PythonRunner();
  const outcome = await runner.run({ source, packages, limits: { timeoutMs: 30_000 } });
  runner.dispose();
  return {
    packages,
    bootMs: round(outcome.timings.bootMs),
    packagesMs: round(outcome.timings.packagesMs),
    runMs: round(outcome.timings.runMs),
    error: outcome.result.error ?? null,
    result: outcome.result,
  };
}

/** Trace time per sample on a warm worker: median of `n` runs (recording, and full round trip). */
export async function sampleTimes(n = 5, extra: { name: string; request: RunRequest }[] = []) {
  const runner = new PythonRunner();
  await runner.run({ source: 'x = 1\n' });
  const rows = [];
  for (const sample of [...SAMPLES, ...extra]) {
    const runs: number[] = [];
    const totals: number[] = [];
    let snapshots = 0;
    let bytes = 0;
    for (let i = 0; i < n; i++) {
      const o = await runner.run(sample.request);
      runs.push(o.timings.runMs ?? 0);
      totals.push(o.timings.totalMs);
      snapshots = o.result.steps.length;
      bytes = JSON.stringify(o.result).length;
    }
    rows.push({
      sample: sample.name,
      snapshots,
      jsonBytes: bytes,
      medianRunMs: round(median(runs)),
      medianTotalMs: round(median(totals)),
    });
  }
  runner.dispose();
  return rows;
}
