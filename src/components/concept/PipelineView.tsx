/**
 * Build-pipeline concept view (PDF screen 07): a left→right diagram of **artifact** cards (solid:
 * `.c`/`.o`/`.a`/binary) and **process** boxes (dashed: `cc`/`ar`/`ld`) joined by azure edges.
 * Data-driven from {@link Step.pipeline}: each step restates the nodes (with per-step `state`) and
 * edges; the active node gets the amber ring, the final artifact carries the heap accent. No
 * trace-format or token change — reuses the design's "process box = dashed neutral" treatment.
 */
import type { PipelineNode, Step } from '../../engine/trace/types.ts';

function NodeCard({ node, active }: { node: PipelineNode; active: boolean }) {
  const isProcess = node.kind === 'process';
  const state = node.state ?? 'idle';

  const base =
    'flex min-w-28 flex-col items-center rounded-lg px-4 py-3 text-center transition-colors';
  const border = isProcess ? 'border border-dashed border-hairline-strong' : 'border border-hairline-strong';
  const surface = isProcess ? 'bg-surface' : 'bg-surface-2';
  const accent = node.accent && !isProcess ? 'border-heap text-heap' : '';
  const idle = state === 'idle' ? 'opacity-45' : '';
  const activeRing = active || state === 'active' ? 'ring-2 ring-active bg-active-soft opacity-100' : '';

  return (
    <div className={`${base} ${border} ${surface} ${accent} ${idle} ${activeRing}`}>
      <span className="font-mono text-sm font-semibold text-ink">{node.label}</span>
      {node.sublabel ? (
        <span className="mt-0.5 font-sans text-[10px] uppercase tracking-wide text-ink-faint">
          {node.sublabel}
        </span>
      ) : null}
      {state === 'done' ? (
        <span className="mt-1 font-mono text-[10px] text-changed">done</span>
      ) : null}
    </div>
  );
}

export function PipelineView({ step }: { step: Step }) {
  const pipeline = step.pipeline;
  if (!pipeline) return null;

  // Render nodes in declared order; draw an azure connector where an edge joins adjacent nodes
  // (the build pipeline is linear left→right).
  const hasEdge = (from: string, to: string) =>
    pipeline.edges.some((e) => e.from === from && e.to === to);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto rounded-lg border border-hairline bg-bg p-6">
      <div className="flex flex-wrap items-center justify-center gap-y-6">
        {pipeline.nodes.map((node, i) => {
          const prev = pipeline.nodes[i - 1];
          const connector =
            prev && hasEdge(prev.id, node.id) ? (
              <span aria-hidden="true" className="mx-3 select-none font-mono text-lg text-pointer">
                →
              </span>
            ) : prev ? (
              <span className="mx-3" />
            ) : null;
          return (
            <div key={node.id} className="flex items-center">
              {connector}
              <NodeCard node={node} active={step.activeId === node.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
