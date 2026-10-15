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
 * - `pipeline` (Phase 26) — a left→right staged build flow in the Build-pipeline view's language:
 *   artifacts are solid file cards (with a folded corner), processes are dashed pills; azure edges,
 *   amber for a `highlight` node and its outgoing edges, teal for the `accent` final product. Plain
 *   columnar layout — no layout library.
 * - `symbol-table` (Phase 26) — file boxes with `defines` / `needs` sections and resolve arrows from
 *   one box's need to another's definition; `unresolved` needs and `failed` edges use the danger token.
 */
import { hierarchy, tree } from 'd3-hierarchy';
import type {
  CallStackFrame,
  CallTreeNode,
  Diagram,
  PipelineDiagramEdge,
  PipelineDiagramNode,
  SymbolEdge,
  SymbolFile,
} from '../engine/markdown.ts';

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

/** Approximate rendered widths (px per char) — the same estimate-from-length approach as above. */
const MONO_CHAR = 9.6; // JetBrains Mono at 16px
const MONO_CHAR_15 = 9;
const CAPS_CHAR = 7.6; // 11px uppercase sans with tracking

/** A rightward or leftward arrowhead whose tip sits at (x, y). */
function arrowHead(x: number, y: number, dir: 1 | -1): string {
  return `${x},${y} ${x - dir * 9},${y - 5} ${x - dir * 9},${y + 5}`;
}

/** A horizontal-tangent cubic from (x1, y1) to (x2, y2) — gentle S-curves between columns. */
function sCurve(x1: number, y1: number, x2: number, y2: number, bow: number): string {
  return `M ${x1} ${y1} C ${x1 + bow} ${y1}, ${x2 - bow} ${y2}, ${x2} ${y2}`;
}

/** Group items into columns by a numeric key; returns the distinct keys in order, densely indexed. */
function columnIndex(keys: number[]): Map<number, number> {
  const distinct = [...new Set(keys)].sort((a, b) => a - b);
  return new Map(distinct.map((k, i) => [k, i]));
}

function Caption({ caption, x, y }: { caption: string; x: number; y: number }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={15}
      fontStyle="italic"
      fill="var(--se-text-faint)"
    >
      {caption}
    </text>
  );
}

