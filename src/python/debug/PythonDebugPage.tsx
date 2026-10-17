/**
 * Dev-only Python spike page (Phase 29), reachable at `/?python-debug` only when
 * `import.meta.env.DEV` (see `main.tsx`; production builds drop it). A textarea, Run, the raw JSON,
 * and each candidate mapping rendered: A and C through the existing memory canvas, B through a
 * throwaway sketch of the renderer it would need.
 */
import { useEffect, useMemo, useState } from 'react';
import { MemoryCanvas } from '../../components/memory/MemoryCanvas.tsx';
import { PythonRunner, type RunOutcome } from '../client.ts';
import { adaptC, mapA, mapB } from '../mappings/candidates.ts';
import type { AllowedPackage } from '../protocol.ts';
import { SAMPLES } from '../samples/index.ts';
import { PYODIDE_VERSION } from '../version.ts';
import * as measure from './measure.ts';
import { PythonSketch } from './PythonSketch.tsx';

declare global {
  interface Window {
    __pythonSpike?: typeof measure & { run: PythonRunner['run'] };
  }
}

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-hairline bg-surface">
      <h3 className="border-b border-hairline px-3 py-1.5 font-sans text-xs font-semibold text-ink-muted">
        {title}
      </h3>
      <div className="min-h-0 overflow-auto">{children}</div>
    </section>
  );
}

export function PythonDebugPage() {
  const runner = useMemo(() => new PythonRunner(), []);
  const [source, setSource] = useState(SAMPLES[0].request.source);
  const [stdin, setStdin] = useState('');
  const [packages, setPackages] = useState<AllowedPackage[]>([]);
  const [maxSteps, setMaxSteps] = useState(1000);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [ranSource, setRanSource] = useState('');
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    window.__pythonSpike = { ...measure, run: (r) => runner.run(r) };
    return () => runner.dispose();
  }, [runner]);

  const traces = useMemo(() => {
    if (!outcome) return null;
    return { a: mapA(outcome.result, ranSource), b: mapB(outcome.result, ranSource) };
  }, [outcome, ranSource]);
  const total = traces?.a.steps.length ?? 0;
  const i = Math.min(index, Math.max(total - 1, 0));

  async function run() {
    setRunning(true);
    const lines = stdin === '' ? [] : stdin.split('\n');
    const o = await runner.run({ source, stdin: lines, packages, limits: { maxSteps } });
    setRanSource(source);
    setOutcome(o);
    setIndex(0);
    setRunning(false);
  }

  const stepA = traces?.a.steps[i];
  const stepB = traces?.b.steps[i];
  const prevB = i > 0 ? traces?.b.steps[i - 1] : undefined;

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto bg-bg p-4 text-ink">
      <header className="flex items-baseline gap-3">
        <h1 className="font-sans text-base font-semibold">Python tracer spike</h1>
        <span className="font-mono text-xs text-ink-faint">
          dev only · Pyodide {PYODIDE_VERSION} · window.__pythonSpike
        </span>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-80 flex-1 flex-col gap-2">
          <select
            aria-label="Sample"
            className="rounded border border-hairline bg-surface-2 px-2 py-1 font-sans text-sm"
            onChange={(e) => {
              const s = SAMPLES.find((x) => x.name === e.target.value);
              if (s) {
                setSource(s.request.source);
                setStdin((s.request.stdin ?? []).join('\n'));
              }
            }}
          >
            {SAMPLES.map((s) => (
              <option key={s.name} value={s.name}>
                {s.title}
              </option>
            ))}
          </select>
          <textarea
            aria-label="Python source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            rows={10}
            className="rounded border border-hairline bg-surface-2 p-2 font-mono text-sm"
          />
          <textarea
            aria-label="stdin lines"
            placeholder="stdin, one line per input()"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={2}
            className="rounded border border-hairline bg-surface-2 p-2 font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-3 font-sans text-xs">
            {(['numpy', 'pandas'] as const).map((p) => (
              <label key={p} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={packages.includes(p)}
                  onChange={(e) =>
                    setPackages((cur) =>
                      e.target.checked ? [...cur, p] : cur.filter((x) => x !== p),
                    )
                  }
                />
                {p}
              </label>
            ))}
            <label className="flex items-center gap-1">
              max steps
              <input
                type="number"
                value={maxSteps}
                onChange={(e) => setMaxSteps(Number(e.target.value))}
                className="w-20 rounded border border-hairline bg-surface-2 px-1"
              />
            </label>
            <button
              type="button"
              onClick={() => void run()}
              disabled={running}
              className="rounded-md bg-active px-3 py-1 font-semibold text-black disabled:opacity-50"
            >
              {running ? 'Running…' : 'Run'}
            </button>
          </div>
          {outcome ? (
            <p data-testid="py-status" className="font-mono text-xs text-ink-muted">
              {outcome.result.steps.length} snapshots → {total} steps
              {outcome.result.truncated ? ` · truncated: ${outcome.result.truncated}` : ''}
              {outcome.result.error
                ? ` · ${outcome.result.error.type}: ${outcome.result.error.message}`
                : ''}
              {` · ${outcome.coldStart ? 'cold' : 'warm'}`}
              {outcome.timings.bootMs !== null
                ? ` · load ${Math.round(outcome.timings.bootMs)} ms`
                : ''}
              {` · packages ${Math.round(outcome.timings.packagesMs ?? 0)} ms · record ${Math.round(outcome.timings.runMs ?? 0)} ms · total ${Math.round(outcome.timings.totalMs)} ms`}
            </p>
          ) : null}
          {outcome ? (
            <pre className="whitespace-pre-wrap font-mono text-xs text-ink-muted">
              {outcome.result.stdout}
            </pre>
          ) : null}
        </div>

        <details className="min-w-80 flex-1 rounded border border-hairline bg-surface p-2">
          <summary className="cursor-pointer font-sans text-xs text-ink-muted">Raw JSON</summary>
          <pre data-testid="py-json" className="max-h-96 overflow-auto font-mono text-[11px]">
            {outcome ? JSON.stringify(outcome.result, null, 1) : ''}
          </pre>
        </details>
      </div>

      {traces && stepA && stepB ? (
        <>
          <div className="flex items-center gap-3 font-mono text-xs">
            <input
              type="range"
              aria-label="Step"
              min={0}
              max={total - 1}
              value={i}
              onChange={(e) => setIndex(Number(e.target.value))}
              className="flex-1"
            />
            <span>
              step {i + 1}/{total} · line {stepA.highlightedLines.join(', ')} · {stepA.narration}
            </span>
          </div>
          <div className="flex min-h-[28rem] gap-3">
            <Pane title="A · reuse the C model (memory canvas)">
              <MemoryCanvas
                step={stepA}
                prevStep={i > 0 ? (traces.a.steps[i - 1] ?? null) : null}
              />
            </Pane>
            <Pane title="B · separate payload (sketch renderer)">
              <PythonSketch step={stepB} />
            </Pane>
            <Pane title="C · B's payload adapted at render time (memory canvas)">
              <MemoryCanvas step={adaptC(stepB)} prevStep={prevB ? adaptC(prevB) : null} />
            </Pane>
          </div>
        </>
      ) : null}
    </div>
  );
}
