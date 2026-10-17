/**
 * The content navigator — the Studio's **course map** (Phase 28: it lives in a resizable,
 * collapsible panel; see `studio/StudioLayout.tsx`). A course **dropdown** picks which course is
 * shown (so the list isn't one giant concatenated scroll of every course), and each topic within the
 * chosen course is a **collapsible** accordion section — collapsed by default except the topic
 * holding the active module — so reaching any example is a short hop, not a long scroll.
 *
 * Labels are sentence case and wrap rather than truncate; the current item carries an azure bar.
 * Collapsed, the panel is a rail with only an expand button. The component stays mounted while
 * collapsed, so the open topics survive a collapse and restore.
 */
import { useLayoutEffect, useRef } from 'react';
import type { CatalogCourse } from '../content/catalog.ts';
import type { TheoryDoc } from '../content/theory.ts';
import { LIVE_CODING_ID } from '../live/config.ts';
import { LIVE_PYTHON_ID } from '../python/live/config.ts';
import { sentenceCase } from './studio/sentenceCase.ts';
import { Chevron, RailButton } from './studio/StudioLayout.tsx';
import { topicKey, type CourseMapNav } from './studio/useCourseMapNav.ts';

export interface ContentSidebarProps {
  courses: readonly CatalogCourse[];
  selectedId: string;
  onSelect: (traceId: string) => void;
  /** Whether the course map is collapsed to its rail. */
  collapsed: boolean;
  /** Collapse to the rail. */
  onCollapse: () => void;
  /** Restore from the rail. */
  onExpand: () => void;
  /**
   * Show the Live Coding entry (Phase 23) — a separate pinned section, not part of the curriculum
   * tree. Set only when a tracer backend is configured (`VITE_TRACER_URL`), so production without
   * one never shows a dead feature.
   */
  liveCodingEnabled?: boolean;
  /** Navigation state held by the caller, so it survives a remount (see `useCourseMapNav`). */
  nav: CourseMapNav;
}

/** Terminal-prompt glyph for the Live Coding entry. */
function LiveIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M5 7l5 5-5 5M12 17h7" />
    </svg>
  );
}

