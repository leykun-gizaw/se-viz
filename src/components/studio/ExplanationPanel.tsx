/**
 * The step explanation panel (Phase 28) — the Studio's right-hand column. A labeled landmark that
 * explains the current beat in five collapsible sections: "What this step did", "What changed",
 * "Previous step" (open by default), and "Coming next" and "Concept" (closed by default). Section
 * open states persist.
 *
 * All content comes from {@link explainBeat}: authored `explain` data when the step has it, else the
 * narration and the derived diff. On an `arrive` beat the step hasn't run, so its effects are held
 * back until the `apply` beat.
 */
import { useMemo } from 'react';
import {
  explainBeat,
  type ChangeKind,
  type ChangeRow,
  type StepRef,
} from '../../engine/trace/explain.ts';
import type { TracePlayer } from '../../engine/trace/useTrace.ts';
import { usePersistentState } from '../../hooks/usePersistentState.ts';
import { InlineMarkdown } from '../Markdown.tsx';
import { RailButton } from './StudioLayout.tsx';

type SectionId = 'did' | 'changed' | 'previous' | 'next' | 'concept';

/** Which sections start open (the spec's defaults). */
const SECTION_DEFAULTS: Record<SectionId, boolean> = {
  did: true,
  changed: true,
  previous: true,
  next: false,
  concept: false,
};

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: (id: SectionId, open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      onToggle={(e) => {
        const now = e.currentTarget.open;
        if (now !== open) onToggle(id, now);
      }}
      className="group border-b border-hairline"
    >
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-4 py-2.5 font-sans text-[13px] font-semibold text-ink hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-ink-faint transition-transform duration-150 group-open:rotate-90"
        >
          <path
            d="M9 5l7 7-7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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

const KIND_META: Record<ChangeKind, { label: string; className: string }> = {
  value: { label: 'value', className: 'border-changed/50 text-changed' },
  pointer: { label: 'pointer', className: 'border-pointer/50 text-pointer' },
  call: { label: 'call', className: 'border-active/50 text-active' },
  return: { label: 'return', className: 'border-active/50 text-active' },
  alloc: { label: 'malloc', className: 'border-heap/50 text-heap' },
  free: { label: 'free', className: 'border-hairline-strong text-ink-muted' },
  leak: { label: 'leak', className: 'border-danger/50 text-danger' },
  declare: { label: 'new', className: 'border-hairline-strong text-ink-muted' },
  output: { label: 'output', className: 'border-hairline-strong text-ink-muted' },
  state: { label: 'state', className: 'border-pointer/50 text-pointer' },
};

function rowText(row: ChangeRow): string {
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

function ChangeRowView({ row }: { row: ChangeRow }) {
  const meta = KIND_META[row.kind];
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-0.5 shrink-0 rounded border px-1.5 font-mono text-[10px] leading-4 ${meta.className}`}
      >
        {meta.label}
      </span>
      <span className="min-w-0 break-words">
        <span>{rowText(row)}</span>
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

export interface ExplanationPanelProps {
  player: TracePlayer;
  /** Collapse to the rail. Omitted in presentation mode, where the panel is toggled from the header. */
  onCollapse?: () => void;
}

export function ExplanationPanel({ player, onCollapse }: ExplanationPanelProps) {
  const { trace, index, beat, effectiveMode } = player;
  const ex = useMemo(
    () => explainBeat(trace, index, beat, effectiveMode),
    [trace, index, beat, effectiveMode],
  );
  const [stored, setStored] = usePersistentState<Partial<Record<SectionId, boolean>>>(
    'se-viz-explanation-sections',
    {},
  );
  const isOpen = (id: SectionId) =>
    typeof stored[id] === 'boolean' ? (stored[id] as boolean) : SECTION_DEFAULTS[id];
  const onToggle = (id: SectionId, open: boolean) => setStored((s) => ({ ...s, [id]: open }));
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

        <Section id="did" title="What this step did" open={isOpen('did')} onToggle={onToggle}>
          {ex.did === null ? (
            <p className="text-ink-muted">
              About to run. The highlighted line hasn&rsquo;t run yet; step forward to see what it
              does.
            </p>
          ) : ex.did.items.length > 1 ? (
            <ol className="list-decimal space-y-1 pl-4 marker:text-ink-faint">
              {ex.did.items.map((item, i) => (
                <li key={i}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ol>
          ) : (
            <p>{ex.did.authored ? <InlineMarkdown text={ex.did.items[0]} /> : ex.did.items[0]}</p>
          )}
        </Section>

        <Section id="changed" title="What changed" open={isOpen('changed')} onToggle={onToggle}>
          {ex.changes === null ? (
            <p className="text-ink-muted">Nothing yet. The changes appear when this step runs.</p>
          ) : ex.changesNote ? (
            <p className="text-ink-muted">{ex.changesNote}</p>
          ) : ex.changes.length === 0 ? (
            <p className="text-ink-muted">Nothing changed</p>
          ) : (
            <ul className="space-y-1.5">
              {ex.changes.map((row, i) => (
                <ChangeRowView key={i} row={row} />
              ))}
            </ul>
          )}
        </Section>

        <Section id="previous" title="Previous step" open={isOpen('previous')} onToggle={onToggle}>
          {ex.previous ? (
            <StepRefView step={ex.previous} />
          ) : (
            <p className="text-ink-muted">This is the first step.</p>
          )}
        </Section>

        <Section id="next" title="Coming next" open={isOpen('next')} onToggle={onToggle}>
          {ex.next ? (
            <StepRefView step={ex.next} hiddenNote="Shown once the current step has run." />
          ) : (
            <p className="text-ink-muted">This is the last step.</p>
          )}
        </Section>

        {ex.concept ? (
          <Section id="concept" title="Concept" open={isOpen('concept')} onToggle={onToggle}>
            <p>
              <InlineMarkdown text={ex.concept} />
            </p>
          </Section>
        ) : null}
      </div>
    </aside>
  );
}
