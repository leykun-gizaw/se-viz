/**
 * The memory panel for `language: 'python'` traces (Phase 30). Loaded lazily by `Stage`, so the C
 * path and the main chunk carry none of it.
 *
 * - **Frames:** "Global frame" plus one box per active call, in call order; primitives inline,
 *   references as azure chips with arrows.
 * - **Objects:** one box per object, by kind (see `PyViews.tsx`), ordered by first appearance; an
 *   object referenced only from inside another sits next to its parent (`pyLayout.ts`).
 * - **Layout:** frames on the left, objects on the right, side by side as in Python Tutor, so most
 *   arrows run straight across; a narrow panel scrolls sideways rather than stacking the two
 *   (stacked, arrows would have to cut through object boxes on their way down).
 * - **Arrows** are the shared `ArrowOverlay`, fed by the same anchors and render context as C.
 * - **Diff motion** (`pyMotion.ts`): the canvas animates the object-level events between the step it
 *   showed and the step it shows now — the inverse when stepping back, nothing after a jump, and
 *   nothing with `prefers-reduced-motion`.
 * - **NumPy arrays** (Phase 34, `NdarrayView.tsx`): grids of cells, and a dashed "view of" link from
 *   each view to its base; arrays made by arithmetic sit beside their operands.
 * - **pandas tables** (Phase 35, `TableView.tsx`): DataFrames, Series and GroupBys; a table made from
 *   another sits beside it with a dashed "from" link.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { AnchorProvider } from '../../engine/anchors.tsx';
import { useAnchors } from '../../engine/anchorContext.ts';
import { pointersByTarget } from '../../engine/pointers.ts';
import type { Step, Trace } from '../../engine/trace/types.ts';
import { ArrowOverlay } from '../memory/ArrowOverlay.tsx';
import { MemoryRenderContext, type MemoryRenderState } from '../memory/renderContext.ts';
import { ViewLinks } from './NdarrayView.tsx';
import { CanvasElementContext } from './ndLayout.ts';
import { derivedTables } from '../../engine/trace/pandas.ts';
import { besideOperands, firstAppearance, layoutObjects } from './pyLayout.ts';
import { advanceMotion, initialMotion, motionCues, MotionCuesContext } from './pyMotion.ts';
import { FrameView, ObjectTree, Presence, Region } from './PyViews.tsx';
import { FromLinks } from './TableView.tsx';
import { DerivedContext, useDerived } from './tableLayout.ts';

function Body({ trace, step, arrowsKey }: { trace: Trace; step: Step; arrowsKey: string }) {
  const { setCanvas, pulse } = useAnchors();
  // Re-measure across the springs so arrows track boxes as they move.
  useEffect(() => {
    pulse();
  }, [step.index, pulse]);

  const rank = useMemo(() => firstAppearance(trace), [trace]);
  const beside = useMemo(() => besideOperands(trace), [trace]);
  const rows = useMemo(() => layoutObjects(step, rank, beside), [step, rank, beside]);
  const blocks = useMemo(() => new Map(step.heap.map((b) => [b.id, b])), [step]);
  // Room on the right for the "view of" links' channels (NumPy views), and for the "from" links'
  // (Phase 35: pandas objects made from another one on screen).
  const derived = useDerived();
  const here = new Set(step.heap.map((b) => b.id));
  const views =
    step.heap.some((b) => b.ndarray?.base != null) ||
    step.heap.some((b) => here.has(derived.get(b.id)?.source ?? ''));
  // Room between frames and objects for every arrow's own drop column (ArrowOverlay gives each one
  // its own, 11 px apart): NumPy and pandas programs bind a name per array or table. Only on steps
  // showing arrays or tables, so the Phase 30 layout of other programs is unchanged.
  const refs = step.stack.reduce(
    (n, f) => n + f.variables.filter((v) => v.kind === 'pointer' && v.target !== null).length,
    0,
  );
  const arrays = step.heap.some(
    (b) =>
      b.objectKind === 'ndarray' ||
      b.objectKind === 'dataframe' ||
      b.objectKind === 'series' ||
      b.objectKind === 'groupby',
  );
  const gutter = arrays ? Math.max(0, 14 + refs * 11 + 8 - 50) : 0;

  const canvas = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      canvas.current = el;
      setCanvas(el);
    },
    [setCanvas],
  );

  return (
    <CanvasElementContext.Provider value={canvas}>
      <div ref={setRef} className="relative flex min-h-full w-max min-w-full items-start gap-6 p-1">
        <Region label="Frames" hint="in call order" className="shrink-0">
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
        <Region
          label="Objects"
          hint="references point here"
          className={`min-w-56 flex-1${views ? ' pr-20' : ''}`}
          style={gutter > 0 ? { marginLeft: gutter } : undefined}
        >
          <div className="flex flex-col items-start gap-10">
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
        <ArrowOverlay key={arrowsKey} step={step} bandPerTarget />
        <ViewLinks step={step} />
        <FromLinks step={step} />
      </div>
    </CanvasElementContext.Provider>
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

  const derived = useMemo(() => derivedTables(trace), [trace]);
  const cues = useMemo(() => motionCues(motion, reduce, derived), [motion, reduce, derived]);
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
        <DerivedContext.Provider value={derived}>
          <AnchorProvider>
            <Body trace={trace} step={step} arrowsKey={cues.arrowsKey} />
          </AnchorProvider>
        </DerivedContext.Provider>
      </MotionCuesContext.Provider>
    </MemoryRenderContext.Provider>
  );
}