/** Disclosure caret for a topic section: points right when closed, rotates down when open. */
function Caret({ open }: { open: boolean }) {
  return (
    <Chevron
      direction="right"
      size={12}
      className={`shrink-0 text-ink-faint transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    />
  );
}

/** The current item's marker: a soft azure fill with a 3px azure bar on the left. */
const CURRENT =
  'bg-pointer-soft font-semibold before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-pointer';

/**
 * The collapse-all / expand-all toggle glyph (VS Code "unfold" style): two chevrons pointing **toward**
 * the center to collapse, **away** from it to expand.
 */
function CollapseExpandIcon({ collapse }: { collapse: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {collapse ? (
        <>
          <path d="M8 7L12 11L16 7" />
          <path d="M8 17L12 13L16 17" />
        </>
      ) : (
        <>
          <path d="M8 11L12 7L16 11" />
          <path d="M8 13L12 17L16 13" />
        </>
      )}
    </svg>
  );
}

/** The read-first Theory entry, pinned at the top of a topic and visually distinct (azure + book). */
function TheoryEntry({
  theory,
  selectedId,
  onSelect,
}: {
  theory: TheoryDoc;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const active = theory.id === selectedId;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(theory.id)}
        title={theory.title}
        aria-current={active ? 'true' : undefined}
        className={`relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-sans text-[13px] transition-colors ${
          active ? `${CURRENT} text-pointer` : 'text-pointer hover:bg-surface-2'
        }`}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
          <path d="M4 19a2 2 0 0 0 2 2h13" />
        </svg>
        <span>Theory</span>
        <span className="ml-auto text-[11px] text-ink-faint">read first</span>
      </button>
    </li>
  );
}

export function ContentSidebar({
  courses,
  selectedId,
  onSelect,
  collapsed,
  onCollapse,
  onExpand,
  liveCodingEnabled = false,
  nav,
}: ContentSidebarProps) {
  const { courseCode, setCourseCode, expanded, setExpanded, scrollTopRef } = nav;
  // Restore the list's scroll offset when the course map remounts (or returns from its rail).
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = scrollTopRef.current;
  }, [collapsed, scrollTopRef]);

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

  // Open / close every topic in the current course at once.
  const expandAll = () => {
    if (!course) return;
    const keys = course.topics.map((t) => topicKey(course.course, t.topic));
    setExpanded((prev) => new Set([...prev, ...keys]));
  };
  const collapseAll = () => setExpanded(() => new Set());

  // One toggle: if anything is open, the button collapses all; if all closed, it expands all.
  const anyOpen =
    !!course && course.topics.some((t) => expanded.has(topicKey(course.course, t.topic)));

  if (collapsed) {
    return (
      <aside
        aria-label="Course map"
        className="flex h-full w-full flex-col items-center bg-surface py-3"
      >
        <RailButton
          label="Expand the course map"
          direction="right"
          expanded={false}
          onClick={onExpand}
        />
      </aside>
    );
  }

  return (
    <aside aria-label="Course map" className="flex h-full w-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <h2 className="font-sans text-sm font-semibold text-ink">Course map</h2>
        <RailButton
          label="Collapse the course map"
          direction="left"
          expanded={true}
          onClick={onCollapse}
        />
      </div>

      {/* Course picker — swap which course's topics are listed. */}
      <div className="border-b border-hairline px-3 py-2.5">
        <div className="relative">
          <select
            aria-label="Course"
            value={course?.course ?? ''}
            onChange={(e) => onCourseChange(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-md border border-hairline bg-surface-2 py-1.5 pl-2.5 pr-8 font-sans text-[13px] font-semibold text-ink hover:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-pointer"
          >
            {courses.map((c) => (
              <option key={c.course} value={c.course}>
                {c.course}
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
        {/* The course title (wraps instead of truncating), and collapse / expand every topic. */}
        <div className="mt-2 flex items-start justify-between gap-2">
          <p className="min-w-0 pl-0.5 pt-0.5 font-sans text-[13px] leading-snug text-ink-muted">
            {course?.courseTitle}
          </p>
          <button
            type="button"
            onClick={anyOpen ? collapseAll : expandAll}
            aria-label={anyOpen ? 'Collapse all topics' : 'Expand all topics'}
            title={anyOpen ? 'Collapse all topics' : 'Expand all topics'}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
          >
            <CollapseExpandIcon collapse={anyOpen} />
          </button>
        </div>
      </div>

      <nav
        ref={navRef}
        onScroll={(e) => {
          scrollTopRef.current = e.currentTarget.scrollTop;
        }}
        className="flex-1 overflow-y-auto px-2 py-2"
      >
        {course?.topics.map((topic) => {
          const key = topicKey(course.course, topic.topic);
          const open = expanded.has(key);
          return (
            <div key={key} className="mb-0.5">
              <button
                type="button"
                onClick={() => toggleTopic(key)}
                aria-expanded={open}
                className="flex w-full items-start gap-1.5 rounded-md px-1.5 py-1.5 text-left font-sans text-[13px] font-semibold leading-snug text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <span className="mt-[3px]">
                  <Caret open={open} />
                </span>
                <span className="min-w-0 flex-1 break-words">{sentenceCase(topic.topic)}</span>
                <span className="mt-px font-mono text-[11px] font-normal tabular-nums text-ink-faint">
                  {topic.modules.length}
                </span>
              </button>
              {open ? (
                <ul className="mb-1 flex flex-col gap-0.5 pl-3.5">
                  {topic.theory ? (
                    <TheoryEntry
                      theory={topic.theory}
                      selectedId={selectedId}
                      onSelect={onSelect}
                    />
                  ) : null}
                  {topic.modules.map((m) => {
                    const active = m.trace.id === selectedId;
                    return (
                      <li key={m.trace.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(m.trace.id)}
                          title={m.summary}
                          aria-current={active ? 'true' : undefined}
                          className={`relative w-full break-words rounded-md px-2.5 py-1.5 text-left font-sans text-[13px] leading-snug transition-colors ${
                            active
                              ? `${CURRENT} text-ink`
                              : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                          }`}
                        >
                          {sentenceCase(m.label)}
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

      {/* Live coding — its own pinned section, deliberately outside the curriculum tree. Python
          (Phase 31) runs in the browser, so it is always here; C needs the tracer backend. */}
      <div className="flex flex-col gap-0.5 border-t border-hairline p-2">
        <button
          type="button"
          onClick={() => onSelect(LIVE_PYTHON_ID)}
          aria-current={selectedId === LIVE_PYTHON_ID ? 'true' : undefined}
          title="Run your own Python program in the visualizer (runs in your browser)"
          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left font-sans text-[13px] transition-colors ${
            selectedId === LIVE_PYTHON_ID
              ? 'bg-pointer-soft font-semibold text-pointer'
              : 'text-pointer hover:bg-surface-2'
          }`}
        >
          <LiveIcon />
          <span>Live coding · Python</span>
          <span className="ml-auto text-[11px] text-ink-faint">run Python</span>
        </button>
        {liveCodingEnabled ? (
          <button
            type="button"
            onClick={() => onSelect(LIVE_CODING_ID)}
            aria-current={selectedId === LIVE_CODING_ID ? 'true' : undefined}
            title="Run your own C program in the visualizer"
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left font-sans text-[13px] transition-colors ${
              selectedId === LIVE_CODING_ID
                ? 'bg-pointer-soft font-semibold text-pointer'
                : 'text-pointer hover:bg-surface-2'
            }`}
          >
            <LiveIcon />
            <span>Live coding</span>
            <span className="ml-auto text-[11px] text-ink-faint">run C</span>
          </button>
        ) : null}
      </div>
    </aside>
  );
}
