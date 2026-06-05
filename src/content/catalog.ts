/**
 * The content catalog — the single source of truth for every visualization module, grouped by
 * course → topic. The workbench lists modules from here; a future navigation shell (a later phase)
 * will consume the same structure. Every later content phase appends to this catalog.
 *
 * @packageDocumentation
 */

import type { Trace } from '../engine/trace/types.ts';

// SE 200 — C fundamentals (Phase 2 content).
import { helloWorldTrace } from './se200/hello-world/helloWorld.ts';
import { controlFlowTrace } from './se200/variables-control-flow/controlFlow.ts';
import { functionsTrace } from './se200/functions-nested-loops/functions.ts';
import { nestedLoopsTrace } from './se200/functions-nested-loops/nestedLoops.ts';
import { areaTableTrace } from './se200/more-functions-loops/areaTable.ts';

// Phase 0–1 engine validation fixtures (kept available).
import {
  factorialTrace,
  linkedListTrace,
  pointerArithTrace,
  mallocFreeTrace,
} from './fixtures/index.ts';

/** One module: its trace plus display metadata for the switcher. */
export interface CatalogModule {
  /** Short label shown in the module list (the trace also carries a fuller `title`). */
  label: string;
  /** One-line description of what the module teaches. */
  summary: string;
  /** The trace the engine plays. */
  trace: Trace;
}

/** A topic groups modules within a course (mirrors the `Topic`/week in docs/CURRICULUM.md). */
export interface CatalogTopic {
  topic: string;
  modules: CatalogModule[];
}

/** A course groups topics. */
export interface CatalogCourse {
  /** Course code, e.g. `"SE 200"`. */
  course: string;
  /** Human course title. */
  courseTitle: string;
  topics: CatalogTopic[];
}

export const CATALOG: readonly CatalogCourse[] = [
  {
    course: 'SE 200',
    courseTitle: 'C Programming I',
    topics: [
      {
        topic: 'Hello, World',
        modules: [
          {
            label: 'Hello, World',
            summary: 'A single main frame and the console — the simplest program.',
            trace: helloWorldTrace,
          },
        ],
      },
      {
        topic: 'Variables, if / else, while',
        modules: [
          {
            label: 'Variables & control flow',
            summary: 'Scalars, an if/else branch, and a while loop that visibly iterates.',
            trace: controlFlowTrace,
          },
        ],
      },
      {
        topic: 'Functions and Nested Loops',
        modules: [
          {
            label: 'Functions: call & return',
            summary: 'Calling a function: argument copy, return value assigned back.',
            trace: functionsTrace,
          },
          {
            label: 'Nested loops',
            summary: 'Distinct outer/inner counters print a multiplication grid.',
            trace: nestedLoopsTrace,
          },
        ],
      },
      {
        topic: 'More Functions, More Nested Loops',
        modules: [
          {
            label: 'Function inside nested loops',
            summary: 'A helper called for every (row, col) of a nested loop.',
            trace: areaTableTrace,
          },
        ],
      },
    ],
  },
  {
    course: 'Engine fixtures',
    courseTitle: 'Phase 0–1 validation traces',
    topics: [
      {
        topic: 'Renderer primitives',
        modules: [
          {
            label: 'Recursion (factorial)',
            summary: 'Nested call stack growing and unwinding.',
            trace: factorialTrace,
          },
          {
            label: 'Linked-list traversal',
            summary: 'Heap nodes, next arrows, current retarget, NULL sink.',
            trace: linkedListTrace,
          },
          {
            label: 'Pointer arithmetic',
            summary: 'Contiguous array, *(p + 2) with byte-offset math.',
            trace: pointerArithTrace,
          },
          {
            label: 'malloc / free',
            summary: 'The four heap allocation states and the console heap-watch.',
            trace: mallocFreeTrace,
          },
        ],
      },
    ],
  },
];

/** Every trace in the catalog, flattened — used by the validation test and the workbench index. */
export function allCatalogTraces(): Trace[] {
  return CATALOG.flatMap((c) => c.topics.flatMap((t) => t.modules.map((m) => m.trace)));
}

/** Every module in the catalog, flattened in display order (for a flat selection index). */
export function allCatalogModules(): CatalogModule[] {
  return CATALOG.flatMap((c) => c.topics.flatMap((t) => t.modules));
}
