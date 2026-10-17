/**
 * The Python worker (Phase 29 spike; preload, package status and streaming from Phase 31): a module
 * Web Worker that loads Pyodide **once** (on a `load` message or its first run) and records each
 * requested program with `recorder.py`.
 *
 * Pyodide's JS loader is bundled from the pinned npm package; its runtime assets (wasm, stdlib,
 * wheels) come from jsDelivr at the same exact version ({@link PYODIDE_INDEX_URL}). Nothing here is
 * reachable from the main chunk: the main thread only ever references this file through
 * `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` in `client.ts`.
 *
 * The wall-clock limit is enforced from the main thread (it terminates this worker), because a
 * synchronous Python loop here can't be interrupted without cross-origin isolation. While the
 * program runs, the recorder streams its snapshots out (`steps` messages), so a killed run keeps
 * them.
 */
import { loadPyodide, type PyodideAPI } from 'pyodide';
import recorderSource from './recorder.py?raw';
import {
  ALLOWED_PACKAGES,
  type AllowedPackage,
  type WorkerMessage,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol.ts';
import { createRecorderSession, type RecorderSession } from './session.ts';
import { PYODIDE_INDEX_URL } from './version.ts';

interface WorkerScope {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
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
const isAllowed = (name: string): name is AllowedPackage => allowed.has(name);

/** Allow-listed packages already loaded and imported in this worker. */
const imported = new Set<AllowedPackage>();

/**
 * The allow-listed packages a program needs: the ones the request names, plus the top-level
 * imports Pyodide's own `find_imports` (what `loadPackagesFromImports` uses) finds in the source.
 * Only allow-listed names are ever loaded, so nothing but the pinned CDN's wheels is fetched.
 */
function wantedPackages(pyodide: PyodideAPI, request: WorkerRequest['request']): AllowedPackage[] {
  const wanted = new Set<AllowedPackage>((request.packages ?? []).filter(isAllowed));
  try {
    const findImports = pyodide.pyimport('pyodide.code').find_imports as (code: string) => {
      toJs(): string[];
      destroy(): void;
    };
    const found = findImports(request.source);
    for (const name of found.toJs()) if (isAllowed(name)) wanted.add(name);
    found.destroy();
  } catch {
    /* unparsable source: the recorder reports the syntax error */
  }
  return ALLOWED_PACKAGES.filter((p) => wanted.has(p));
}

async function handle(message: WorkerRequest): Promise<void> {
  const { id, request } = message;
  try {
    const { pyodide, session } = await boot();
    const missing = wantedPackages(pyodide, request).filter((p) => !imported.has(p));
    const p0 = performance.now();
    if (missing.length > 0) {
      scope.postMessage({ type: 'packages', id, packages: missing });
      await pyodide.loadPackage(missing, { messageCallback: () => {} });
      // Import them once here, untraced: importing pandas costs more than a second, which would
      // otherwise land inside the student's traced run and its time limit. (Allow-listed names.)
      // matplotlib gets the non-interactive Agg backend: a worker has no display.
      pyodide.runPython(
        [
          ...(missing.includes('matplotlib')
            ? ['import os', "os.environ['MPLBACKEND'] = 'Agg'"]
            : []),
          ...missing.map((p) => `import ${p}`),
        ].join('\n'),
      );
      for (const p of missing) imported.add(p);
    }
    const packagesMs = performance.now() - p0;
    scope.postMessage({ type: 'running', id, packagesMs, loaded: [...imported] });
    const r0 = performance.now();
    const result = session.run(request, (chunk, total, stop) =>
      scope.postMessage({ type: 'steps', id, chunk, total, ...(stop ? { stop } : {}) }),
    );
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
  const message = event.data;
  if (message.type === 'load') {
    boot().catch((error: unknown) =>
      scope.postMessage({
        type: 'fatal',
        id: null,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return;
  }
  void handle(message);
};
