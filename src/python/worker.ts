/**
 * The Python worker (Phase 29 spike): a module Web Worker that loads Pyodide **once**, on its first
 * message, and records each requested program with `recorder.py`.
 *
 * Pyodide's JS loader is bundled from the pinned npm package; its runtime assets (wasm, stdlib,
 * wheels) come from jsDelivr at the same exact version ({@link PYODIDE_INDEX_URL}). Nothing here is
 * reachable from the main chunk: the main thread only ever references this file through
 * `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` in `client.ts`.
 *
 * The wall-clock limit is enforced from the main thread (it terminates this worker), because a
 * synchronous Python loop here can't be interrupted without cross-origin isolation.
 */
import { loadPyodide, type PyodideAPI } from 'pyodide';
import recorderSource from './recorder.py?raw';
import {
  ALLOWED_PACKAGES,
  type AllowedPackage,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol.ts';
import { createRecorderSession, type RecorderSession } from './session.ts';
import { PYODIDE_INDEX_URL } from './version.ts';

interface WorkerScope {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
}
const scope = self as unknown as WorkerScope;

let booting: Promise<{ pyodide: PyodideAPI; session: RecorderSession }> | null = null;

function boot() {
  booting ??= (async () => {
    const t0 = performance.now();
    const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    const session = createRecorderSession(pyodide, recorderSource);
    scope.postMessage({ type: 'loaded', ms: performance.now() - t0, version: pyodide.version });
    return { pyodide, session };
  })();
  return booting;
}

const allowed = new Set<string>(ALLOWED_PACKAGES);

async function handle(message: WorkerRequest): Promise<void> {
  const { id, request } = message;
  try {
    const { pyodide, session } = await boot();
    const packages: AllowedPackage[] = (request.packages ?? []).filter((p) => allowed.has(p));
    const p0 = performance.now();
    if (packages.length > 0) {
      await pyodide.loadPackage(packages, { messageCallback: () => {} });
      // Import them once here, untraced: importing pandas costs more than a second, which would
      // otherwise land inside the student's traced run and its time limit. (Allow-listed names.)
      pyodide.runPython(packages.map((p) => `import ${p}`).join('\n'));
    }
    const packagesMs = performance.now() - p0;
    scope.postMessage({ type: 'running', id, packagesMs });
    const r0 = performance.now();
    const result = session.run(request);
    scope.postMessage({ type: 'result', id, result, runMs: performance.now() - r0, packagesMs });
  } catch (error) {
    scope.postMessage({
      type: 'fatal',
      id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// Runs are serialized: the main thread sends one at a time, and Python is single-threaded anyway.
scope.onmessage = (event) => {
  void handle(event.data);
};
