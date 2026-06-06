/**
 * The content navigator — lists every module from the catalog, grouped course → topic. This is the
 * Phase 2 replacement for Phase 1's ad-hoc fixture tab strip. (A full course→week→project shell is a
 * later phase; this is a clean grouped switcher.)
 */
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

/** Chevron pointing left (collapse) or right (expand). */
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

export function ContentSidebar({
  courses,
  selectedId,
  onSelect,
  collapsed,
  onToggleCollapse,
}: ContentSidebarProps) {
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
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {courses.map((course) => (
          <div key={course.course} className="mb-5">
            <p className="px-2 pb-1.5 font-sans text-xs font-semibold text-ink">
              {course.course}
              <span className="ml-1.5 font-normal text-ink-muted">· {course.courseTitle}</span>
            </p>
            {course.topics.map((topic) => (
              <div key={topic.topic} className="mb-2">
                <p className="px-2 py-1 font-sans text-[10px] uppercase tracking-wide text-ink-faint">
                  {topic.topic}
                </p>
                <ul className="flex flex-col gap-0.5">
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
              </div>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
