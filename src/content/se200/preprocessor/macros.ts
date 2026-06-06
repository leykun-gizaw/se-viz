/**
 * SE 200 · Preprocessor (week 7) — concept view, `view: 'before-after'` (PDF screen 08).
 *
 * The left panel is the source as written (directives + macro uses); the right panel is the
 * translation unit the compiler actually sees, after `cpp` has run. Each step highlights — in the
 * value-changed green — the span that was textually substituted that step, so the three classic
 * forms read clearly:
 *   - `#include "bounds.h"`  → the header's text is pasted inline,
 *   - object-like `#define MAX 100` → every `MAX` token becomes `100`,
 *   - function-like `#define SQ(x) ((x) * (x))` → the argument is pasted verbatim, twice.
 *
 * The teaching thread: the preprocessor runs BEFORE the compiler and is pure text substitution —
 * find-and-replace and paste, never evaluation. Authored against the Phase 11 `before-after`
 * contract (data only; no engine/renderer/format edits). Copy-from exemplar:
 * `src/content/fixtures/preprocessor.ts`.
 */
import type { ContentModule } from '../../module.ts';
import type { BeforeAfterStep, Step, Trace } from '../../../engine/trace/types.ts';

// Source as written. Line numbers (1-based) referenced by beforeHighlights:
//   1  #include "bounds.h"
//   2  #define MAX 100
//   3  #define SQ(x) ((x) * (x))
//   4  (blank)
//   5  int  cap  = MAX;
//   6  int  area = SQ(3 + 1);
const BEFORE = `#include "bounds.h"
#define MAX 100
#define SQ(x) ((x) * (x))

int  cap  = MAX;
int  area = SQ(3 + 1);`;

// Translation unit after cpp. The #include is replaced by the header's text; the #define lines are
// gone; each macro use is replaced by its substituted text. Line numbers referenced by
// afterHighlights:
//   1  /* bounds.h */
//   2  extern int clamp(int v);
//   3  typedef struct Range { int lo; int hi; } Range;
//   4  (blank)
//   5  int  cap  = 100;
//   6  int  area = ((3 + 1) * (3 + 1));
const AFTER = `/* bounds.h */
extern int clamp(int v);
typedef struct Range { int lo; int hi; } Range;

int  cap  = 100;
int  area = ((3 + 1) * (3 + 1));`;

/** Snapshot model: every step shows the same two panels; only the highlighted spans change. */
function ba(beforeHighlights: number[], afterHighlights: number[]): BeforeAfterStep {
  return { before: BEFORE, after: AFTER, beforeHighlights, afterHighlights, processLabel: 'cpp' };
}

const steps: Step[] = [
  {
    id: 'source',
    index: 0,
    narration:
      'As written: one #include and two #define directives at the top, then two lines that use them. The preprocessor (cpp) runs first, before the compiler sees any code, and it works on raw text.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([1, 2, 3], []),
  },
  {
    id: 'include',
    index: 1,
    narration:
      '#include "bounds.h" is not a function call — cpp literally pastes the header’s text in place of the directive. The three lines of bounds.h now sit at the top of the translation unit.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([1], [1, 2, 3]),
  },
  {
    id: 'expand-max',
    index: 2,
    narration:
      '#define MAX 100 is an object-like macro: a plain find-and-replace. cpp swaps every MAX token for the text 100, so `int cap = MAX;` becomes `int cap = 100;`. No types, no evaluation — just text.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([2, 5], [5]),
  },
  {
    id: 'expand-sq',
    index: 3,
    narration:
      'SQ(x) is a function-like macro. SQ(3 + 1) does NOT compute 16 — cpp pastes the argument text "3 + 1" wherever x appears, twice: ((3 + 1) * (3 + 1)). It is textual substitution, not a call.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([3, 6], [6]),
  },
  {
    id: 'pitfall',
    index: 4,
    narration:
      'Why the parentheses matter: a careless `#define SQ(x) x * x` would expand SQ(3 + 1) to 3 + 1 * 3 + 1 = 7, because the pasted text is glued in raw and `*` binds tighter than `+`. Wrapping every parameter — ((x) * (x)) — is what keeps the math correct.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([3], [6]),
  },
  {
    id: 'translation-unit',
    index: 5,
    narration:
      'After cpp finishes, the #include and #define lines are gone. What the compiler actually compiles is this pure, fully substituted C — the translation unit. Everything cpp did was text in, text out.',
    highlightedLines: [],
    stack: [],
    heap: [],
    beforeAfter: ba([], [1, 2, 3, 5, 6]),
  },
];

export const preprocessorMacrosTrace: Trace = {
  id: 'se200-preprocessor-macros',
  title: 'Preprocessor: #include and macro expansion',
  course: 'SE 200',
  topic: 'Preprocessor',
  file: 'macros.c',
  view: 'before-after',
  language: 'c',
  source: '',
  steps,
};

const contentModule: ContentModule = {
  trace: preprocessorMacrosTrace,
  label: 'Macro expansion',
  summary:
    'Concept view: cpp runs before the compiler — #include pastes a header, and #define macros are pure textual substitution (SQ(3 + 1) is copied, not evaluated).',
  order: 105,
};
export default contentModule;
