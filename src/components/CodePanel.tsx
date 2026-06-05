/**
 * The code panel. Renders the trace source with the current step's line(s) highlighted.
 * Line numbers are 1-based to match {@link Step.highlightedLines}.
 */
import type { Step, Trace } from '../engine/trace/types.ts';

export interface CodePanelProps {
  trace: Trace;
  step: Step;
}

export function CodePanel({ trace, step }: CodePanelProps) {
  const lines = trace.source.replace(/\n$/, '').split('\n');
  const highlighted = new Set(step.highlightedLines);

  return (
    <div className="h-full overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-3">
      <pre className="font-mono text-sm leading-6">
        <code>
          {lines.map((line, i) => {
            const lineNo = i + 1;
            const isActive = highlighted.has(lineNo);
            return (
              <div
                key={lineNo}
                className={`flex ${isActive ? 'rounded bg-sky-500/20 ring-1 ring-sky-500/40' : ''}`}
                data-active={isActive}
              >
                <span className="mr-3 w-6 shrink-0 select-none text-right text-slate-600">
                  {lineNo}
                </span>
                <span className={isActive ? 'text-sky-100' : 'text-slate-300'}>
                  {line === '' ? ' ' : line}
                </span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
