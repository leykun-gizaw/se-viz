/**
 * A recorded Python run as an SE-Viz {@link Trace} (Phase 30). This is candidate A of the Phase 29
 * spike made real (`docs/PYTHON_TRACE_FORMAT.md`): names are cells, every object is a heap block
 * tagged with `objectKind`, and the trace says `language: 'python'`.
 *
 * Used to write the committed traces in `src/content/fixtures/python/` (see `toTrace.test.ts`), and
 * by Phase 31's live Python coding on each worker result.
 *
 * @packageDocumentation
 */
import type { Trace } from '../engine/trace/types.ts';
import { mapA } from './mappings/candidates.ts';
import type { RunResult } from './protocol.ts';

/** What a trace carries besides its steps. */
export interface PythonTraceMeta {
  id: string;
  title: string;
  /** The file name shown above the code, e.g. `harvest.py`. */
  file?: string;
}

/** Map a run onto a `language: 'python'` trace. A run with no steps (a syntax error) has none. */
export function recordingToTrace(result: RunResult, source: string, meta: PythonTraceMeta): Trace {
  const { steps } = mapA(result, source, meta.id);
  return {
    id: meta.id,
    title: meta.title,
    ...(meta.file ? { file: meta.file } : {}),
    language: 'python',
    source,
    steps,
  };
}
