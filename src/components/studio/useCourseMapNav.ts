/**
 * The course map's navigation state (which course is shown, which topics are open, how far the list
 * is scrolled), held **above** the Studio panel group (Phase 28).
 *
 * The group is remounted when the set of panels changes (player ⇄ theory deck / live coding; see
 * `StudioLayout`), which remounts the course map too. Keeping this state in `App` means a remount
 * doesn't reset the presenter's open topics or scroll position.
 */
import { useRef, useState, type RefObject } from 'react';
import type { CatalogCourse } from '../../content/catalog.ts';

export const topicKey = (course: string, topic: string) => `${course}::${topic}`;

/** Where a module lives in the catalog — drives the initial course + which topic starts open. */
function findLocation(
  courses: readonly CatalogCourse[],
  traceId: string,
): { course: string; topic: string } | null {
  for (const c of courses) {
    const t = c.topics.find((t) => t.modules.some((m) => m.trace.id === traceId));
    if (t) return { course: c.course, topic: t.topic };
  }
  return null;
}

export interface CourseMapNav {
  courseCode: string;
  setCourseCode: (code: string) => void;
  expanded: Set<string>;
  setExpanded: (update: (prev: Set<string>) => Set<string>) => void;
  /** Last scroll offset of the topic list, restored when the course map remounts. */
  scrollTopRef: RefObject<number>;
}

export function useCourseMapNav(
  courses: readonly CatalogCourse[],
  selectedId: string,
): CourseMapNav {
  // Initialise (once) from where the active module lives: show its course, open its topic.
  const [courseCode, setCourseCode] = useState(
    () => findLocation(courses, selectedId)?.course ?? courses[0]?.course ?? '',
  );
  const [expanded, setExpandedState] = useState<Set<string>>(() => {
    const loc = findLocation(courses, selectedId);
    return loc ? new Set([topicKey(loc.course, loc.topic)]) : new Set();
  });
  const scrollTopRef = useRef(0);
  return { courseCode, setCourseCode, expanded, setExpanded: setExpandedState, scrollTopRef };
}
