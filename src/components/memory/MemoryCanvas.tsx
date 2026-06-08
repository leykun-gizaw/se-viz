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

/**
 * A labelled memory region — a bounded "tray" so the stack and heap read as distinct areas rather
 * than just floating labels. The heap's header is tinted teal to match its blocks ("color = meaning"),
 * the stack's stays neutral; both are a subtle surface fill over the canvas so the cards still pop.
 */
function Region({
  label,
  tone = 'neutral',
  children,
}: {
  label: string;
  tone?: 'neutral' | 'heap';
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-[16rem] self-start rounded-xl border border-hairline bg-surface/25 p-3">
      <h3
        className={`mb-3 px-1 font-sans text-[11px] font-semibold uppercase tracking-wider ${
          tone === 'heap' ? 'text-heap' : 'text-ink-muted'
        }`}
      >
        {label}
      </h3>
      {children}
    </section>
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
    <div
      ref={setCanvas}
      className="relative flex min-h-full flex-wrap items-start gap-x-10 gap-y-8 p-2"
    >
      <Region label="Stack">
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {step.stack.map((frame, depth) => (
              <StackFrame key={frame.id} frame={frame} depth={depth} />
            ))}
          </AnimatePresence>
        </div>
      </Region>

      {/* The heap area is always shown — even empty — so the two memory regions stay legible. */}
      <Region label="Heap & data" tone="heap">
        {hasData ? (
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
        ) : (
          <div className="px-1 py-6 font-mono text-xs text-ink-faint">no allocations</div>
        )}
      </Region>

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
