/**
 * Dev-only preview of the committed Python traces (Phase 30), at `/?python-preview&trace=<name>`
 * (see `main.tsx`; production builds drop it). Only the harvest loop is a catalog module; this page
 * plays every Phase 29 recording (aliasing, recursion, …) in the real stage and explanation panel,
 * from the plain JSON in `src/content/fixtures/python/`. It never loads Pyodide.
 *
 * Keys as in the app: ← / → step (one beat in two-beat mode), Home / End, Space, `b`.
 */
import { useMemo, useState } from 'react';
import { Stage } from '../../components/Stage.tsx';
import { ExplanationPanel } from '../../components/studio/ExplanationPanel.tsx';
import type { Trace } from '../../engine/trace/types.ts';
import { useTrace } from '../../engine/trace/useTrace.ts';
import { useKeyboardControls } from '../../hooks/useKeyboardControls.ts';

const TRACES = import.meta.glob<Trace>('../../content/fixtures/python/*.json', {
  eager: true,
  import: 'default',
});
const NAMES = Object.keys(TRACES).map((p) => p.replace(/^.*\/|\.json$/g, ''));
const traceOf = (name: string) => TRACES[`../../content/fixtures/python/${name}.json`];

function Player({ trace }: { trace: Trace }) {
  const player = useTrace(trace);
  const { prev, next, togglePlay, goTo, total, toggleMode } = player;
  const handlers = useMemo(
    () => ({
      onPrev: prev,
      onNext: next,
      onTogglePlay: togglePlay,
      onHome: () => goTo(0),
      onEnd: () => goTo(total - 1),
      onToggleStepMode: toggleMode,
    }),
    [prev, next, togglePlay, goTo, total, toggleMode],
  );
  useKeyboardControls(handlers);
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Stage player={player} />
      </div>
      <div className="w-[340px] shrink-0 border-l border-hairline">
        <ExplanationPanel player={player} />
      </div>
    </div>
  );
}

export function TracePreview() {
  const [name, setName] = useState(() => {
    const asked = new URLSearchParams(window.location.search).get('trace') ?? '';
    return NAMES.includes(asked) ? asked : 'aliasing';
  });
  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-2">
        <h1 className="font-sans text-sm font-semibold">Python trace preview</h1>
        <span className="font-mono text-[11px] text-ink-faint">
          dev only · recorded, no Pyodide
        </span>
        <select
          aria-label="Recorded trace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="ml-auto rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-xs text-ink"
        >
          {NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </header>
      <Player key={name} trace={traceOf(name)} />
    </div>
  );
}