interface PlacedNode {
  node: PipelineDiagramNode;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** File card with a folded top-right corner (an artifact), as a closed path at the origin. */
function filePath(w: number, h: number): string {
  const r = 7;
  const fold = 13;
  return [
    `M 0 ${r}`,
    `Q 0 0 ${r} 0`,
    `L ${w - fold} 0`,
    `L ${w} ${fold}`,
    `L ${w} ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `Q 0 ${h} 0 ${h - r}`,
    'Z',
  ].join(' ');
}

function PipelineDiagram({
  nodes,
  edges,
  caption,
}: {
  nodes: PipelineDiagramNode[];
  edges: PipelineDiagramEdge[];
  caption: string | null;
}) {
  const PAD_X = 16;
  const H_SUB = 58;
  const H_PLAIN = 42;
  const COL_GAP = 52;
  const ROW_GAP = 16;
  const M = 6;
  const CAP_GAP = caption ? 30 : 0;

  const widthOf = (n: PipelineDiagramNode) =>
    Math.max(
      96,
      n.label.length * MONO_CHAR + 2 * PAD_X + (n.kind === 'process' ? 12 : 8),
      n.sublabel ? n.sublabel.length * CAPS_CHAR + 2 * PAD_X : 0,
    );
  const heightOf = (n: PipelineDiagramNode) => (n.sublabel ? H_SUB : H_PLAIN);

  const colOf = columnIndex(nodes.map((n) => n.stage));
  const cols: PipelineDiagramNode[][] = Array.from({ length: colOf.size }, () => []);
  for (const n of nodes) cols[colOf.get(n.stage) ?? 0].push(n);

  const colW = cols.map((c) => Math.max(...c.map(widthOf)));
  const colH = cols.map(
    (c) => c.reduce((a, n) => a + heightOf(n), 0) + ROW_GAP * Math.max(0, c.length - 1),
  );
  const bodyH = Math.max(...colH);
  const bodyW = colW.reduce((a, b) => a + b, 0) + COL_GAP * Math.max(0, cols.length - 1);
  const capW = caption ? caption.length * 7.2 + 24 : 0;
  const vbW = Math.max(bodyW + 2 * M, capW);
  const vbH = bodyH + 2 * M + CAP_GAP;
  const left = (vbW - bodyW) / 2;

  const placed = new Map<string, PlacedNode>();
  cols.forEach((col, ci) => {
    const colX = left + colW.slice(0, ci).reduce((a, b) => a + b, 0) + COL_GAP * ci;
    let y = M + (bodyH - colH[ci]) / 2;
    for (const node of col) {
      const w = widthOf(node);
      const h = heightOf(node);
      placed.set(node.id, { node, col: ci, x: colX + (colW[ci] - w) / 2, y, w, h });
      y += h + ROW_GAP;
    }
  });

  const hot = (e: PipelineDiagramEdge) => placed.get(e.from)?.node.highlight === true;
  // Plain edges first, highlighted ones on top so the amber path never hides under azure.
  const ordered = [...edges.filter((e) => !hot(e)), ...edges.filter(hot)];
  // With a highlighted path, everything off it is dimmed (the Build-pipeline view's idle opacity),
  // so "only this re-runs; the rest is reused" reads from the picture, not just the caption.
  const anyHot = nodes.some((n) => n.highlight);
  const DIM = 0.45;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="mx-auto my-5 block h-auto w-full"
      style={{ maxWidth: vbW }}
      role="img"
      aria-label={`Build pipeline: ${nodes.map((n) => n.label).join(', ')}`}
    >
      {ordered.map((e, i) => {
        const a = placed.get(e.from);
        const b = placed.get(e.to);
        if (!a || !b) return null;
        const x1 = a.x + a.w;
        const y1 = a.y + a.h / 2;
        const x2 = b.x;
        const y2 = b.y + b.h / 2;
        const color = hot(e) ? 'var(--se-active)' : 'var(--se-pointer)';
        // An edge that skips columns runs level at its source row, then bends only in the last gap
        // before its target — so it passes over/under the intermediate columns' nodes, not through.
        const bendX = b.col > a.col + 1 ? x2 - COL_GAP : x1;
        const end = x2 - 8;
        const bow = Math.max(18, (x2 - bendX) / 2);
        const curve = `C ${bendX + bow} ${y1}, ${end - bow} ${y2}, ${end} ${y2}`;
        const d = bendX > x1 ? `M ${x1} ${y1} L ${bendX} ${y1} ${curve}` : `M ${x1} ${y1} ${curve}`;
        return (
          <g key={`e${i}`} opacity={anyHot && !hot(e) ? DIM : undefined}>
            <path d={d} fill="none" stroke={color} strokeWidth={hot(e) ? 2.5 : 1.75} />
            <polygon points={arrowHead(x2, y2, 1)} fill={color} />
          </g>
        );
      })}
      {[...placed.values()].map(({ node, x, y, w, h }) => {
        const isProcess = node.kind === 'process';
        const stroke = node.highlight
          ? 'var(--se-active)'
          : node.accent
            ? 'var(--se-heap)'
            : 'var(--se-border-strong)';
        const fill = node.highlight
          ? 'var(--se-active-soft)'
          : isProcess
            ? 'var(--se-surface)'
            : 'var(--se-surface-2)';
        const strokeWidth = node.highlight || node.accent ? 2 : 1.5;
        return (
          <g
            key={node.id}
            transform={`translate(${x}, ${y})`}
            opacity={anyHot && !node.highlight ? DIM : undefined}
          >
            {isProcess ? (
              <rect
                width={w}
                height={h}
                rx={h / 2}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray="5 4"
              />
            ) : (
              <>
                <path d={filePath(w, h)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
                <path
                  d={`M ${w - 13} 0 L ${w - 13} 13 L ${w} 13`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.25}
                />
              </>
            )}
            <text
              x={w / 2}
              y={node.sublabel ? h / 2 - 8 : h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              className={MONO}
              fontSize={16}
              fontWeight={600}
              fill={node.accent && !node.highlight ? 'var(--se-heap)' : 'var(--se-text)'}
            >
              {node.label}
            </text>
            {node.sublabel ? (
              <text
                x={w / 2}
                y={h / 2 + 13}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={600}
                letterSpacing={0.8}
                fill="var(--se-text-faint)"
              >
                {node.sublabel.toUpperCase()}
              </text>
            ) : null}
          </g>
        );
      })}
      {caption ? <Caption caption={caption} x={vbW / 2} y={vbH - M - 6} /> : null}
    </svg>
  );
}

interface PlacedFile {
  file: SymbolFile;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Vertical centre of each entry row, relative to the box top, keyed `defines:sym` / `needs:sym`. */
  rows: Map<string, number>;
}

function SymbolTableDiagram({
  files,
  edges,
  caption,
}: {
  files: SymbolFile[];
  edges: SymbolEdge[];
  caption: string | null;
}) {
  const PAD = 14;
  const HEAD_H = 38;
  const SEC_H = 22;
  const ROW_H = 26;
  const BOT = 10;
  const TAG_W = 96; // room for the UNRESOLVED tag
  const COL_GAP = 120;
  const STACK_GAP = 18;
  const M = 6;
  const CAP_GAP = caption ? 30 : 0;

  const layoutRows = (f: SymbolFile) => {
    const rows = new Map<string, number>();
    let y = HEAD_H;
    for (const [section, entries] of [
      ['defines', f.defines],
      ['needs', f.needs],
    ] as const) {
      if (entries.length === 0) continue;
      y += SEC_H;
      for (const e of entries) {
        rows.set(`${section}:${e.name}`, y + ROW_H / 2);
        y += ROW_H;
      }
    }
    return { rows, h: y + BOT };
  };
  const widthOf = (f: SymbolFile) =>
    Math.max(
      150,
      f.name.length * MONO_CHAR + 2 * PAD,
      ...[...f.defines, ...f.needs].map(
        (e) => e.name.length * MONO_CHAR_15 + 2 * PAD + (e.unresolved ? TAG_W : 0),
      ),
    );

  const colOf = columnIndex(files.map((f) => f.column));
  const cols: SymbolFile[][] = Array.from({ length: colOf.size }, () => []);
  for (const f of files) cols[colOf.get(f.column) ?? 0].push(f);

  const colW = cols.map((c) => Math.max(...c.map(widthOf)));
  const colH = cols.map(
    (c) => c.reduce((a, f) => a + layoutRows(f).h, 0) + STACK_GAP * Math.max(0, c.length - 1),
  );
  const bodyH = Math.max(...colH);
  const bodyW = colW.reduce((a, b) => a + b, 0) + COL_GAP * Math.max(0, cols.length - 1);
  const capW = caption ? caption.length * 7.2 + 24 : 0;
  const vbW = Math.max(bodyW + 2 * M, capW);
  const vbH = bodyH + 2 * M + CAP_GAP;
  const left = (vbW - bodyW) / 2;

  const placed = new Map<string, PlacedFile>();
  cols.forEach((col, ci) => {
    const colX = left + colW.slice(0, ci).reduce((a, b) => a + b, 0) + COL_GAP * ci;
    let y = M + (bodyH - colH[ci]) / 2;
    for (const file of col) {
      const { rows, h } = layoutRows(file);
      placed.set(file.name, { file, col: ci, x: colX, y, w: colW[ci], h, rows });
      y += h + STACK_GAP;
    }
  });

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="mx-auto my-5 block h-auto w-full"
      style={{ maxWidth: vbW }}
      role="img"
      aria-label={`Symbol tables: ${files.map((f) => f.name).join(', ')}`}
    >
      {[...placed.values()].map(({ file, x, y, w, h, rows }) => (
        <g key={file.name} transform={`translate(${x}, ${y})`}>
          <rect
            width={w}
            height={h}
            rx={10}
            fill="var(--se-surface-2)"
            stroke="var(--se-border-strong)"
            strokeWidth={1.5}
          />
          <text
            x={PAD}
            y={HEAD_H / 2 + 1}
            dominantBaseline="central"
            className={MONO}
            fontSize={16}
            fontWeight={700}
            fill="var(--se-text)"
          >
            {file.name}
          </text>
          <line x1={0} y1={HEAD_H - 2} x2={w} y2={HEAD_H - 2} stroke="var(--se-border)" />
          {(
            [
              ['defines', file.defines],
              ['needs', file.needs],
            ] as const
          ).map(([section, entries]) => {
            if (entries.length === 0) return null;
            const firstRow = rows.get(`${section}:${entries[0].name}`) ?? 0;
            return (
              <g key={section}>
                <text
                  x={PAD}
                  y={firstRow - ROW_H / 2 - SEC_H / 2 + 2}
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={700}
                  letterSpacing={0.8}
                  fill="var(--se-text-faint)"
                >
                  {section.toUpperCase()}
                </text>
                {entries.map((e) => {
                  const cy = rows.get(`${section}:${e.name}`) ?? 0;
                  return (
                    <g key={e.name}>
                      {e.unresolved ? (
                        <rect
                          x={PAD - 6}
                          y={cy - ROW_H / 2 + 2}
                          width={w - 2 * PAD + 12}
                          height={ROW_H - 4}
                          rx={5}
                          fill="var(--se-danger-soft)"
                        />
                      ) : null}
                      <text
                        x={PAD}
                        y={cy}
                        dominantBaseline="central"
                        className={MONO}
                        fontSize={15}
                        fill={e.unresolved ? 'var(--se-danger)' : 'var(--se-text)'}
                      >
                        {e.name}
                      </text>
                      {e.unresolved ? (
                        <text
                          x={w - PAD}
                          y={cy}
                          textAnchor="end"
                          dominantBaseline="central"
                          className={MONO}
                          fontSize={10}
                          fontWeight={700}
                          fill="var(--se-danger)"
                        >
                          UNRESOLVED
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      ))}
      {edges.map((e, i) => {
        const a = placed.get(e.from.file);
        const b = placed.get(e.to.file);
        if (!a || !b) return null;
        const y1 = a.y + (a.rows.get(`needs:${e.from.symbol}`) ?? 0);
        const y2 = b.y + (b.rows.get(`defines:${e.to.symbol}`) ?? 0);
        // Leave the source on the side facing the target; same-column edges loop out to the right.
        const dir: 1 | -1 = b.col < a.col ? -1 : 1;
        const x1 = dir === 1 ? a.x + a.w : a.x;
        const x2 = b.col === a.col ? b.x + b.w : dir === 1 ? b.x : b.x + b.w;
        const tipDir: 1 | -1 = b.col === a.col ? -1 : dir;
        const color = e.failed ? 'var(--se-danger)' : 'var(--se-pointer)';
        const bow = b.col === a.col ? 70 : (dir * Math.abs(x2 - x1)) / 2;
        const end = e.failed ? x2 : x2 - tipDir * 8; // failed edges have no arrowhead to make room for
        const d =
          b.col === a.col
            ? `M ${x1} ${y1} C ${x1 + bow} ${y1}, ${end + bow} ${y2}, ${end} ${y2}`
            : sCurve(x1, y1, end, y2, bow);
        // Midpoint of the cubic (t = 0.5) — where a failed edge gets its cross.
        const mx = b.col === a.col ? (x1 + end) / 2 + bow * 0.75 : (x1 + end) / 2;
        const my = (y1 + y2) / 2;
        return (
          <g key={`e${i}`}>
            <circle cx={x1} cy={y1} r={3.5} fill={color} />
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={e.failed ? 2 : 1.75}
              strokeDasharray={e.failed ? '6 5' : undefined}
            />
            {e.failed ? (
              <g>
                <circle
                  cx={mx}
                  cy={my}
                  r={11}
                  fill="var(--se-surface)"
                  stroke={color}
                  strokeWidth={2}
                />
                <path
                  d={`M ${mx - 4.5} ${my - 4.5} L ${mx + 4.5} ${my + 4.5} M ${mx + 4.5} ${my - 4.5} L ${mx - 4.5} ${my + 4.5}`}
                  stroke={color}
                  strokeWidth={2.25}
                  strokeLinecap="round"
                />
              </g>
            ) : (
              <polygon points={arrowHead(x2, y2, tipDir)} fill={color} />
            )}
          </g>
        );
      })}
      {caption ? <Caption caption={caption} x={vbW / 2} y={vbH - M - 6} /> : null}
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
    case 'pipeline':
      return (
        <PipelineDiagram nodes={diagram.nodes} edges={diagram.edges} caption={diagram.caption} />
      );
    case 'symbol-table':
      return (
        <SymbolTableDiagram files={diagram.files} edges={diagram.edges} caption={diagram.caption} />
      );
  }
}
