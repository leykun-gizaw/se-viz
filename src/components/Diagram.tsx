/**
 * In-house declarative diagrams for the theory deck (Phase 22) — rendered to **SVG with the design
 * tokens**, never raw HTML, so they look native to the memory view and scale cleanly on the 16:9
 * slide. Two types so far, dispatched by `diagram.kind` (extend with a new case):
 *
 * - `call-stack` — a vertical stack of frame boxes (newest at the bottom, like the memory view),
 *   each with a label + optional fields and an optional `active` highlight (amber, the "current
 *   frame" token), plus an optional caption.
 * - `call-tree` — a node/edge tree of calls, laid out with the **headless** `d3-hierarchy` (it only
 *   returns coordinates; we draw the SVG). Nodes flagged `repeat` are highlighted (amber) to show a
 *   recomputed subproblem (e.g. `fib(2)` twice).
 */
import { hierarchy, tree } from 'd3-hierarchy';
import type { CallStackFrame, CallTreeNode, Diagram } from '../engine/markdown.ts';

const MONO = 'font-mono';

function CallStackDiagram({
  frames,
  caption,
}: {
  frames: CallStackFrame[];
  caption: string | null;
}) {
  const PAD_X = 16;
  const LABEL_F = 18;
  const LABEL_LH = 26;
  const FIELD_F = 15;
  const FIELD_LH = 21;
  const TOP = 10;
  const BOT = 12;
  const GAP = 12;
  const M = 4;
  const CAP_GAP = caption ? 26 : 0;

  const lines = frames.flatMap((f) => [f.label, ...f.fields]);
  const maxLen = Math.max(12, ...lines.map((s) => s.length));
  const FW = Math.min(700, Math.max(220, maxLen * 9 + 40));

  const heights = frames.map((f) => TOP + LABEL_LH + f.fields.length * FIELD_LH + BOT);
  // Cumulative y of each frame's top (computed up front so render stays mutation-free).
  const tops: number[] = [];
  let acc = M;
  for (const h of heights) {
    tops.push(acc);
    acc += h + GAP;
  }
  const capW = caption ? caption.length * 7.2 + 24 : 0;
  const vbW = Math.max(FW + 2 * M, capW);
  const frameX = (vbW - FW) / 2;
  const stackH = heights.reduce((a, b) => a + b, 0) + GAP * Math.max(0, frames.length - 1);
  const vbH = stackH + 2 * M + CAP_GAP;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="mx-auto my-5 block h-auto w-full"
      style={{ maxWidth: vbW }}
      role="img"
      aria-label={`Call stack: ${frames.map((f) => f.label).join(', ')}`}
    >
      {frames.map((f, i) => {
        const h = heights[i];
        return (
          <g key={i} transform={`translate(${frameX}, ${tops[i]})`}>
            <rect
              width={FW}
              height={h}
              rx={10}
              fill={f.active ? 'var(--se-active-soft)' : 'var(--se-surface)'}
              stroke={f.active ? 'var(--se-active)' : 'var(--se-border)'}
              strokeWidth={f.active ? 2 : 1.5}
            />
            <text
              x={PAD_X}
              y={TOP + LABEL_F}
              className={MONO}
              fontSize={LABEL_F}
              fontWeight={700}
              fill="var(--se-text)"
            >
              {f.label}
            </text>
            {f.active ? (
              <text
                x={FW - PAD_X}
                y={TOP + LABEL_F}
                textAnchor="end"
                className={MONO}
                fontSize={11}
                fontWeight={700}
                fill="var(--se-active)"
              >
                ACTIVE
              </text>
            ) : null}
            {f.fields.map((field, fi) => (
              <text
                key={fi}
                x={PAD_X}
                y={TOP + LABEL_LH + fi * FIELD_LH + FIELD_F}
                className={MONO}
                fontSize={FIELD_F}
                fill="var(--se-text-muted)"
              >
                {field}
              </text>
            ))}
          </g>
        );
      })}
      {caption ? (
        <text
          x={vbW / 2}
          y={vbH - M - 6}
          textAnchor="middle"
          fontSize={15}
          fontStyle="italic"
          fill="var(--se-text-faint)"
        >
          {caption}
        </text>
      ) : null}
    </svg>
  );
}

function CallTreeDiagram({ root, caption }: { root: CallTreeNode | null; caption: string | null }) {
  if (!root) return null;

  const NODE_W = 80;
  const NODE_H = 32;
  const GAP_X = 18;
  const GAP_Y = 34;
  const M = 8;
  const CAP_GAP = caption ? 26 : 0;

  const laidOut = tree<CallTreeNode>().nodeSize([NODE_W + GAP_X, NODE_H + GAP_Y])(hierarchy(root));
  const nodes = laidOut.descendants();
  const links = laidOut.links();

  const xs = nodes.map((n) => n.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...nodes.map((n) => n.y));

  const baseW = maxX - minX + NODE_W + 2 * M;
  const capW = caption ? caption.length * 7.2 + 24 : 0;
  const vbW = Math.max(baseW, capW);
  // Centre the tree within the (possibly caption-widened) viewBox.
  const ox = M + (vbW - baseW) / 2 - minX + NODE_W / 2;
  const vbH = maxY + NODE_H + 2 * M + CAP_GAP;

  const cx = (n: { x: number }) => n.x + ox;
  const top = (n: { y: number }) => n.y + M;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="mx-auto my-5 block h-auto w-full"
      style={{ maxWidth: Math.min(vbW, 860) }}
      role="img"
      aria-label="Call tree"
    >
      {links.map((l, i) => (
        <line
          key={`e${i}`}
          x1={cx(l.source)}
          y1={top(l.source) + NODE_H}
          x2={cx(l.target)}
          y2={top(l.target)}
          stroke="var(--se-pointer)"
          strokeWidth={1.5}
        />
      ))}
      {nodes.map((n, i) => (
        <g key={`n${i}`} transform={`translate(${cx(n) - NODE_W / 2}, ${top(n)})`}>
          <rect
            width={NODE_W}
            height={NODE_H}
            rx={8}
            fill={n.data.repeat ? 'var(--se-active-soft)' : 'var(--se-surface)'}
            stroke={n.data.repeat ? 'var(--se-active)' : 'var(--se-border)'}
            strokeWidth={n.data.repeat ? 2 : 1.5}
          />
          <text
            x={NODE_W / 2}
            y={NODE_H / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className={MONO}
            fontSize={14}
            fill="var(--se-text)"
          >
            {n.data.label}
          </text>
        </g>
      ))}
      {caption ? (
        <text
          x={vbW / 2}
          y={vbH - M - 4}
          textAnchor="middle"
          fontSize={15}
          fontStyle="italic"
          fill="var(--se-text-faint)"
        >
          {caption}
        </text>
      ) : null}
    </svg>
  );
}

/** Render a parsed {@link Diagram} to SVG. Dispatches on `kind`; add a case to extend. */
export function DiagramView({ diagram }: { diagram: Diagram }) {
  switch (diagram.kind) {
    case 'call-stack':
      return <CallStackDiagram frames={diagram.frames} caption={diagram.caption} />;
    case 'call-tree':
      return <CallTreeDiagram root={diagram.root} caption={diagram.caption} />;
  }
}
