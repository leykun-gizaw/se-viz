/**
 * The recorder inside a loaded Pyodide — shared by the worker (browser) and the unit tests (Node),
 * so both exercise exactly the same Python. Pyodide is passed in; this module never loads it.
 *
 * @packageDocumentation
 */
import type { PyodideAPI } from 'pyodide';
import {
  resolveLimits,
  type RecorderStop,
  type RunRequest,
  type RunResult,
} from './protocol.ts';

/**
 * Receives snapshots as they are recorded: a JSON array of new snapshots, the count so far, and the
 * recorder's stop reason on the chunk sent when it stops the program.
 */
export type ChunkListener = (chunk: string, total: number, stop: RecorderStop | undefined) => void;

export interface RecorderSession {
  /** Run one program synchronously and return its plain-JSON result. */
  run(request: RunRequest, onChunk?: ChunkListener): RunResult;
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
    onChunk?: (chunk: string, total: number, stop: RecorderStop | null | undefined) => void,
  ) => string;
  return {
    run(request, onChunk) {
      const args = [
        request.source,
        JSON.stringify(request.stdin ?? []),
        JSON.stringify(resolveLimits(request.limits)),
      ] as const;
      // Python's None arrives as undefined (or null); normalize it for the listener.
      const text = onChunk
        ? runJson(...args, (chunk, total, stop) => onChunk(chunk, total, stop ?? undefined))
        : runJson(...args);
      return JSON.parse(text) as RunResult;
    },
  };
}
