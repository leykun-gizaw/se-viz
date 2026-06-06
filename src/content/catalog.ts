/**
 * The content catalog — the single source of truth for every visualization module, grouped by
 * course → topic. The workbench lists modules from here; a future navigation shell consumes the
 * same structure.
 *
 * ## Auto-discovery (Phase 05)
 * This catalog is **not** hand-maintained. It discovers content modules from the filesystem with
 * Vite's `import.meta.glob`: any file under `src/content/<course>/<topic>/<module>.ts` (or
 * `src/content/fixtures/*.ts`) that **default-exports** a {@link ContentModule} is registered
 * automatically. Adding curriculum content therefore requires **no edit to this file** — that is
 * what lets several content phases run in parallel without colliding here. See
 * [`module.ts`](./module.ts), `docs/TRACE_FORMAT.md`, and `docs/CONTENT_AUTHORING.md`.
 *
 * @packageDocumentation
 */

import type { Trace } from '../engine/trace/types.ts';
import type { ContentModule } from './module.ts';

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

/**
 * Display title + ordering per course code. Discovery does **not** depend on this map: a course
 * code missing here still appears (its title falls back to the code, sorted after the known
 * courses). It only supplies human titles and an explicit course order. Course codes come from
 * `docs/CURRICULUM.md` — never fabricate one.
 */
const COURSE_META: Record<string, { title: string; order: number }> = {
  'SE 200': { title: 'C Programming I', order: 0 },
  'SE 201': { title: 'Data Structures and Algorithms I', order: 1 },
  'Engine fixtures': { title: 'Phase 0–1 validation traces', order: 99 },
};

const UNRANKED = Number.MAX_SAFE_INTEGER;
const courseRank = (code: string) => COURSE_META[code]?.order ?? UNRANKED;
const courseTitle = (code: string) => COURSE_META[code]?.title ?? code;

/**
 * Eagerly import every content module. The patterns match curriculum content at
 * `<course>/<topic>/<module>.ts` and the engine fixtures at `fixtures/*.ts`; `*.test.ts` and the
 * two-segment `phase0/*` scratch traces are excluded.
 */
const DISCOVERED = import.meta.glob<{ default: ContentModule }>(
  [
    './*/*/*.ts',
    './fixtures/*.ts',
    '!./**/*.test.ts',
    // linkedList & mallocFree are superseded by the polished SE 201 linked-lists / dynamic-memory
    // content (Wave 1). They remain in fixtures/ as engine-test fixtures (imported by
    // pointers.test.ts / pulse.test.ts) but are excluded here so they don't duplicate that content
    // in the catalog. pointerArith stays as the lone engine-fixtures entry.
    '!./fixtures/linkedList.ts',
    '!./fixtures/mallocFree.ts',
  ],
  { eager: true },
);

interface RankedModule extends ContentModule {
  /** Source path, used only for clear error messages. */
  path: string;
}

function discoverModules(): RankedModule[] {
  const modules: RankedModule[] = [];
  for (const [path, mod] of Object.entries(DISCOVERED)) {
    const m = mod.default;
    if (!m || typeof m !== 'object' || !('trace' in m) || !m.trace) {
      throw new Error(
        `Content module "${path}" must \`export default\` a ContentModule ({ trace, summary }). ` +
          `See docs/CONTENT_AUTHORING.md.`,
      );
    }
    modules.push({ ...m, path });
  }
  return modules;
}

function pushInto<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

const moduleOrder = (m: ContentModule) => m.order ?? UNRANKED;
const moduleLabel = (m: ContentModule) => m.label ?? m.trace.title;

/** Group → sort discovered modules into the course→topic tree the sidebar renders. */
function buildCatalog(): CatalogCourse[] {
  const byCourse = new Map<string, RankedModule[]>();
  for (const m of discoverModules()) {
    pushInto(byCourse, m.course ?? m.trace.course ?? 'Uncategorized', m);
  }

  return [...byCourse.entries()]
    .sort(([a], [b]) => courseRank(a) - courseRank(b) || a.localeCompare(b))
    .map(([course, mods]) => {
      const byTopic = new Map<string, RankedModule[]>();
      for (const m of mods) pushInto(byTopic, m.topic ?? m.trace.topic ?? 'Misc', m);

      const topics: CatalogTopic[] = [...byTopic.entries()]
        .map(([topic, tmods]) => ({
          topic,
          topicRank: Math.min(...tmods.map(moduleOrder)),
          modules: tmods
            .slice()
            .sort(
              (x, y) => moduleOrder(x) - moduleOrder(y) || moduleLabel(x).localeCompare(moduleLabel(y)),
            )
            .map((m): CatalogModule => ({ label: moduleLabel(m), summary: m.summary, trace: m.trace })),
        }))
        .sort((a, b) => a.topicRank - b.topicRank || a.topic.localeCompare(b.topic))
        .map(({ topic, modules }) => ({ topic, modules }));

      return { course, courseTitle: courseTitle(course), topics };
    });
}

export const CATALOG: readonly CatalogCourse[] = buildCatalog();

/** Every trace in the catalog, flattened — used by the validation test and the workbench index. */
export function allCatalogTraces(): Trace[] {
  return CATALOG.flatMap((c) => c.topics.flatMap((t) => t.modules.map((m) => m.trace)));
}

/** Every module in the catalog, flattened in display order (for a flat selection index). */
export function allCatalogModules(): CatalogModule[] {
  return CATALOG.flatMap((c) => c.topics.flatMap((t) => t.modules));
}
