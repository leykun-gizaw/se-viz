/**
 * The content navigator. A course **dropdown** picks which course is shown (so the list isn't one
 * giant concatenated scroll of every course), and each topic within the chosen course is a
 * **collapsible** accordion section — collapsed by default except the topic holding the active
 * module — so reaching any example is a short hop, not a long scroll.
 */
import { useState } from 'react';
import type { CatalogCourse } from '../content/catalog.ts';

export interface ContentSidebarProps {
  courses: readonly CatalogCourse[];
  selectedId: string;
  onSelect: (traceId: string) => void;
  /** Whether the sidebar is collapsed to a thin rail. */
  collapsed: boolean;
  /** Toggle collapsed/expanded. */
  onToggleCollapse: () => void;
}

/** Chevron pointing left (collapse) or right (expand) — for the whole-sidebar rail toggle. */
function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Disclosure caret for a topic section: points right when closed, rotates down when open. */
function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-ink-faint transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    >
      <path
        d="M9 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const topicKey = (course: string, topic: string) => `${course}::${topic}`;

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

export function ContentSidebar({
  courses,
  selectedId,
  onSelect,
  collapsed,
  onToggleCollapse,
}: ContentSidebarProps) {
  // Initialise (once) from where the active module lives: show its course, open its topic.
  const [courseCode, setCourseCode] = useState(
    () => findLocation(courses, selectedId)?.course ?? courses[0]?.course ?? '',
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const loc = findLocation(courses, selectedId);
    return loc ? new Set([topicKey(loc.course, loc.topic)]) : new Set();
  });

  const course = courses.find((c) => c.course === courseCode) ?? courses[0];

  const toggleTopic = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onCourseChange = (code: string) => {
    setCourseCode(code);
    // Open the first topic if none in this course is open yet, so the panel is never blank.
    const c = courses.find((x) => x.course === code);
    if (!c || c.topics.length === 0) return;
    setExpanded((prev) => {
      if (c.topics.some((t) => prev.has(topicKey(code, t.topic)))) return prev;
      return new Set(prev).add(topicKey(code, c.topics[0].topic));
    });
  };

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center border-r border-hairline bg-surface py-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand module list"
          aria-expanded={false}
          title="Expand module list"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
        >
          <Chevron direction="right" />
        </button>
        <span
          className="mt-3 font-sans text-[10px] font-semibold uppercase tracking-wider text-ink-faint [writing-mode:vertical-rl]"
          aria-hidden="true"
        >
          Modules
        </span>
      </aside>
    );
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-hairline bg-surface">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h2 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Modules
        </h2>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Collapse module list"
          aria-expanded={true}
          title="Collapse module list"
          className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
        >
          <Chevron direction="left" />
        </button>
      </div>

      {/* Course picker — swap which course's topics are listed. */}
      <div className="border-b border-hairline px-3 py-2.5">
        <div className="relative">
          <select
            aria-label="Course"
            value={course?.course ?? ''}
            onChange={(e) => onCourseChange(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-md border border-hairline bg-surface-2 py-1.5 pl-2.5 pr-8 font-sans text-xs font-semibold text-ink hover:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-pointer"
          >
            {courses.map((c) => (
              <option key={c.course} value={c.course}>
                {c.course} · {c.courseTitle}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {course?.topics.map((topic) => {
          const key = topicKey(course.course, topic.topic);
          const open = expanded.has(key);
          return (
            <div key={key} className="mb-0.5">
              <button
                type="button"
                onClick={() => toggleTopic(key)}
                aria-expanded={open}
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left font-sans text-[10px] font-semibold uppercase tracking-wide text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-muted"
              >
                <Caret open={open} />
                <span className="min-w-0 flex-1 truncate">{topic.topic}</span>
                <span className="font-mono text-[10px] font-normal tabular-nums text-ink-faint">
                  {topic.modules.length}
                </span>
              </button>
              {open ? (
                <ul className="mb-1 flex flex-col gap-0.5 pl-3.5">
                  {topic.modules.map((m) => {
                    const active = m.trace.id === selectedId;
                    return (
                      <li key={m.trace.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(m.trace.id)}
                          title={m.summary}
                          aria-current={active ? 'true' : undefined}
                          className={`w-full rounded-md px-2 py-1.5 text-left font-sans text-xs transition-colors ${
                            active
                              ? 'bg-surface-3 font-semibold text-ink'
                              : 'text-ink-muted hover:bg-surface-2'
                          }`}
                        >
                          {m.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
