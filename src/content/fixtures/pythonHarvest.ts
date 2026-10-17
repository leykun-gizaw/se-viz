/**
 * The DS 200 harvest loop (Phase 30) — the one visible Python module. Its trace is the Phase 29
 * recording of `src/python/samples/harvest.py`, mapped to a `language: 'python'` trace and
 * committed as data in `python/harvest.json` (written by `src/python/toTrace.test.ts`). Nothing
 * here runs Python: a recorded trace is plain JSON.
 *
 * It sits in the engine-fixtures bucket, beside the C renderer primitives, until the DS 200
 * content of Phase 33 arrives.
 */
import type { Trace } from '../../engine/trace/types.ts';
import type { ContentModule } from '../module.ts';

// A glob (not a JSON import) keeps the trace typed as `Trace` without `resolveJsonModule`.
const DATA = import.meta.glob<Trace>('./python/harvest.json', { eager: true, import: 'default' });

export const pythonHarvestTrace: Trace = {
  ...DATA['./python/harvest.json'],
  title: 'Counting a harvest with a dict',
  course: 'DS 200',
  topic: 'Dictionaries',
  file: 'harvest.py',
};

const contentModule: ContentModule = {
  trace: pythonHarvestTrace,
  label: 'Python: counting a harvest',
  summary: 'A for loop counts crops into a dict: keys appear, and one value changes in place.',
  order: 30,
  course: 'Engine fixtures',
  topic: 'Python renderer',
};
export default contentModule;
