/**
 * Dual-trace concept view (PDF screen 09): two synchronized runs side by side (e.g. buggy vs fixed).
 * Each column shows its source with the current line highlighted, a compact state table (changed
 * rows pulse green), and its console output. The step where the two runs **first diverge** is
 * flagged with a danger marker. Data-driven from {@link Step.dualTrace} + the trace's
 * `leftSource`/`rightSource`; both columns share the single steps array, so they advance in lockstep.
 */
import type { DualColumn, Step, Trace } from '../../engine/trace/types.ts';

function SourceLines({ code, activeLine }: { code: string; activeLine: number | undefined }) {
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <pre className="se-code text-xs leading-6">
      <code>
        {lines.map((line, i) => {
          const lineNo = i + 1;
          const active = activeLine === lineNo;
          return (
            <div
              key={lineNo}
              className={`flex px-3 ${active ? 'bg-(--se-line-active) ring-1 ring-inset ring-active/40' : ''}`}
            >
              <span
                aria-hidden="true"
                className="mr-3 w-5 shrink-0 select-none text-right text-ink-faint"
              >
                {lineNo}
              </span>
              <span className="whitespace-pre text-ink">{line === '' ? ' ' : line}</span>
            </div>
          );
        })}
      </code>
    </pre>
  );
}

function Column({
  column,
  source,
  diverged,
}: {
  column: DualColumn;
  source: string;
  diverged: boolean;
}) {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-surface ${
        diverged ? 'border-danger/60' : 'border-hairline'
      }`}
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <span className="font-mono text-xs font-semibold text-ink">{column.label}</span>
        {diverged ? (
          <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-danger">
            diverges here
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-hairline py-2">
          <SourceLines code={source} activeLine={column.line} />
        </div>
        {column.rows.length > 0 ? (
          <table className="w-full border-b border-hairline font-mono text-xs">
            <tbody>
              {column.rows.map((row) => (
                <tr key={row.name} className={row.changed ? 'bg-changed-soft' : ''}>
                  <td className="px-4 py-1 text-ink-muted">{row.name}</td>
                  <td
                    className={`px-4 py-1 text-right ${row.changed ? 'text-changed' : 'text-ink'}`}
                  >
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {column.stdout && column.stdout.length > 0 ? (
          <div className="px-4 py-2">
            <span className="font-sans text-[9px] uppercase tracking-wide text-ink-faint">
              output
            </span>
            <pre className="se-code mt-1 text-xs leading-5 text-ink-muted">
              {column.stdout.join('\n')}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DualTraceView({ trace, step }: { trace: Trace; step: Step }) {
  const dt = step.dualTrace;
  if (!dt) return null;
  const diverged = dt.diverged ?? false;

  return (
    <div className="flex h-full min-h-0 items-stretch gap-3 rounded-lg border border-hairline bg-bg p-4">
      <Column column={dt.left} source={trace.leftSource ?? ''} diverged={diverged} />
      <Column column={dt.right} source={trace.rightSource ?? ''} diverged={diverged} />
    </div>
  );
}
