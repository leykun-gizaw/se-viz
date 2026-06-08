/**
 * Theory documents (Phase 19) — long-form, read-first conceptual explanations, one per sidebar
 * **topic**. They are a **separate content type from {@link Trace}** (NOT a trace): authored as
 * Markdown files with YAML-ish frontmatter at `src/content/<course>/<topic>/theory.md`, discovered
 * here with a `?raw` glob, and merged into the course→topic catalog tree **pinned first** within
 * their topic. See `docs/THEORY_AUTHORING.md` for the authoring contract.
 *
 * @packageDocumentation
 */
import { parseFrontmatter } from '../engine/markdown.ts';

/** A parsed theory document, ready for the reading view + sidebar. */
export interface TheoryDoc {
  /** Synthetic selection id, distinct from any trace id (see {@link theoryId}). */
  id: string;
  /** Course code — must match a `docs/CURRICULUM.md` course (e.g. `"SE 200"`). */
  course: string;
  /** Topic — must match the topic a trace uses (the sidebar group). */
  topic: string;
  /** Display title (reading view heading + sidebar tooltip). */
  title: string;
  /** Sort hint; theory pins before its topic's modules. */
  order: number;
  /** Markdown body (frontmatter stripped) for the reading view. */
  body: string;
  /** Source path — for clear error messages and the validation test. */
  path: string;
}

/** Prefix that marks a selection id as a theory doc (never collides with a trace id). */
export const THEORY_ID_PREFIX = 'theory:';

/** The stable selection id for a topic's theory doc. */
export function theoryId(course: string, topic: string): string {
  return `${THEORY_ID_PREFIX}${course}::${topic}`;
}

/** Key for the by-topic lookup the catalog uses to attach theory. */
export function topicKey(course: string, topic: string): string {
  return `${course}::${topic}`;
}

/** Eagerly import every `theory.md` as a raw string (Vite/Vitest `?raw`). */
const RAW = import.meta.glob<string>('./**/theory.md', {
  query: '?raw',
  eager: true,
  import: 'default',
});

function buildTheoryDocs(): TheoryDoc[] {
  const docs: TheoryDoc[] = [];
  for (const [path, raw] of Object.entries(RAW)) {
    const { data, body } = parseFrontmatter(raw);
    const course = data.course?.trim();
    const topic = data.topic?.trim();
    const title = data.title?.trim();
    if (!course || !topic || !title) {
      throw new Error(
        `Theory doc "${path}" must declare frontmatter \`course\`, \`topic\`, and \`title\`. ` +
          `See docs/THEORY_AUTHORING.md.`,
      );
    }
    const order =
      data.order !== undefined && data.order !== '' ? Number(data.order) : Number.MAX_SAFE_INTEGER;
    docs.push({ id: theoryId(course, topic), course, topic, title, order, body, path });
  }
  return docs;
}

/** Every discovered theory doc. */
export const THEORY_DOCS: readonly TheoryDoc[] = buildTheoryDocs();

/** Theory by `course::topic` — used by the catalog to pin theory into its topic. */
export const THEORY_BY_TOPIC: ReadonlyMap<string, TheoryDoc> = new Map(
  THEORY_DOCS.map((d) => [topicKey(d.course, d.topic), d]),
);

/** Theory by selection id — used by the app to resolve a Theory selection. */
export const THEORY_BY_ID: ReadonlyMap<string, TheoryDoc> = new Map(
  THEORY_DOCS.map((d) => [d.id, d]),
);
