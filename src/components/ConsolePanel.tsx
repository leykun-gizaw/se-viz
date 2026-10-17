/**
 * The console / heap-watch panel (PDF screen 04). Shows accumulated program output (`stdout`) plus
 * the engine's heap-watch diagnostics (dangling reads, leaks) in the danger hue. Rendered only when
 * the current step carries output or watch entries.
 */
import type { ReactNode } from 'react';
import type { Step } from '../engine/trace/types.ts';

export function ConsolePanel({
  step,
  title = 'Output · heap watch',
  preserveWhitespace = false,
  figures = null,
}: {
  step: Step;
  title?: string;
  /**
   * Keep spaces as printed (Phase 31, Python): indented output and a traceback's `^^^` markers only
   * line up with their source line when leading spaces survive. C output keeps the default.
   */
  preserveWhitespace?: boolean;
  /**
   * Python figures (Phase 36): the thumbnails of the matplotlib figures visible at this step, shown
   * above the printed lines. The panel also shows when a step has figures but no output.
   */
  figures?: ReactNode;
}) {
  const stdout = step.stdout ?? [];
  const watch = step.watch ?? [];
  if (stdout.length === 0 && watch.length === 0 && !figures) return null;

  return (
    <div
      className={`flex ${figures ? 'max-h-72' : 'max-h-40'} flex-col overflow-auto rounded-lg border border-hairline bg-surface`}
    >
      <div className="border-b border-hairline px-4 py-1.5">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          {title}
        </span>
      </div>
      {figures}
      {stdout.length === 0 && watch.length === 0 ? null : (
        <div className="se-code flex flex-col gap-0.5 px-4 py-2 text-xs">
          {stdout.map((line, i) => (
            <span
              key={`out-${i}`}
              className={preserveWhitespace ? 'whitespace-pre-wrap text-ink' : 'text-ink'}
            >
              {line}
            </span>
          ))}
          {watch.map((w, i) => (
            <span
              key={`watch-${i}`}
              className={w.level === 'info' ? 'text-ink-muted' : 'text-danger'}
            >
              {w.level === 'info' ? '' : '⚠ '}
              {w.message}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
