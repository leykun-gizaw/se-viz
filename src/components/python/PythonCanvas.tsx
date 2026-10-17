/**
 * The memory panel for `language: 'python'` traces (Phase 30). Loaded lazily by `Stage`, so the C
 * path and the main chunk carry none of it.
 *
 * - **Frames:** "Global frame" plus one box per active call, in call order; primitives inline,
 *   references as azure chips with arrows.
 * - **Objects:** one box per object, by kind (see `PyViews.tsx`), ordered by first appearance; an
 *   object referenced only from inside another sits next to its parent (`pyLayout.ts`).
 * - **Arrows** are the shared `ArrowOverlay`, fed by the same anchors and render context as C.
 * - **Diff motion** (`pyMotion.ts`): the canvas animates the object-level events between the step it
 *   showed and the step it shows now — the inverse when stepping back, nothing after a jump, and
 *   nothing with `prefers-reduced-motion`.
 */
import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { AnchorProvider } from '../../engine/anchors.tsx';
import { useAnchors } from '../../engine/anchorContext.ts';
import { pointersByTarget } from '../../engine/pointers.ts';
import type { Step, Trace } from '../../engine/trace/types.ts';
import { ArrowOverlay } from '../memory/ArrowOverlay.tsx';
import { MemoryRenderContext, type MemoryRenderState } from '../memory/renderContext.ts';
import { firstAppearance, layoutObjects } from './pyLayout.ts';
import { advanceMotion, initialMotion, motionCues, MotionCuesContext } from './pyMotion.ts';
import { FrameView, ObjectTree, Presence, Region } from './PyViews.tsx';

function Body({ trace, step, arrowsKey }: { trace: Trace; step: Step; arrowsKey: string }) {
  const { setCanvas, pulse } = useAnchors();
  // Re-measure across the springs so arrows track boxes as they move.
  useEffect(() => {
    pulse();
  }, [step.index, pulse]);

  const rank = useMemo(() => firstAppearance(trace), [trace]);
  const rows = useMemo(() => layoutObjects(step, rank), [step, rank]);
  const blocks = useMemo(() => new Map(step.heap.map((b) => [b.id, b])), [step]);

  return (
    <div
      ref={setCanvas}
      className="relative flex min-h-full flex-wrap items-start gap-x-12 gap-y-6 p-2"
    >
      <Region label="Frames" hint="names · newest call last" className="shrink-0">
        <div className="flex flex-col gap-2">
          <Presence>
            {step.stack.map((frame) => (
              <FrameView key={frame.id} frame={frame} />
            ))}
          </Presence>
          {step.stack.length === 0 ? (
            <span className="px-1 py-2 font-mono text-xs text-ink-faint">no frames</span>
          ) : null}
        </div>
      </Region>
      <Region label="Objects" hint="references point here" className="min-w-64 flex-1">
        <div className="flex flex-col items-start gap-4">
          <Presence>
            {rows.map((node) => (
              <ObjectTree key={node.id} node={node} blocks={blocks} />
            ))}
          </Presence>
          {rows.length === 0 ? (
            <span className="px-1 py-2 font-mono text-xs text-ink-faint">no objects yet</span>
          ) : null}
        </div>
      </Region>
      <ArrowOverlay key={arrowsKey} step={step} />
    </div>
  );
}

export interface PythonCanvasProps {
  trace: Trace;
  /** The snapshot to show (the pre-state on an `arrive` beat). */
  step: Step;
}

export default function PythonCanvas({ trace, step }: PythonCanvasProps) {
  const reduce = useReducedMotion() ?? false;
  // The step shown last, kept in state: moving to a new step derives the events to animate.
  const [state, setState] = useState(() => initialMotion(step));
  const motion = advanceMotion(state, step);
  if (motion !== state) setState(motion);

  const cues = useMemo(() => motionCues(motion, reduce), [motion, reduce]);
  const renderState = useMemo<MemoryRenderState>(
    () => ({
      pulsing: new Set(cues.changed.keys()),
      retargeted: cues.retargeted,
      activeId: step.activeId,
      targetedBy: pointersByTarget(step),
      stepIndex: step.index,
    }),
    [cues, step],
  );

  return (
    <MemoryRenderContext.Provider value={renderState}>
      <MotionCuesContext.Provider value={cues}>
        <AnchorProvider>
          <Body trace={trace} step={step} arrowsKey={cues.arrowsKey} />
        </AnchorProvider>
      </MotionCuesContext.Provider>
    </MemoryRenderContext.Provider>
  );
}
