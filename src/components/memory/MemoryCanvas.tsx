/**
 * The memory panel: the generic renderer that draws an entire {@link Step} as a **canonical C
 * memory map** — stack frames (top, high addresses, growing down), the heap (middle, growing up),
 * and the static / data segment (bottom: `.data` / `.bss` / `.rodata`, nearest the code/text panel
 * on the left). The SVG arrow overlay sits on top. Animations (frame push/pop springs, value
 * pulses, pointer-arrow glides) are all derived from the diff between `prevStep` and `step`, so
 * stepping back reverses them.
 *
 * Layout note (Phase 24): the regions are stacked vertically to echo the textbook memory map so
 * relative position teaches the real layout. The code editor IS the text/code segment — there is no
 * separate "text" box. A *local* array renders inside its owning frame (stack-toned); the heap
 * region holds heap blocks only; globals/statics live in the static region, never folded into a
 * frame. A step without `staticData` draws no static region and renders exactly as before.
 */
import { useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AnchorProvider } from '../../engine/anchors.tsx';
import { useAnchors } from '../../engine/anchorContext.ts';
import { pulsedCellIds, retargetedPointerIds } from '../../engine/trace/diff.ts';
import { pointersByTarget } from '../../engine/pointers.ts';
import type { Step } from '../../engine/trace/types.ts';
import { ArrowOverlay } from './ArrowOverlay.tsx';
import { CellView } from './CellView.tsx';
import { HeapBlockView } from './HeapBlockView.tsx';
import { MemoryRenderContext, type MemoryRenderState } from './renderContext.ts';
import { StackFrame } from './StackFrame.tsx';
import { showStaticRegion, visibleStaticTrays, type StaticTray } from './staticRegion.ts';

/**
 * A labelled memory region — a bounded "tray" so the stack, heap, and static segments read as
 * distinct areas. The header is tinted to match each region's semantic color ("color = meaning"):
 * teal for the heap, violet for the static segment, neutral for the stack. An optional `hint`
 * captions the region with how it grows / what it is.
 */
function Region({
  label,
  tone = 'neutral',
  hint,
  children,
}: {
  label: string;
  tone?: 'neutral' | 'heap' | 'static';
  hint?: string;
  children: React.ReactNode;
}) {
  const labelTone =
    tone === 'heap' ? 'text-heap' : tone === 'static' ? 'text-static' : 'text-ink-muted';
  return (
    <section className="w-full rounded-xl border border-hairline bg-surface/25 p-3">
      <h3 className="mb-3 flex items-baseline gap-2 px-1">
        <span className={`font-sans text-[11px] font-semibold uppercase tracking-wider ${labelTone}`}>
          {label}
        </span>
        {hint ? <span className="font-mono text-[10px] text-ink-faint">{hint}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/** One static sub-tray (`.data` / `.bss` / `.rodata`): a violet-headed box of its cells. */
function SubTray({ tray }: { tray: StaticTray }) {
  return (
    <div className="min-w-48 flex-1 rounded-lg border border-hairline bg-surface/40">
      <div className="flex items-baseline gap-2 rounded-t-lg border-b border-hairline bg-static-soft px-2.5 py-1.5">
        <span className="font-mono text-[11px] font-semibold text-static">{tray.label}</span>
        <span className="font-sans text-[10px] text-ink-faint">{tray.gloss}</span>
      </div>
      <div className="flex flex-col gap-1.5 p-2">
        {tray.cells.length === 0 ? (
          <span className="px-1 py-1 font-mono text-[11px] text-ink-faint">empty</span>
        ) : (
          tray.cells.map((cell) => <CellView key={cell.id} cell={cell} />)
        )}
      </div>
    </div>
  );
}

interface CanvasBodyProps {
  step: Step;
  heapLayout: 'row' | 'column';
  staticLayout: 'auto' | 'full';
}

function CanvasBody({ step, heapLayout, staticLayout }: CanvasBodyProps) {
  const { setCanvas, pulse } = useAnchors();

  // After each step change, re-measure across the spring animation so arrows track moving frames.
  useEffect(() => {
    pulse();
  }, [step.index, pulse]);

  const hasHeap = step.heap.length > 0;
  const seg = step.staticData;
  const showAllTrays = staticLayout === 'full';
  // `seg &&` narrows away `undefined`, so the guard + `visibleStaticTrays` see a StaticSegment.
  const trays = seg && showStaticRegion(seg, showAllTrays) ? visibleStaticTrays(seg, showAllTrays) : [];
  const staticVisible = trays.length > 0;

  return (
    <div ref={setCanvas} className="relative flex min-h-full flex-col gap-6 p-2">
      {/* Stack: high addresses at top, newest frame on top, growing downward. */}
      <Region label="Stack" hint="locals & frames · grows ↓">
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {step.stack.map((frame, depth) => (
              <StackFrame key={frame.id} frame={frame} depth={depth} />
            ))}
          </AnimatePresence>
          {step.stack.length === 0 ? (
            <span className="px-1 py-2 font-mono text-xs text-ink-faint">no active frames</span>
          ) : null}
        </div>
      </Region>

      {/* The heap region is always shown — even empty — so the memory map stays legible. */}
      <Region label="Heap" tone="heap" hint="malloc / free · grows ↑">
        {hasHeap ? (
          <div
            className={`flex gap-4 ${heapLayout === 'column' ? 'flex-col' : 'flex-row flex-wrap items-start'}`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {step.heap.map((block) => (
                <HeapBlockView key={block.id} block={block} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="px-1 py-6 font-mono text-xs text-ink-faint">no allocations</div>
        )}
      </Region>

      {/* Static / data segment: globals & statics, nearest the code (text) segment. */}
      {staticVisible ? (
        <Region label="Static" tone="static" hint=".data · .bss · .rodata — lifetime = whole program">
          <div className="flex flex-row flex-wrap items-start gap-3">
            {trays.map((tray) => (
              <SubTray key={tray.key} tray={tray} />
            ))}
          </div>
        </Region>
      ) : null}

      <ArrowOverlay step={step} />
    </div>
  );
}

export interface MemoryCanvasProps {
  step: Step;
  prevStep: Step | null;
  heapLayout?: 'row' | 'column' | undefined;
  /** Static-region hint: `'full'` shows all three sub-trays even when empty. See `Trace.staticLayout`. */
  staticLayout?: 'auto' | 'full' | undefined;
}

export function MemoryCanvas({
  step,
  prevStep,
  heapLayout = 'row',
  staticLayout = 'auto',
}: MemoryCanvasProps) {
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
        <CanvasBody step={step} heapLayout={heapLayout} staticLayout={staticLayout} />
      </AnchorProvider>
    </MemoryRenderContext.Provider>
  );
}
