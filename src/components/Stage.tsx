/**
 * The three synchronized panels — code (left), memory (right, with the console panel beneath it
 * when the step has output), and the full-width narration bar. Shared by the normal workbench and
 * presentation mode (the `presenting` flag only bumps type sizes).
 */
import type { TracePlayer } from '../engine/trace/useTrace.ts';
import { CodePanel } from './CodePanel.tsx';
import { ConsolePanel } from './ConsolePanel.tsx';
import { MemoryCanvas } from './memory/MemoryCanvas.tsx';
import { NarrationBar } from './NarrationBar.tsx';

export function Stage({
  player,
  presenting = false,
}: {
  player: TracePlayer;
  presenting?: boolean;
}) {
  const { trace, step, prevStep } = player;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <CodePanel trace={trace} step={step} presenting={presenting} />
        <div className="flex min-h-0 flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-hairline bg-bg p-4">
            <MemoryCanvas step={step} prevStep={prevStep} heapLayout={trace.heapLayout} />
          </div>
          <ConsolePanel step={step} />
        </div>
      </div>
      <NarrationBar player={player} presenting={presenting} />
    </div>
  );
}
