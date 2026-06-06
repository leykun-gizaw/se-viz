/**
 * The memory panel: the generic renderer that draws an entire {@link Step} — stack frames on the
 * left, heap blocks and array data on the right, with the SVG arrow overlay on top. Animations
 * (frame push/pop springs, value pulses, pointer-arrow glides) are all derived from the diff
 * between `prevStep` and `step`, so stepping back reverses them.
 *
 * Stack ordering note: frames render oldest-first (top) → newest-last (bottom), matching the locked
 * PDF screen 01 ("newest frame at the bottom"). See the report's deviations section.
 */
import { useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AnchorProvider } from '../../engine/anchors.tsx';
import { useAnchors } from '../../engine/anchorContext.ts';
import { pulsedCellIds, retargetedPointerIds } from '../../engine/trace/diff.ts';
import { pointersByTarget } from '../../engine/pointers.ts';
import type { ArrayCell, Step } from '../../engine/trace/types.ts';
import { ArrowOverlay } from './ArrowOverlay.tsx';
import { CellView } from './CellView.tsx';
import { HeapBlockView } from './HeapBlockView.tsx';
import { MemoryRenderContext, type MemoryRenderState } from './renderContext.ts';
import { StackFrame } from './StackFrame.tsx';

function RegionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
      {children}
    </h3>
  );
}

interface CanvasBodyProps {
  step: Step;
  heapLayout: 'row' | 'column';
}

function CanvasBody({ step, heapLayout }: CanvasBodyProps) {
  const { setCanvas, pulse } = useAnchors();

  // After each step change, re-measure across the spring animation so arrows track moving frames.
  useEffect(() => {
    pulse();
  }, [step.index, pulse]);

  const arrayCells: ArrayCell[] = step.stack
    .flatMap((f) => f.variables)
    .filter((v): v is ArrayCell => v.kind === 'array');

  const hasData = step.heap.length > 0 || arrayCells.length > 0;

  return (
    <div ref={setCanvas} className="relative flex min-h-full flex-wrap gap-x-10 gap-y-8 p-2">
      <section className="min-w-[16rem]">
        <RegionLabel>Stack</RegionLabel>
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {step.stack.map((frame, depth) => (
              <StackFrame key={frame.id} frame={frame} depth={depth} />
            ))}
          </AnimatePresence>
        </div>
      </section>

      {hasData ? (
        <section className="min-w-[16rem]">
          <RegionLabel>Heap &amp; data</RegionLabel>
          <div
            className={`flex gap-4 ${heapLayout === 'column' ? 'flex-col' : 'flex-row items-start'}`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {step.heap.map((block) => (
                <HeapBlockView key={block.id} block={block} />
              ))}
            </AnimatePresence>
            {arrayCells.map((arr) => (
              <CellView key={arr.id} cell={arr} />
            ))}
          </div>
        </section>
      ) : null}

      <ArrowOverlay step={step} />
    </div>
  );
}

export interface MemoryCanvasProps {
  step: Step;
  prevStep: Step | null;
  heapLayout?: 'row' | 'column' | undefined;
}

export function MemoryCanvas({ step, prevStep, heapLayout = 'row' }: MemoryCanvasProps) {
  const renderState = useMemo<MemoryRenderState>(
    () => ({
      pulsing: pulsedCellIds(prevStep, step),
      retargeted: retargetedPointerIds(prevStep, step),
      activeId: step.activeId,
      targetedBy: pointersByTarget(step),
      stepIndex: step.index,
    }),
    [prevStep, step],
  );

  return (
    <MemoryRenderContext.Provider value={renderState}>
      <AnchorProvider>
        <CanvasBody step={step} heapLayout={heapLayout} />
      </AnchorProvider>
    </MemoryRenderContext.Provider>
  );
}
