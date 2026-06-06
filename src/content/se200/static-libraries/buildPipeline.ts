/**
 * SE 200 · Static Libraries — the static-library build pipeline (`view: 'pipeline'`, PDF screen 07).
 *
 * A multi-source build rendered left→right, showing *separate compilation* and *linking*:
 *
 *   main.c  ┐                       ┌→ main.o ───────────────┐
 *   circle.c├→ cc -c (compile) ─────┼→ circle.o ─┐           ├→ ld (link) → app
 *   square.c┘                       └→ square.o ─┴→ ar rcs → libshapes.a ─┘
 *
 * Each `.c` is compiled independently into a `.o`; `ar rcs` bundles the *library* objects
 * (circle.o + square.o) into the archive `libshapes.a`; `ld` resolves `main.o`'s unresolved
 * symbols against that archive, copying the needed code into one self-contained executable `app`
 * (the only artifact carrying the accent). Dashed boxes (`cc`/`ar`/`ld`) are processes; solid cards
 * (`.c`/`.o`/`.a`/binary) are files on disk. Steps advance one *stage* at a time (idle → active →
 * done). Data only — authored against the Phase 11 `pipeline` view; no engine/renderer edits.
 */
import type { ContentModule } from '../../module.ts';
import type { PipelineEdge, PipelineNode, Step, Trace } from '../../../engine/trace/types.ts';

interface NodeSpec {
  id: string;
  kind: PipelineNode['kind'];
  label: string;
  sublabel: string;
  /** Pipeline stage this node belongs to; drives the per-step idle → active → done reveal. */
  stage: number;
  accent?: boolean;
}

/**
 * Every node, declared left→right in pipeline order (the renderer draws connectors between adjacent
 * declared nodes joined by an edge, so column order matters). Sources share a stage, as do the
 * three objects — `stage` (not array index) drives the reveal so fan-in/fan-out stays correct.
 */
const NODE_SPECS: NodeSpec[] = [
  // Stage 0 — the three independent sources.
  { id: 'main.c', kind: 'artifact', label: 'main.c', sublabel: 'source', stage: 0 },
  { id: 'circle.c', kind: 'artifact', label: 'circle.c', sublabel: 'library source', stage: 0 },
  { id: 'square.c', kind: 'artifact', label: 'square.c', sublabel: 'library source', stage: 0 },
  // Stage 1 — compile each source on its own.
  { id: 'cc', kind: 'process', label: 'cc -c', sublabel: 'compile', stage: 1 },
  // Stage 2 — one object file per source.
  { id: 'main.o', kind: 'artifact', label: 'main.o', sublabel: 'object', stage: 2 },
  { id: 'circle.o', kind: 'artifact', label: 'circle.o', sublabel: 'object', stage: 2 },
  { id: 'square.o', kind: 'artifact', label: 'square.o', sublabel: 'object', stage: 2 },
  // Stage 3 — archive the library objects.
  { id: 'ar', kind: 'process', label: 'ar rcs', sublabel: 'archive', stage: 3 },
  // Stage 4 — the static library.
  { id: 'libshapes.a', kind: 'artifact', label: 'libshapes.a', sublabel: 'static library', stage: 4 },
  // Stage 5 — link main.o against the archive.
  { id: 'ld', kind: 'process', label: 'ld', sublabel: 'link', stage: 5 },
  // Stage 6 — the final, self-contained executable (accent).
  { id: 'app', kind: 'artifact', label: 'app', sublabel: 'executable', stage: 6, accent: true },
];

/** Directed left→right edges; every endpoint is a node id declared above. */
const EDGES: PipelineEdge[] = [
  // sources → compiler
  { from: 'main.c', to: 'cc' },
  { from: 'circle.c', to: 'cc' },
  { from: 'square.c', to: 'cc' },
  // compiler → objects (one per source)
  { from: 'cc', to: 'main.o' },
  { from: 'cc', to: 'circle.o' },
  { from: 'cc', to: 'square.o' },
  // library objects → archiver → static library
  { from: 'circle.o', to: 'ar' },
  { from: 'square.o', to: 'ar' },
  { from: 'ar', to: 'libshapes.a' },
  // main.o + the archive → linker → executable
  { from: 'main.o', to: 'ld' },
  { from: 'libshapes.a', to: 'ld' },
  { from: 'ld', to: 'app' },
];

/** Build one step's node list: stages before `stage` are done, the current stage is active, rest idle. */
function nodesAt(stage: number): PipelineNode[] {
  return NODE_SPECS.map(({ stage: nodeStage, ...node }) => ({
    ...node,
    state: nodeStage < stage ? 'done' : nodeStage === stage ? 'active' : 'idle',
  }));
}

/** Per-stage narration and the single focal node to highlight that step. */
const STAGES: { narration: string; activeId: string }[] = [
  {
    narration:
      'Three independent source files: main.c calls shape functions that circle.c and square.c define. Nothing is compiled yet.',
    activeId: 'main.c',
  },
  {
    narration:
      'cc -c compiles each .c file on its own — separate compilation. A source needs only the others’ declarations, never their code.',
    activeId: 'cc',
  },
  {
    narration:
      'Each source becomes an object file: main.o, circle.o, square.o — machine code, but with cross-file references still unresolved.',
    activeId: 'main.o',
  },
  {
    narration:
      'ar rcs bundles the library objects into an archive: r inserts the members, c creates it, s writes the symbol index linkers read.',
    activeId: 'ar',
  },
  {
    narration:
      'libshapes.a is the static library — just an archive of circle.o and square.o plus an index of the symbols they define.',
    activeId: 'libshapes.a',
  },
  {
    narration:
      'At link time ld resolves main.o’s unresolved symbols, pulling the matching objects out of libshapes.a and copying their code in.',
    activeId: 'ld',
  },
  {
    narration:
      'app is one self-contained executable — the library code is baked in at link time, so it runs without needing libshapes.a.',
    activeId: 'app',
  },
];

const steps: Step[] = STAGES.map(({ narration, activeId }, stage) => ({
  id: `stage-${stage}`,
  index: stage,
  narration,
  highlightedLines: [],
  stack: [],
  heap: [],
  activeId,
  pipeline: { nodes: nodesAt(stage), edges: EDGES },
}));

export const staticLibrariesPipelineTrace: Trace = {
  id: 'se200-static-libraries-pipeline',
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
  trace: staticLibrariesPipelineTrace,
  label: 'Build pipeline',
  summary: 'Concept view: separate compilation and linking — .c → .o → .a → executable (cc / ar / ld).',
  order: 60,
};
export default contentModule;
