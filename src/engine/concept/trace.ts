/**
 * Shared pieces of the Phase 37 concept-view generators: building a step whose explanation is
 * written from the generator's own state, and wrapping steps into a trace.
 *
 * @packageDocumentation
 */
import type { ContentModule } from '../../content/module.ts';
import type { Step, Trace, TraceView } from '../trace/types.ts';

/** Plain text of an inline-Markdown sentence (the narration card shows plain text). */
export const plain = (md: string): string => md.replace(/`/g, '');

/** What a generated step says about itself. */
export interface StepText {
  /** "What this step did", one sentence per entry (inline Markdown). Also the narration. */
  did: string[];
  /** "What changed", one sentence per entry. Omit on the first step. */
  changed?: string[] | undefined;
  /** The idea the step illustrates. */
  concept?: string | undefined;
}

/** A concept-view step: no code, no memory, the payload, and the authored explanation. */
export function conceptStep(index: number, text: StepText, payload: Partial<Step>): Step {
  const explain: NonNullable<Step['explain']> = { did: text.did };
  if (text.changed && text.changed.length > 0) explain.changed = text.changed;
  if (text.concept) explain.concept = text.concept;
  return {
    id: `s${index}`,
    index,
    narration: text.did.map(plain).join(' '),
    highlightedLines: [],
    stack: [],
    heap: [],
    ...payload,
    explain,
  };
}

/** How a generated trace presents: breadcrumb, view and its place in the sidebar. */
export interface ConceptMeta {
  id: string;
  title: string;
  /** Breadcrumb topic; the sidebar groups the module under "<topic> views" in Engine fixtures. */
  topic: string;
  view: TraceView;
  summary: string;
  order: number;
  /** Sidebar label (defaults to the title). */
  label?: string;
}

/**
 * A content module for a generated concept-view trace (DS 210, no source code). It sits in the
 * engine-fixtures bucket until the DS 210 content phase places it in the course.
 */
export function conceptModule(meta: ConceptMeta, steps: Step[]): ContentModule & { trace: Trace } {
  const { id, title, topic, view, summary, order, label } = meta;
  return {
    trace: { id, title, course: 'DS 210', topic, language: 'python', view, source: '', steps },
    summary,
    order,
    course: 'Engine fixtures',
    topic: `${topic} views`,
    ...(label ? { label } : {}),
  };
}

/** `indices 2–5`, or `index 2` for a single one. */
export const span = (from: number, to: number): string =>
  from === to ? `index ${from}` : `indices ${from}–${to}`;

/** A list of numbers as Python writes it, in a code span: `` `[3, 1, 2]` ``. */
export const list = (values: readonly (number | string)[]): string => `\`[${values.join(', ')}]\``;
