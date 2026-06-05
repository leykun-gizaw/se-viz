/**
 * SE-Viz Phase 0 vertical slice. Three synchronized panels (code / memory / narration) plus
 * minimal step controls, driven by the {@link useTrace} player over the hand-authored
 * {@link addTrace}. This is the proof that the traces-first architecture renders end to end.
 */
import { CodePanel } from './components/CodePanel.tsx';
import { Controls } from './components/Controls.tsx';
import { MemoryCanvas } from './components/MemoryCanvas.tsx';
import { addTrace } from './content/phase0/addTrace.ts';
import { useTrace } from './engine/trace/useTrace.ts';

export default function App() {
  const player = useTrace(addTrace);
  const { step } = player;

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-bold">
          SE-Viz <span className="font-normal text-slate-400">— {addTrace.title}</span>
        </h1>
        <p className="text-xs text-slate-500">Phase 0 vertical slice · traces-first</p>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-6 lg:grid-cols-2">
        <section className="flex flex-col">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Code
          </h2>
          <div className="min-h-0 flex-1">
            <CodePanel trace={player.trace} step={step} />
          </div>
        </section>

        <section className="flex flex-col">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Memory
          </h2>
          <div className="min-h-0 flex-1 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <MemoryCanvas step={step} />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 px-6 py-4">
        <div
          aria-live="polite"
          className="mb-4 min-h-[3rem] rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
        >
          <span className="mr-2 font-mono text-xs uppercase tracking-wide text-sky-400">
            Narration
          </span>
          {step.narration}
        </div>
        <Controls
          index={player.index}
          total={player.total}
          canPrev={player.canPrev}
          canNext={player.canNext}
          onPrev={player.prev}
          onNext={player.next}
          onReset={player.reset}
        />
      </footer>
    </div>
  );
}
