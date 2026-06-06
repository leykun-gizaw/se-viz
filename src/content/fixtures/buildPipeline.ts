/**
 * Concept-view validation fixture — build pipeline (PDF screen 07, `view: 'pipeline'`).
 *
 * A minimal, correct static-library pipeline rendered left→right: the source `util.c` is compiled by
 * `cc` into the object `util.o`, archived by `ar` into the static library `libutil.a`, and linked by
 * `ld` into the final executable `./app`. Each step advances one stage (idle → active → done); only
 * the final artifact carries the accent. This is an engine fixture proving the `pipeline` renderer
 * and `validateTrace` end-to-end — the curriculum module (SE 200 · Static Libraries) is Phase 12.
 */
import type { ContentModule } from '../module.ts';
import type { PipelineEdge, PipelineNode, Step, Trace } from '../../engine/trace/types.ts';

interface NodeSpec {
  id: string;
  kind: PipelineNode['kind'];
  label: string;
  sublabel: string;
  accent?: boolean;
}

/** The linear pipeline, in left→right order. */
const NODE_SPECS: NodeSpec[] = [
  { id: 'util.c', kind: 'artifact', label: 'util.c', sublabel: 'source' },
  { id: 'cc', kind: 'process', label: 'cc -c', sublabel: 'compile' },
  { id: 'util.o', kind: 'artifact', label: 'util.o', sublabel: 'object' },
  { id: 'ar', kind: 'process', label: 'ar rcs', sublabel: 'archive' },
  { id: 'libutil.a', kind: 'artifact', label: 'libutil.a', sublabel: 'static library' },
  { id: 'ld', kind: 'process', label: 'ld', sublabel: 'link' },
  { id: 'app', kind: 'artifact', label: './app', sublabel: 'executable', accent: true },
];

const EDGES: PipelineEdge[] = NODE_SPECS.slice(1).map((n, i) => ({ from: NODE_SPECS[i].id, to: n.id }));

/** Build a step's node list: everything before `active` is done, `active` is active, the rest idle. */
function nodesAt(active: number): PipelineNode[] {
  return NODE_SPECS.map((spec, i) => ({
    ...spec,
    state: i < active ? 'done' : i === active ? 'active' : 'idle',
  }));
}

const NARRATION = [
  'We start with one source file, util.c — plain C the compiler has not touched yet.',
  'cc -c compiles the source: it turns C into machine-code instructions but does not link.',
  'The result is util.o, an object file — compiled code, not yet a runnable program.',
  'ar bundles object files into an archive. This is how a static library is made.',
  'libutil.a is the static library: an archive of .o files other programs can link against.',
  'At link time ld copies the needed code out of the archive into the program being built.',
  './app is the final executable — the library code is baked in, so it runs on its own.',
];

const steps: Step[] = NARRATION.map((narration, i) => ({
  id: `stage-${i}`,
  index: i,
  narration,
  highlightedLines: [],
  stack: [],
  heap: [],
  activeId: NODE_SPECS[i].id,
  pipeline: { nodes: nodesAt(i), edges: EDGES },
}));

export const buildPipelineTrace: Trace = {
  id: 'fixture-build-pipeline',
  title: 'Static-library build pipeline',
  course: 'SE 200',
  topic: 'Static Libraries',
  file: 'Makefile',
  view: 'pipeline',
  language: 'c',
  source: '',
  steps,
};

const contentModule: ContentModule = {
  trace: buildPipelineTrace,
  label: 'Build pipeline',
  summary: 'Concept view: .c → .o → .a → linked binary (cc / ar / ld).',
  order: 40,
  course: 'Engine fixtures',
  topic: 'Concept views',
};
export default contentModule;
