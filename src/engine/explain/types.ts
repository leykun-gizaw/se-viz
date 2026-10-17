/**
 * Shared shapes of the step explanation (Phase 28 rows, Phase 32 derived sections).
 *
 * @packageDocumentation
 */
import type { StepCondition } from '../trace/types.ts';

/** The kinds of row in "What changed". */
export type ChangeKind =
  | 'value' // a scalar's value changed
  | 'pointer' // a pointer (Python: a name or slot) now targets something else
  | 'call' // a frame was pushed
  | 'return' // a frame was popped
  | 'alloc' // a heap block appeared (Python: an object was created)
  | 'free' // a heap block was freed / released (Python: no longer reachable)
  | 'leak' // a heap block became unreachable
  | 'declare' // a new variable appeared in a frame that already existed
  | 'output' // the program printed something
  | 'add' // Python (Phase 32): an item, key or attribute was added inside an object
  | 'remove' // Python (Phase 32): an item, key, attribute or name was removed
  | 'figure'; // Python (Phase 36): the step produced a matplotlib figure

/** One "What changed" row. `from`/`to` are present for value-like changes. */
export interface ChangeRow {
  kind: ChangeKind;
  /** What changed, e.g. `n in factorial(3)`, `factorial(2)`, `node 0x8e0`. */
  subject: string;
  from?: string;
  to?: string;
  /** The subject is inline Markdown (`code` spans), as derived Python rows are (Phase 32). */
  markdown?: true;
}

/**
 * Everything {@link import('./derive.ts').deriveExplanation} derives for one beat. Every string is
 * one short sentence of inline Markdown; an empty list means "nothing to say" (the section is
 * hidden), never a guess.
 */
export interface DerivedExplanation {
  /**
   * "What this step did": on `apply`, an ordered breakdown of what the line did; on `arrive`, what
   * is about to run (never its effects). Empty when it can't be derived (C traces: the narration).
   */
  did: string[];
  /** "What changed" rows, or `null` when the generic diff should be used (or nothing yet). */
  changes: ChangeRow[] | null;
  /** "Branch taken": the condition's result and which lines run or are skipped. */
  branch: string[];
  /** "Loop iteration": which pass of the loop this is, and the loop variable's new value. */
  loop: string[];
  /** "Calls and returns". */
  calls: string[];
  /** "Exceptions": type, message, line, and which `except` (if any) caught it. */
  exceptions: string[];
  /** "Concept": a glossary entry for this kind of step, or `null`. */
  concept: string | null;
  /** The branch or loop test's result, when derived (Python): what the narration chip shows. */
  condition?: StepCondition;
}

/** A derived explanation with nothing in it. */
export function emptyDerived(): DerivedExplanation {
  return {
    did: [],
    changes: null,
    branch: [],
    loop: [],
    calls: [],
    exceptions: [],
    concept: null,
  };
}
