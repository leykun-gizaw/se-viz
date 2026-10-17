/**
 * The player surface. For memory traces (default, `view` absent/`'memory'`) it is the three
 * synchronized panels — code (left), memory (right, with the console panel beneath it when the step
 * has output). For the Phase 11 concept views (`pipeline`, `before-after`, `dual-trace`) the main
 * area is replaced by the matching renderer while all surrounding chrome (top bar, transport,
 * keyboard, presentation) is unchanged.
 *
 * Studio layout (Phase 28): in the normal view the narration is a card **under the code panel**
 * (under the concept view for concept traces) and the timeline runs along the bottom. Presentation
 * mode (`presenting`) is unchanged: bigger type, a static divider, and the full-width narration bar.
 */
import { lazy, Suspense, useRef, useState } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { coachVisibleOnBeat } from '../engine/trace/coach.ts';
import { figuresAt } from '../engine/trace/figures.ts';
import type { TracePlayer } from '../engine/trace/useTrace.ts';
import { CoachBubble } from './CoachBubble.tsx';
import { CodePanel } from './CodePanel.tsx';
import { ConsolePanel } from './ConsolePanel.tsx';
import { MemoryCanvas } from './memory/MemoryCanvas.tsx';
import { NarrationBar } from './NarrationBar.tsx';
import { NarrationCard } from './NarrationCard.tsx';
import { Timeline } from './studio/Timeline.tsx';
import { BeforeAfterView } from './concept/BeforeAfterView.tsx';
import { DualTraceView } from './concept/DualTraceView.tsx';
import { PipelineView } from './concept/PipelineView.tsx';

/** The Python memory panel (Phase 30), split out so C traces never load it. */
const PythonCanvas = lazy(() => import('./python/PythonCanvas.tsx'));
/** matplotlib figure output (Phase 36): loaded only for a trace that has figures. */
const FigureStrip = lazy(() =>
  import('./python/figure/FigureOutput.tsx').then((m) => ({ default: m.FigureStrip })),
);
const FigureViewer = lazy(() =>
  import('./python/figure/FigureOutput.tsx').then((m) => ({ default: m.FigureViewer })),
);

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

  // Phase 36: the figures shown at this step (cumulative like stdout: stepping back hides later
  // ones), and the one open in the large view. A figure stepped back past closes its view.
  const figures = figuresAt(trace.figures, displayStep.index);
  const hasFigures = (trace.figures?.length ?? 0) > 0;
  const [openFigure, setOpenFigure] = useState<{ trace: string; id: string } | null>(null);
  const open =
    openFigure && openFigure.trace === trace.id
      ? (figures.find((f) => f.id === openFigure.id) ?? null)
      : null;

  let main;
  let concept = null;
  if (view === 'pipeline') {
    // No line-by-line memory: pipeline forces single-beat, so displayStep === the logical step.
    concept = <PipelineView step={displayStep} />;
  } else if (view === 'before-after') {
    concept = <BeforeAfterView step={displayStep} />;
  } else if (view === 'dual-trace') {
    // Dual-trace gets two-beat stepping (pre-state on arrive, revealed on apply) via displayStep.
    concept = <DualTraceView trace={trace} step={displayStep} />;
  }

  if (concept) {
    main = presenting ? (
      concept
    ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex min-h-0 flex-1 flex-col">{concept}</div>
        <NarrationCard player={player} />
      </div>
    );
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
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="min-h-0 flex-1">
              <CodePanel
                trace={trace}
                step={step}
                displayStep={displayStep}
                displayPrevStep={displayPrevStep}
                pulseKey={pulseKey}
                presenting={presenting}
              />
            </div>
            {presenting ? null : <NarrationCard player={player} />}
          </div>
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
            {hasFigures ? (
              // A trace with figures: the large figure view lies over the canvas (Phase 36).
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-hairline bg-bg p-4">
                  <Suspense
                    fallback={<span className="font-mono text-xs text-ink-faint">Loading…</span>}
                  >
                    <PythonCanvas key={trace.id} trace={trace} step={displayStep} />
                  </Suspense>
                </div>
                {open ? (
                  <Suspense fallback={null}>
                    <FigureViewer
                      figure={open}
                      total={figures.length}
                      onClose={() => setOpenFigure(null)}
                    />
                  </Suspense>
                ) : null}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-hairline bg-bg p-4">
                {trace.language === 'python' ? (
                  <Suspense
                    fallback={<span className="font-mono text-xs text-ink-faint">Loading…</span>}
                  >
                    <PythonCanvas key={trace.id} trace={trace} step={displayStep} />
                  </Suspense>
                ) : (
                  <MemoryCanvas
                    step={displayStep}
                    prevStep={displayPrevStep}
                    heapLayout={trace.heapLayout}
                    staticLayout={trace.staticLayout}
                  />
                )}
              </div>
            )}
            <ConsolePanel
              step={displayStep}
              {...(trace.language === 'python'
                ? { title: 'Output', preserveWhitespace: true }
                : {})}
              figures={
                figures.length > 0 ? (
                  <Suspense
                    fallback={
                      <span className="px-4 py-2 font-mono text-xs text-ink-faint">
                        Loading figures…
                      </span>
                    }
                  >
                    <FigureStrip
                      figures={figures}
                      current={displayStep.index}
                      openId={open?.id ?? null}
                      onOpen={(id) => setOpenFigure({ trace: trace.id, id })}
                    />
                  </Suspense>
                ) : null
              }
            />
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
      {presenting ? <NarrationBar player={player} presenting /> : <Timeline player={player} />}
    </div>
  );
}
