/**
 * The step explanation panel (Phase 28) — the Studio's right-hand column. A labeled landmark that
 * explains the current beat in collapsible sections: "What this step did", "What changed",
 * "Previous step" (open by default), "Coming next" and "Concept" (closed by default), and — when
 * there is something to say (Phase 32) — "Branch taken", "Loop iteration", "Calls and returns" and
 * "Exceptions" (open by default).
 *
 * All content comes from {@link explainBeat}: authored `explain` data when the step has it, section
 * by section, else text derived from the trace (Phase 32), else the narration and the diff. On an
 * `arrive` beat the step hasn't run, so its effects are held back until the `apply` beat.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  loadPythonDeriver,
  pythonDeriverReady,
  subscribeDerivers,
} from '../../engine/explain/derive.ts';
import {
  explainBeat,
  type ChangeKind,
  type ChangeRow,
  type StepRef,
} from '../../engine/trace/explain.ts';
import type { TracePlayer } from '../../engine/trace/useTrace.ts';
import { InlineMarkdown } from '../Markdown.tsx';
import { Chevron, RailButton } from './StudioLayout.tsx';

/**
 * One collapsible section. `<details>` is left uncontrolled: `open` only sets the default, and the
 * learner's own toggles survive stepping (the sections stay mounted while the step changes).
 */
function Section({
  title,
  open = true,
  children,
}: {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group border-b border-hairline">
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-4 py-2.5 font-sans text-[13px] font-semibold text-ink hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <Chevron
          direction="right"
          size={12}
          className="shrink-0 text-ink-faint transition-transform duration-150 group-open:rotate-90"
        />
        {title}
      </summary>
      <div className="px-4 pb-3.5 pl-9 font-sans text-[13px] leading-relaxed text-ink">
        {children}
      </div>
    </details>
  );
}

function linesLabel(lines: readonly number[]): string {
  if (lines.length === 0) return 'no line';
  return `${lines.length === 1 ? 'Line' : 'Lines'} ${lines.join(', ')}`;
}

/** Source lines as a compact code block. */
function CodeLines({ lines, code }: { lines: readonly number[]; code: readonly string[] }) {
  if (code.length === 0) return null;
  const sorted = [...lines].sort((a, b) => a - b);
  return (
    <pre className="se-code mt-1.5 overflow-x-auto rounded-md border border-hairline bg-bg px-2.5 py-1.5 text-[12px] leading-5">
      {code.map((text, i) => (
        <div key={i} className="flex gap-3">
          <span aria-hidden="true" className="w-5 shrink-0 select-none text-right text-ink-faint">
            {sorted[i]}
          </span>
          <span className="whitespace-pre text-ink">{text === '' ? ' ' : text}</span>
        </div>
      ))}
    </pre>
  );
}

function StepRefView({ step, hiddenNote }: { step: StepRef; hiddenNote?: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] text-ink-muted">
        Step {step.number} · {linesLabel(step.lines)}
      </div>
      <CodeLines lines={step.lines} code={step.code} />
      {step.narration !== null ? (
        <p className="mt-1.5 text-ink-muted">{step.narration}</p>
      ) : hiddenNote ? (
        <p className="mt-1.5 text-ink-faint">{hiddenNote}</p>
      ) : null}
    </div>
  );
}

const NEUTRAL = 'border-hairline-strong text-ink-muted';
const FRAME = 'border-active/50 text-active';

/** Each change kind's badge: its label and token colour (colour = meaning, as on the canvas). */
const KIND_META: Record<ChangeKind, [label: string, tone: string]> = {
  value: ['value', 'border-changed/50 text-changed'],
  pointer: ['pointer', 'border-pointer/50 text-pointer'],
  call: ['call', FRAME],
  return: ['return', FRAME],
  alloc: ['malloc', 'border-heap/50 text-heap'],
  free: ['free', NEUTRAL],
  leak: ['leak', 'border-danger/50 text-danger'],
  declare: ['new', NEUTRAL],
  output: ['output', NEUTRAL],
  add: ['added', 'border-changed/50 text-changed'],
  remove: ['removed', NEUTRAL],
  figure: ['figure', 'border-pointer/50 text-pointer'],
};

/** A muted note paragraph. */
function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-muted">{children}</p>;
}

/** Python objects are created and become unreachable; they are never malloc'd or freed (Phase 30). */
const PYTHON_META: Partial<Record<ChangeKind, [label: string, tone: string]>> = {
  alloc: ['object', KIND_META.alloc[1]],
  free: ['gone', NEUTRAL],
};

function rowText(row: ChangeRow, python: boolean): string {
  if (python && row.kind === 'alloc') return `${row.subject} object created`;
  if (python && row.kind === 'free') return `${row.subject} is no longer reachable`;
  switch (row.kind) {
    case 'call':
      return `${row.subject} called: a new frame is pushed`;
    case 'return':
      return `${row.subject} returned: its frame is popped`;
    case 'alloc':
      return `${row.subject} allocated on the heap`;
    case 'free':
      return `${row.subject} freed`;
    case 'leak':
      return `${row.subject} is unreachable (leaked)`;
    case 'output':
      return 'Printed';
    default:
      return row.subject;
  }
}

