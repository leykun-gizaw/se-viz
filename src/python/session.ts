/**
 * The recorder inside a loaded Pyodide — shared by the worker (browser) and the unit tests (Node),
 * so both exercise exactly the same Python. Pyodide is passed in; this module never loads it.
 *
 * @packageDocumentation
 */
import type { PyodideAPI } from 'pyodide';
import { resolveLimits, type RunRequest, type RunResult } from './protocol.ts';

export interface RecorderSession {
  /** Run one program synchronously and return its plain-JSON result. */
  run(request: RunRequest): RunResult;
}

/**
 * Load `recorder.py` into its own namespace (not the interpreter's `__main__`) and return a
 * session. Each run gets fresh student globals, so runs never see each other's names.
 *
 * @param pyodide - A loaded Pyodide.
 * @param recorderSource - The text of `recorder.py` (`?raw` in the worker, read from disk in Node).
 */
export function createRecorderSession(
  pyodide: PyodideAPI,
  recorderSource: string,
): RecorderSession {
  const namespace = pyodide.toPy({});
  pyodide.runPython(recorderSource, { globals: namespace, filename: 'se_viz_recorder.py' });
  const runJson = namespace.get('run_json') as (
    source: string,
    stdinJson: string,
    limitsJson: string,
  ) => string;
  return {
    run(request) {
      const text = runJson(
        request.source,
        JSON.stringify(request.stdin ?? []),
        JSON.stringify(resolveLimits(request.limits)),
      );
      return JSON.parse(text) as RunResult;
    },
  };
}
