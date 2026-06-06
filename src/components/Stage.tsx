/**
 * The player surface. For memory traces (default, `view` absent/`'memory'`) it is the three
 * synchronized panels — code (left), memory (right, with the console panel beneath it when the step
 * has output) — plus the full-width narration bar. For the Phase 11 concept views (`pipeline`,
 * `before-after`, `dual-trace`) the main area is replaced by the matching renderer while the
 * narration bar and all surrounding chrome (top bar, transport, keyboard, presentation) are
 * unchanged. Shared by the normal workbench and presentation mode (the `presenting` flag only bumps
 * type sizes for the memory view).
 */
import type { TracePlayer } from '../engine/trace/useTrace.ts';
import { CodePanel } from './CodePanel.tsx';
import { ConsolePanel } from './ConsolePanel.tsx';
import { MemoryCanvas } from './memory/MemoryCanvas.tsx';
import { NarrationBar } from './NarrationBar.tsx';
import { BeforeAfterView } from './concept/BeforeAfterView.tsx';
import { DualTraceView } from './concept/DualTraceView.tsx';
import { PipelineView } from './concept/PipelineView.tsx';

export function Stage({
  player,
  presenting = false,
}: {
  player: TracePlayer;
  presenting?: boolean;
}) {
  const { trace, step, prevStep } = player;
  const view = trace.view ?? 'memory';

  let main;
  if (view === 'pipeline') {
    main = <PipelineView step={step} />;
  } else if (view === 'before-after') {
    main = <BeforeAfterView step={step} />;
  } else if (view === 'dual-trace') {
    main = <DualTraceView trace={trace} step={step} />;
  } else {
    main = (
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <CodePanel trace={trace} step={step} presenting={presenting} />
        <div className="flex min-h-0 flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-hairline bg-bg p-4">
            <MemoryCanvas step={step} prevStep={prevStep} heapLayout={trace.heapLayout} />
          </div>
          <ConsolePanel step={step} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col p-4">{main}</div>
      <NarrationBar player={player} presenting={presenting} />
    </div>
  );
}
