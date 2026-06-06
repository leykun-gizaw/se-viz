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

// SE 200 — pointers, arrays & strings (Phase 3 content).
import { pointerBasicsTrace } from './se200/pointers-arrays-strings/pointerBasics.ts';
import { arrayIndexingTrace } from './se200/pointers-arrays-strings/arrayIndexing.ts';
import { stringsTrace } from './se200/pointers-arrays-strings/strings.ts';
import { swapTrace } from './se200/more-pointers-arrays-strings/swap.ts';
import { strlenTrace } from './se200/more-pointers-arrays-strings/strlen.ts';
import { pointerToPointerTrace } from './se200/even-more-pointers-arrays-strings/pointerToPointer.ts';
import { strcpyTrace } from './se200/even-more-pointers-arrays-strings/strcpy.ts';

// SE 200 — recursion (Phase 4 content). factorial was promoted here from the fixtures group.
import { factorialTrace } from './se200/recursion/factorial.ts';
import { sumToTrace } from './se200/recursion/sumTo.ts';
import { reverseStringTrace } from './se200/recursion/reverseString.ts';
import { fibonacciTrace } from './se200/recursion/fibonacci.ts';

// Phase 0–1 engine validation fixtures (kept available; factorial now lives under Recursion).
import { linkedListTrace, pointerArithTrace, mallocFreeTrace } from './fixtures/index.ts';

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
      {
        topic: 'Pointers, Arrays and Strings',
        modules: [
          {
            label: 'Pointer basics',
            summary: '&x, dereference, and writing through a pointer (pulses the target).',
            trace: pointerBasicsTrace,
          },
          {
            label: 'Array indexing',
            summary: 'arr[i] and *(arr + i) land on the same element and address.',
            trace: arrayIndexingTrace,
          },
          {
            label: 'Strings',
            summary: 'A char array with a visible \\0 terminator; printing stops there.',
            trace: stringsTrace,
          },
        ],
      },
      {
        topic: 'More Pointers, Arrays and Strings',
        modules: [
          {
            label: 'Pass-by-pointer (swap)',
            summary: "Pointers reach across frames into main; the swap pulses main's x and y.",
            trace: swapTrace,
          },
          {
            label: 'Walking a string (strlen)',
            summary: 'A pointer marches to the \\0, arrow gliding, counter pulsing.',
            trace: strlenTrace,
          },
        ],
      },
      {
        topic: 'Even More Pointers, Arrays and Strings',
        modules: [
          {
            label: 'Pointer to pointer',
            summary: 'Double indirection drawn as a two-hop chain pp → p → x.',
            trace: pointerToPointerTrace,
          },
          {
            label: 'strcpy (two pointers)',
            summary: 'src and dst march in lockstep; the \\0 is copied last.',
            trace: strcpyTrace,
          },
        ],
      },
      {
        topic: 'Recursion',
        modules: [
          {
            label: 'factorial(n)',
            summary: 'The canonical example: nested frames grow to the base case, then unwind.',
            trace: factorialTrace,
          },
          {
            label: 'sum_to(n)',
            summary: 'Accumulation: each frame adds its n to the value returned from below.',
            trace: sumToTrace,
          },
          {
            label: 'Reverse a string',
            summary: 'Recursion over data: putchar runs on the unwind, printing in reverse.',
            trace: reverseStringTrace,
          },
          {
            label: 'fibonacci(n)',
            summary: 'Tree recursion (two calls): depth-first order; fib(2) recomputed.',
            trace: fibonacciTrace,
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
