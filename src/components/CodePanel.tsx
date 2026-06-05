/**
 * The code panel: source with line numbers, the current step's line(s) highlighted, and lightweight
 * C syntax coloring. Ligatures are OFF (via the `.se-code` class) so operators render literally —
 * `->`, `!=`, `<=`, `++` — never as `→ ≠ ≤`.
 */
import { tokenizeLine, type TokenType } from '../engine/highlightC.ts';
import type { Step, Trace } from '../engine/trace/types.ts';

const TOKEN_CLASS: Record<TokenType, string> = {
  keyword: 'text-kw',
  type: 'text-ty',
  fn: 'text-fn',
  string: 'text-str',
  number: 'text-num',
  comment: 'text-comment italic',
  preproc: 'text-kw',
  punct: 'text-punct',
  plain: 'text-ink',
};

export interface CodePanelProps {
  trace: Trace;
  step: Step;
  /** Larger type for presentation mode. */
  presenting?: boolean;
}

export function CodePanel({ trace, step, presenting = false }: CodePanelProps) {
  const lines = trace.source.replace(/\n$/, '').split('\n');
  const highlighted = new Set(step.highlightedLines);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2">
        <span className="font-mono text-[11px] text-ink-faint">&lt;/&gt;</span>
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
          {trace.file ?? `${trace.id}.c`}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-2">
        <pre className={`se-code ${presenting ? 'text-base leading-7' : 'text-sm leading-6'}`}>
          <code>
            {lines.map((line, i) => {
              const lineNo = i + 1;
              const isActive = highlighted.has(lineNo);
              const tokens = tokenizeLine(line);
              return (
                <div
                  key={lineNo}
                  data-active={isActive}
                  className={`flex px-4 ${isActive ? 'bg-(--se-line-active) ring-1 ring-inset ring-active/40' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className="mr-4 w-6 shrink-0 select-none text-right text-ink-faint"
                  >
                    {lineNo}
                  </span>
                  <span className="whitespace-pre">
                    {line === ''
                      ? ' '
                      : tokens.map((t, ti) => (
                          <span key={ti} className={TOKEN_CLASS[t.type]}>
                            {t.text}
                          </span>
                        ))}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
