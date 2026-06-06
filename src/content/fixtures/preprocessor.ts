/**
 * Concept-view validation fixture — preprocessor before→after (PDF screen 08, `view: 'before-after'`).
 *
 * The left panel is the source with `#define` macros; the right panel is the translation unit after
 * `cpp` runs. Each step highlights (in the value-changed green) the macro use that was textually
 * substituted, so the object-like (`MAX`) and function-like (`SQ`) expansions read clearly. Engine
 * fixture proving the `before-after` renderer; the curriculum module (SE 200 · Preprocessor) is
 * Phase 13.
 */
import type { ContentModule } from '../module.ts';
import type { BeforeAfterStep, Step, Trace } from '../../engine/trace/types.ts';

const BEFORE = `#define MAX 100
#define SQ(x) ((x) * (x))

int cap = MAX;
int a = SQ(3 + 1);`;

const AFTER = `int cap = 100;
int a = ((3 + 1) * (3 + 1));`;

/** Every step shows the same two panels (snapshot model); only the highlighted lines change. */
function ba(beforeHighlights: number[], afterHighlights: number[]): BeforeAfterStep {
  return { before: BEFORE, after: AFTER, beforeHighlights, afterHighlights, processLabel: 'cpp' };
}

const steps: Step[] = [
  {
    id: 'source',
    index: 0,
    narration:
      'Before preprocessing: two #define macros at the top, then two lines that use them. cpp works on text, before the compiler sees anything.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([1, 2], []),
  },
  {
    id: 'expand-max',
    index: 1,
    narration:
      '#define MAX 100 is an object-like macro: cpp replaces every MAX token with 100. So cap = MAX becomes cap = 100.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([1, 4], [1]),
  },
  {
    id: 'expand-sq',
    index: 2,
    narration:
      'SQ(x) is a function-like macro. SQ(3 + 1) expands to ((3 + 1) * (3 + 1)) — the parentheses in the macro keep the addition from binding wrong.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([2, 5], [2]),
  },
  {
    id: 'translation-unit',
    index: 3,
    narration:
      'After cpp the #define lines are gone; the translation unit the compiler actually compiles is pure substituted C.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([], [1, 2]),
  },
];

export const preprocessorTrace: Trace = {
  id: 'fixture-preprocessor',
  title: 'Preprocessor — macro expansion (before → after)',
  course: 'SE 200',
  topic: 'Preprocessor',
  file: 'macros.c',
  view: 'before-after',
  language: 'c',
  source: '',
  steps,
};

const contentModule: ContentModule = {
  trace: preprocessorTrace,
  label: 'Preprocessor expansion',
  summary: 'Concept view: #define before → substituted translation unit after (cpp).',
  order: 41,
  course: 'Engine fixtures',
  topic: 'Concept views',
};
export default contentModule;