function ChangeRowView({ row, python }: { row: ChangeRow; python: boolean }) {
  const [label, tone] = (python && PYTHON_META[row.kind]) || KIND_META[row.kind];
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-0.5 shrink-0 rounded border px-1.5 font-mono text-[10px] leading-4 ${tone}`}
      >
        {label}
      </span>
      <span className="min-w-0 break-words">
        <span>{row.markdown ? <InlineMarkdown text={row.subject} /> : rowText(row, python)}</span>
        {row.kind === 'output' ? (
          <code className="se-code mt-0.5 block whitespace-pre-wrap rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">
            {row.subject}
          </code>
        ) : null}
        {row.to !== undefined ? (
          <span className="se-code mt-0.5 block text-[12px]">
            {row.from !== undefined ? (
              <>
                <span className="text-ink-muted">{row.from}</span>
                <span aria-hidden="true" className="px-1 text-ink-faint">
                  →
                </span>
                <span className="sr-only"> becomes </span>
              </>
            ) : (
              <span className="text-ink-faint">= </span>
            )}
            <span className="font-semibold text-ink">{row.to}</span>
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** A derived or authored section: one sentence, or an ordered list of them. */
function Sentences({ items }: { items: readonly string[] }) {
  if (items.length === 1) {
    return (
      <p>
        <InlineMarkdown text={items[0]} />
      </p>
    );
  }
  return (
    <ul className="list-disc space-y-1 pl-4 marker:text-ink-faint">
      {items.map((item, i) => (
        <li key={i}>
          <InlineMarkdown text={item} />
        </li>
      ))}
    </ul>
  );
}

export interface ExplanationPanelProps {
  player: TracePlayer;
  /** Collapse to the rail. Omitted in presentation mode, where the panel is toggled from the header. */
  onCollapse?: () => void;
}

export function ExplanationPanel({ player, onCollapse }: ExplanationPanelProps) {
  const { trace, index, beat, effectiveMode } = player;
  // Python's derived explanations are a lazy chunk (Phase 32): load it for a Python trace, and
  // explain again once it is in.
  const pythonReady = useSyncExternalStore(subscribeDerivers, pythonDeriverReady, pythonDeriverReady);
  const python = trace.language === 'python';
  useEffect(() => {
    if (python && !pythonReady) void loadPythonDeriver();
  }, [python, pythonReady]);
  const ex = useMemo(() => {
    // Read so the memo re-runs when the Python deriver arrives: it changes what is derived.
    void pythonReady;
    return explainBeat(trace, index, beat, effectiveMode);
  }, [trace, index, beat, effectiveMode, pythonReady]);
  const arriving = ex.status === 'about-to-run';

  return (
    <aside aria-label="Step explanation" className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
        <h2 className="font-sans text-sm font-semibold text-ink">Step explanation</h2>
        {onCollapse ? (
          <RailButton
            label="Collapse the step explanation"
            direction="right"
            expanded={true}
            onClick={onCollapse}
          />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Header chip: step number, highlighted lines, run state, and the current source line. */}
        <div className="border-b border-hairline px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-active/50 bg-active-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-active">
              Step {ex.current.number} / {ex.total}
            </span>
            <span className="rounded-md border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-muted">
              {linesLabel(ex.current.lines)}
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 font-sans text-[11px] font-semibold ${
                arriving
                  ? 'border-pointer/50 bg-pointer-soft text-pointer'
                  : 'border-hairline bg-surface-2 text-ink-muted'
              }`}
            >
              {arriving ? 'About to run' : 'Ran'}
            </span>
          </div>
          <CodeLines lines={ex.current.lines} code={ex.current.code} />
        </div>

        <Section title="What this step did">
          {ex.did === null ? (
            <Note>
              About to run. The highlighted line hasn&rsquo;t run yet; step forward to see what it
              does.
            </Note>
          ) : arriving ? (
            <>
              <p>
                <InlineMarkdown text={ex.did.items[0]} />
              </p>
              <p className="mt-1.5 text-ink-muted">Step forward to see what it does.</p>
            </>
          ) : ex.did.items.length > 1 ? (
            <ol className="list-decimal space-y-1 pl-4 marker:text-ink-faint">
              {ex.did.items.map((item, i) => (
                <li key={i}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ol>
          ) : (
            <p>{ex.did.markdown ? <InlineMarkdown text={ex.did.items[0]} /> : ex.did.items[0]}</p>
          )}
        </Section>

        <Section title="What changed">
          {ex.changes === null ? (
            <Note>Nothing yet. The changes appear when this step runs.</Note>
          ) : ex.changedText ? (
            <Sentences items={ex.changedText} />
          ) : ex.changesNote ? (
            <Note>{ex.changesNote}</Note>
          ) : ex.changes.length === 0 ? (
            <Note>Nothing changed</Note>
          ) : (
            <ul className="space-y-1.5">
              {ex.changes.map((row, i) => (
                <ChangeRowView key={i} row={row} python={trace.language === 'python'} />
              ))}
            </ul>
          )}
        </Section>

        {ex.branch.length > 0 ? (
          <Section title="Branch taken">
            <Sentences items={ex.branch} />
          </Section>
        ) : null}

        {ex.loop.length > 0 ? (
          <Section title="Loop iteration">
            <Sentences items={ex.loop} />
          </Section>
        ) : null}

        {ex.calls.length > 0 ? (
          <Section title="Calls and returns">
            <Sentences items={ex.calls} />
          </Section>
        ) : null}

        {ex.exceptions.length > 0 ? (
          <Section title="Exceptions">
            <Sentences items={ex.exceptions} />
          </Section>
        ) : null}

        <Section title="Previous step">
          {ex.previous ? <StepRefView step={ex.previous} /> : <Note>This is the first step.</Note>}
        </Section>

        <Section title="Coming next" open={false}>
          {ex.next ? (
            <StepRefView step={ex.next} hiddenNote="Shown once the current step has run." />
          ) : (
            <Note>This is the last step.</Note>
          )}
        </Section>

        {ex.concept ? (
          <Section title="Concept" open={false}>
            <p>
              <InlineMarkdown text={ex.concept} />
            </p>
          </Section>
        ) : null}
      </div>
    </aside>
  );
}
