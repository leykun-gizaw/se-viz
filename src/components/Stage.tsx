/**
 * The player surface. For memory traces (default, `view` absent/`'memory'`) it is the three
 * synchronized panels — code (left), memory (right, with the console panel beneath it when the step
 * has output) — plus the full-width narration bar. For the Phase 11 concept views (`pipeline`,
 * `before-after`, `dual-trace`) the main area is replaced by the matching renderer while the
 * narration bar and all surrounding chrome (top bar, transport, keyboard, presentation) are
 * unchanged. Shared by the normal workbench and presentation mode (the `presenting` flag only bumps
 * type sizes for the memory view).
 */
import { useRef } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { coachVisibleOnBeat } from '../engine/trace/coach.ts';
import type { TracePlayer } from '../engine/trace/useTrace.ts';
import { CoachBubble } from './CoachBubble.tsx';
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
  const { trace, step, displayStep, displayPrevStep, beat } = player;
  const view = trace.view ?? 'memory';
  // The coach bubble positions itself within (and queries anchors from) this content box.
  const contentRef = useRef<HTMLDivElement>(null);
  // Two-beat aware (Phase 16): predict notes show on `arrive`, explanations on `apply` (the note's
  // `beat`, default `apply`). Single-beat views always report `apply`, so the note shows on the step.
  const coachNote = step.coach && coachVisibleOnBeat(step.coach, beat) ? step.coach : null;
  // Persisted, debounced split layout (react-resizable-panels handles the drag perf + a11y).
  const split = useDefaultLayout({ id: 'se-viz-split', storage: localStorage });

  // Re-fires inline / memory pulses on the `apply` beat (and each new step).
  const pulseKey = `${displayStep.index}:${beat}`;

  let main;
  if (view === 'pipeline') {
    // No line-by-line memory: pipeline forces single-beat, so displayStep === the logical step.
    main = <PipelineView step={displayStep} />;
  } else if (view === 'before-after') {
    main = <BeforeAfterView step={displayStep} />;
  } else if (view === 'dual-trace') {
    // Dual-trace gets two-beat stepping (pre-state on arrive, revealed on apply) via displayStep.
    main = <DualTraceView trace={trace} step={displayStep} />;
  } else {
    // Code (left) and visualization (right) share the width via a draggable divider, defaulting to
    // a narrower code panel so the memory canvas gets the room. The divider is disabled (static) in
    // presentation mode but still honors the saved layout.
    main = (
      <Group
        orientation="horizontal"
        className="flex min-h-0 flex-1"
        defaultLayout={split.defaultLayout}
        onLayoutChange={split.onLayoutChange}
      >
        <Panel
          id="code"
          defaultSize="38%"
          minSize="20%"
          maxSize="80%"
          className="h-full min-h-0 min-w-0"
        >
          <CodePanel
            trace={trace}
            step={step}
            displayStep={displayStep}
            displayPrevStep={displayPrevStep}
            pulseKey={pulseKey}
            presenting={presenting}
          />
        </Panel>
        <Separator
          disabled={presenting}
          aria-label="Resize the code and visualization panels"
          className="group relative flex w-2 items-center justify-center"
        >
          <div className="h-full w-px bg-hairline transition-colors group-hover:bg-pointer group-focus-visible:bg-pointer" />
          <div className="pointer-events-none absolute h-8 w-1 rounded-full bg-hairline-strong transition-colors group-hover:bg-pointer" />
        </Separator>
        <Panel id="viz" minSize="20%" className="h-full min-h-0 min-w-0">
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-hairline bg-bg p-4">
              <MemoryCanvas
                step={displayStep}
                prevStep={displayPrevStep}
                heapLayout={trace.heapLayout}
                staticLayout={trace.staticLayout}
              />
            </div>
            <ConsolePanel step={displayStep} />
          </div>
        </Panel>
      </Group>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={contentRef} className="relative flex min-h-0 flex-1 flex-col p-4">
        {main}
        {coachNote ? (
          <CoachBubble
            key={`${trace.id}:${step.index}:${beat}`}
            note={coachNote}
            containerRef={contentRef}
          />
        ) : null}
      </div>
      <NarrationBar player={player} presenting={presenting} />
    </div>
  );
}
