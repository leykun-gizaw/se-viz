/**
 * Before→after concept view (PDF screen 08): two code panels — the source with directives (`before`)
 * and the translation unit after `cpp` (`after`) — bridged by a dashed `process` box. Data-driven
 * from {@link Step.beforeAfter}; the lines transformed this step highlight in the value-changed
 * green ("this text was substituted"). Ligatures off (`.se-code`) so C operators read literally.
 */
import type { BeforeAfterStep, Step } from '../../engine/trace/types.ts';

function CodePane({
  title,
  code,
  highlights,
}: {
  title: string;
  code: string;
  highlights: Set<number>;
}) {
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="border-b border-hairline px-4 py-2">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-muted">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-2">
        <pre className="se-code text-sm leading-6">
          <code>
            {lines.map((line, i) => {
              const lineNo = i + 1;
              const changed = highlights.has(lineNo);
              return (
                <div
                  key={lineNo}
                  data-changed={changed}
                  className={`flex px-4 ${changed ? 'bg-changed-soft ring-1 ring-inset ring-changed/40' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className="mr-4 w-6 shrink-0 select-none text-right text-ink-faint"
                  >
                    {lineNo}
                  </span>
                  <span className={`whitespace-pre ${changed ? 'text-ink' : 'text-ink-muted'}`}>
                    {line === '' ? ' ' : line}
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

export function BeforeAfterView({ step }: { step: Step }) {
  const ba: BeforeAfterStep | undefined = step.beforeAfter;
  if (!ba) return null;

  return (
    <div className="flex h-full min-h-0 items-stretch gap-3 rounded-lg border border-hairline bg-bg p-4">
      <CodePane title="before — source" code={ba.before} highlights={new Set(ba.beforeHighlights)} />
      <div className="flex shrink-0 flex-col items-center justify-center">
        <div className="rounded-lg border border-dashed border-hairline-strong bg-surface px-3 py-2 text-center">
          <span className="font-mono text-xs font-semibold text-ink">{ba.processLabel ?? 'cpp'}</span>
          <span className="mt-0.5 block font-sans text-[9px] uppercase tracking-wide text-ink-faint">
            preprocess
          </span>
        </div>
        <span aria-hidden="true" className="my-1 font-mono text-lg text-pointer">
          →
        </span>
      </div>
      <CodePane
        title="after — translation unit"
        code={ba.after}
        highlights={new Set(ba.afterHighlights)}
      />
    </div>
  );
}
