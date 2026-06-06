/**
 * The content-module contract — the ONE rule a content file must follow to be auto-discovered by
 * the catalog. After the Phase 05 catalog refactor, dropping a file under
 * `src/content/<course>/<topic>/<module>.ts` that **default-exports** a {@link ContentModule}
 * registers it in the sidebar with **no edit to any shared file** (`catalog.ts`, `App.tsx`, tests).
 *
 * This is the contract the whole parallel content wave depends on — keep it small and stable.
 *
 * @packageDocumentation
 */
import type { Trace } from '../engine/trace/types.ts';

/**
 * A single content module: the {@link Trace} the engine plays, plus how it presents in the sidebar.
 *
 * Author one per file and **`export default`** it. Grouping (`course` → `topic`) is read from the
 * trace's own `course`/`topic` breadcrumb metadata; the optional overrides below exist only for the
 * legacy engine-fixtures bucket and should be left unset by curriculum content.
 */
export interface ContentModule {
  /** The trace the engine plays. Its `course`/`topic` drive sidebar grouping. */
  trace: Trace;
  /** One-line description of what the module teaches (shown as the sidebar tooltip). Required. */
  summary: string;
  /** Short label shown in the sidebar list. Defaults to {@link Trace.title} when omitted. */
  label?: string;
  /**
   * Ordering hint within a course — lower sorts first. By convention `≈ 10 × curriculum week`
   * (e.g. week 1 → 10, week 2 → 20), with a unit digit to order modules inside the same week.
   * Topics sort by the minimum `order` of their modules; modules with equal `order` fall back to
   * `label`. Optional/additive — modules without it sort last, then alphabetically.
   */
  order?: number;
  /**
   * Grouping override for the course code (defaults to {@link Trace.course}). Curriculum content
   * leaves this unset; it exists so the Phase 0–1 engine fixtures keep their own bucket instead of
   * scattering into the SE 200/201 topics by their illustrative metadata.
   */
  course?: string;
  /** Grouping override for the topic (defaults to {@link Trace.topic}). See {@link course}. */
  topic?: string;
}
