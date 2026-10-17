/**
 * Recorded Python traces for the derived-explanation tests (Phase 32): the Phase 29 samples (as
 * committed) and the Phase 32 extra programs (recorded by `recorder.test.ts`, mapped here exactly
 * as a live run is). Test-only: nothing in the app imports this file.
 *
 * @packageDocumentation
 */
import type { RunResult } from '../../python/protocol.ts';
import { EXTRA_PROGRAMS } from '../../python/testPrograms.ts';
import { recordingToTrace } from '../../python/toTrace.ts';
import type { Trace } from '../trace/types.ts';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/**/*.json', {
  eager: true,
  import: 'default',
});
const RECORDINGS = import.meta.glob<string>('../../python/fixtures/extra-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** A Phase 29 sample, as committed in `src/content/fixtures/python/`. */
export function sampleTrace(name: string): Trace {
  const t = TRACES[`../../content/fixtures/python/${name}.json`];
  if (!t) throw new Error(`missing trace ${name}`);
  return t;
}

/** A recorded extra program (`src/python/fixtures/extra-*.json`), mapped like a live run. */
export function extraTrace(name: string): Trace {
  const text = RECORDINGS[`../../python/fixtures/${name}.json`];
  const program = EXTRA_PROGRAMS.find((p) => p.name === name);
  if (text === undefined || !program) throw new Error(`missing recording ${name}`);
  return recordingToTrace(JSON.parse(text) as RunResult, program.request.source, {
    id: name,
    title: name,
    file: `${name}.py`,
  });
}

/** The index of the `n`-th step (1-based) that highlights `line`. */
export function stepAt(trace: Trace, line: number, n = 1): number {
  let seen = 0;
  const i = trace.steps.findIndex((s) => s.highlightedLines[0] === line && ++seen === n);
  if (i < 0) throw new Error(`no step ${n} on line ${line} in ${trace.id}`);
  return i;
}
