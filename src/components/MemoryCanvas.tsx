/**
 * The memory panel. Phase 0 draws the stack region (frames as boxes of cells); the heap region is
 * shown as an empty placeholder so the layout is honest about what exists.
 *
 * Frames are rendered top-of-stack first (most recent call on top). `AnimatePresence` gives the
 * push-on-call / pop-on-return animation as frames enter and leave between steps.
 */
import { AnimatePresence } from 'framer-motion';
import type { Step } from '../engine/trace/types.ts';
import { StackFrame } from './StackFrame.tsx';

export interface MemoryCanvasProps {
  step: Step;
}

export function MemoryCanvas({ step }: MemoryCanvasProps) {
  // Render top of stack first (visually on top): reverse a copy of the bottom-first array.
  const framesTopFirst = [...step.stack].reverse();
  const topId = step.stack.length > 0 ? step.stack[step.stack.length - 1].id : null;

  return (
    <div className="flex h-full flex-col gap-4">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Stack
        </h2>
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {framesTopFirst.map((frame) => (
              <StackFrame key={frame.id} frame={frame} isTop={frame.id === topId} />
            ))}
          </AnimatePresence>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Heap</h2>
        <div className="rounded-lg border border-dashed border-slate-700 p-4">
          {step.heap.length === 0 ? (
            <p className="font-mono text-xs text-slate-600">
              (empty — no allocations in this example)
            </p>
          ) : (
            <p className="font-mono text-xs text-slate-400">{step.heap.length} block(s)</p>
          )}
        </div>
      </section>
    </div>
  );
}
