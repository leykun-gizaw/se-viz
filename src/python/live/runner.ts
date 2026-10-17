/**
 * The one Python runner the live editor uses (Phase 31). Module-level, so leaving the mode and
 * coming back keeps the loaded Pyodide (and any loaded packages) instead of booting a new worker.
 * Created on first use, from the lazily loaded live view only.
 *
 * @packageDocumentation
 */
import { PythonRunner } from '../client.ts';

let runner: PythonRunner | null = null;

export function liveRunner(): PythonRunner {
  runner ??= new PythonRunner();
  return runner;
}
