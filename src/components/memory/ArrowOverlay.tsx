/**
 * The pointer-arrow overlay — an SVG layered over the memory DOM that draws every connector from a
 * pointer cell to whatever its `target` id resolves to, using the anchor rects published by the
 * registry. This is the engine's hardest part; later phases lean on it.
 *
 * Routing is **orthogonal** (box-and-pointer textbook style): every connector is a 3-segment
 * polyline of axis-aligned segments — no curves — so it reads as straight lines that don't tangle.
 *
 * Behaviour:
 * - Arrows from pointer cells to their target cell/block (resolved by stable id). Each pointer
 *   gets its own hue from the `--se-arrow-*` palette (stable across steps, distinct within a
 *   step — see `arrowColorSlots`), so parallel links (a list's several `next`s) stay traceable.
 *   - **In-row neighbours** (a node's `next`/`prev` to the node beside it) become a straight
 *     horizontal line entering at the source cell's own height; because `next` cells sit lower than
 *     `prev` cells, forward and backward arrows land on separate levels and never overlap.
 *   - **Cross-region pointers** (a stack pointer down to a heap node) exit sideways, drop down a
 *     clear vertical channel — nested per pointer so several to the same node don't stack — then run
 *     straight into the node's edge.
 * - `NULL` targets render as a short straight stub to a `NULL` sink badge (no dangling arrow).
 * - Dangling/freed targets recolor the arrow to the danger hue, dashed (UB).
 * - {@link Annotation}s (pointer arithmetic) draw a labeled square "staple" between two ids.
 * - Every arrow path keeps the same 4-point shape, so a retarget animates its `d` (~250ms) and the
 *   arrowhead glides old → new target. The registry's resize/pulse re-measurement keeps arrows
 *   attached through window resizes and frame push/pop springs.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAnchors, type Anchor } from '../../engine/anchorContext.ts';
import { ARROW_PALETTE_SIZE, arrowColorSlots, resolvePointers } from '../../engine/pointers.ts';
import type { Step } from '../../engine/trace/types.ts';
import { useMemoryRender } from './renderContext.ts';

/** Gap between a box edge and the vertical channel a cross-region arrow drops down. */
const CHANNEL_GAP = 14;
/** Lateral offset between sibling channels so several arrows to one node don't share a line. */
const CHANNEL_STEP = 11;
/** Keep edge entries off the very corner of a box. */
const EDGE_INSET = 9;

function center(a: Anchor) {
  return { cx: a.x + a.width / 2, cy: a.y + a.height / 2 };
}

/** Whether two boxes share vertical extent — i.e. they sit in the same row (side by side). */
function sameRow(a: Anchor, b: Anchor): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

export function ArrowOverlay({ step }: { step: Step }) {
  const { getAnchor, version } = useAnchors();
  const { retargeted } = useMemoryRender();

  // Overlay width — used to pick the side with more room for a channel and to keep channels in view.
  const rootRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setCanvasW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recompute geometry whenever the anchor version changes (mount, resize, step, spring pulse).
  const geometry = useMemo(() => {
    void version; // dependency: re-measure on every version bump
    const arrows: {
      id: string;
      d: string;
      danger: boolean;
      glide: boolean;
      /** Palette slot (`--se-arrow-N`); ignored for danger arrows (always red). */
      slot: number;
    }[] = [];
    const nulls: { id: string; d: string; badge: { x: number; y: number } }[] = [];
    const arcs: { id: string; d: string; label: { x: number; y: number }; text: string }[] = [];

    // Pass 1: resolve each pointer and classify it.
    //  - `row`  : source and target sit in the same row → a straight horizontal connector entering
    //             the facing edge (forward `next` and backward `prev` naturally land on separate
    //             rows of the node, so they don't overlap).
    //  - `rail` : source and target are in different bands (a stack pointer down to a heap node) →
    //             exit sideways out of the source column, run along a clear "rail" in the empty band
    //             beside the target row, then drop straight onto the target's top/bottom edge. This
    //             never cuts through sibling nodes, whichever node is the target.
    interface Resolved {
      id: string;
      from: Anchor;
      to: Anchor;
      target: string;
      kind: 'row' | 'rail';
      exitRight: boolean; // leaves the source on its right side
      below: boolean; // target is below the source (rail drops downward)
      danger: boolean;
      glide: boolean;
      // filled in pass 2:
      ey: number; // row: entry y on the facing edge
      entryX: number; // rail: x where it drops onto the target edge
      bandY: number; // rail: y of the horizontal rail beside the target row
      lane: number; // rail: global lane index → its own drop column + band (kept isolated)
    }
    const resolved: Resolved[] = [];
    for (const p of resolvePointers(step)) {
      const from = getAnchor(p.id);
      if (!from) continue;
      if (p.targetKind === 'null') {
        const sx = from.x + from.width;
        const sy = from.y + from.height / 2;
        const ex = sx + 34;
        nulls.push({ id: p.id, d: `M ${sx} ${sy} L ${ex} ${sy}`, badge: { x: ex + 3, y: sy } });
        continue;
      }
      if (p.target === null) continue;
      const to = getAnchor(p.target);
      if (!to) continue;

      const row = sameRow(from, to);
      const exitRight = row
        ? center(to).cx >= center(from).cx // in a row: exit toward the neighbour
        : canvasW > 0
          ? canvasW - (from.x + from.width) >= from.x // rail: leave by the roomier side of the source
          : true;
      resolved.push({
        id: p.id,
        from,
        to,
        target: p.target,
        kind: row ? 'row' : 'rail',
        exitRight,
        below: center(to).cy >= center(from).cy,
        danger: p.danger,
        glide: retargeted.has(p.id),
        ey: 0,
        entryX: 0,
        bandY: 0,
        lane: 0,
      });
    }

    // Pass 2a: where several arrows enter the SAME target, fan their entry points across that edge so
    // they don't stack. A lone in-row arrow enters at its source's own height (perfectly straight).
    const groupKey = (r: Resolved) =>
      r.kind === 'row' ? `${r.target}|${r.exitRight ? 'L' : 'R'}` : `${r.target}|rail`;
    const groups = new Map<string, Resolved[]>();
    for (const r of resolved) {
      const key = groupKey(r);
      const g = groups.get(key);
      if (g) g.push(r);
      else groups.set(key, [r]);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => center(a.from).cy - center(b.from).cy);
      const n = group.length;
      group.forEach((r, i) => {
        if (r.kind === 'row') {
          r.ey =
            n === 1
              ? clamp(center(r.from).cy, r.to.y + EDGE_INSET, r.to.y + r.to.height - EDGE_INSET)
              : r.to.y + r.to.height * ((i + 1) / (n + 1));
        } else {
          r.entryX = r.to.x + r.to.width * ((i + 1) / (n + 1));
        }
      });
    }

    // Pass 2b: give every rail its OWN lane — a unique drop column and a unique band height — across
    // ALL rails (not just those sharing a target). This guarantees no two rails ever share a segment:
    // they each leave at their source's height, drop down a column nobody else uses, run along a band
    // at a height nobody else uses, and descend onto a distinct entry point. So a rail can always be
    // traced end to end even when several leave the same stack column for different heap nodes.
    const rails = resolved.filter((r) => r.kind === 'rail');
    rails.sort(
      (a, b) => center(a.from).cy - center(b.from).cy || center(a.to).cx - center(b.to).cx,
    );
    rails.forEach((r, k) => {
      r.lane = k;
      r.bandY = r.below
        ? r.to.y - CHANNEL_GAP - k * CHANNEL_STEP
        : r.to.y + r.to.height + CHANNEL_GAP + k * CHANNEL_STEP;
    });

    // Per-pointer hue: stable across steps, distinct within the step (danger arrows stay red).
    const slots = arrowColorSlots(resolved.filter((r) => !r.danger).map((r) => r.id));

    for (const r of resolved) {
      const sy = center(r.from).cy;
      if (r.kind === 'row') {
        const sx = r.exitRight ? r.from.x + r.from.width : r.from.x;
        const ex = r.exitRight ? r.to.x : r.to.x + r.to.width; // facing edge
        const midX = (sx + ex) / 2;
        arrows.push({
          id: r.id,
          d: `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${r.ey} L ${ex} ${r.ey}`,
          danger: r.danger,
          glide: r.glide,
          slot: slots.get(r.id) ?? 0,
        });
      } else {
        // Rail: out of the source column, down/up the drop column, along the band, onto the edge.
        const sx = r.exitRight ? r.from.x + r.from.width : r.from.x;
        let dropX = r.exitRight
          ? r.from.x + r.from.width + CHANNEL_GAP + r.lane * CHANNEL_STEP
          : r.from.x - CHANNEL_GAP - r.lane * CHANNEL_STEP;
        if (canvasW > 0) dropX = clamp(dropX, 3, canvasW - 3);
        const ty = r.below ? r.to.y : r.to.y + r.to.height; // top edge if dropping down
        arrows.push({
          id: r.id,
          d: `M ${sx} ${sy} L ${dropX} ${sy} L ${dropX} ${r.bandY} L ${r.entryX} ${r.bandY} L ${r.entryX} ${ty}`,
          danger: r.danger,
          glide: r.glide,
          slot: slots.get(r.id) ?? 0,
        });
      }
    }

    // Pointer-arithmetic annotations: an orthogonal "staple" up over both ids, label at the top.
    for (const ann of step.annotations ?? []) {
      const from = getAnchor(ann.fromId);
      const to = getAnchor(ann.toId);
      if (!from || !to) continue;
      const fx = center(from).cx;
      const tx = center(to).cx;
      const apexY = Math.min(from.y, to.y) - 46;
      arcs.push({
        id: ann.id,
        d: `M ${fx} ${from.y} L ${fx} ${apexY} L ${tx} ${apexY} L ${tx} ${to.y}`,
        label: { x: (fx + tx) / 2, y: apexY },
        text: ann.label,
      });
    }

    return { arrows, nulls, arcs };
  }, [getAnchor, version, step, retargeted, canvasW]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-20">
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <marker
            id="se-arrow-azure"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--se-pointer)" />
          </marker>
          {/* One arrowhead per palette hue (SVG markers can't inherit the path's stroke color). */}
          {Array.from({ length: ARROW_PALETTE_SIZE }, (_, i) => (
            <marker
              key={i}
              id={`se-arrowhead-${i}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={`var(--se-arrow-${i})`} />
            </marker>
          ))}
          <marker
            id="se-arrow-danger"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--se-danger)" />
          </marker>
        </defs>

        {geometry.arrows.map((a) => (
          <motion.path
            key={a.id}
            initial={false}
            animate={{ d: a.d }}
            transition={{ duration: a.glide ? 0.25 : 0.18, ease: 'easeInOut' }}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            stroke={a.danger ? 'var(--se-danger)' : `var(--se-arrow-${a.slot})`}
            strokeDasharray={a.danger ? '5 4' : undefined}
            markerEnd={`url(#${a.danger ? 'se-arrow-danger' : `se-arrowhead-${a.slot}`})`}
          />
        ))}

        {geometry.nulls.map((n) => (
          <path
            key={n.id}
            d={n.d}
            fill="none"
            strokeWidth={2}
            stroke="var(--se-text-faint)"
            strokeDasharray="4 4"
          />
        ))}

        {geometry.arcs.map((arc) => (
          <path
            key={arc.id}
            d={arc.d}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            stroke="var(--se-pointer)"
            markerEnd="url(#se-arrow-azure)"
          />
        ))}
      </svg>

      {/* NULL sink badges (HTML for crisp text). */}
      {geometry.nulls.map((n) => (
        <span
          key={n.id}
          style={{ left: n.badge.x, top: n.badge.y }}
          className="absolute -translate-y-1/2 rounded-md border border-dashed border-hairline-strong bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-faint"
        >
          NULL
        </span>
      ))}

      {/* Pointer-arithmetic annotation chips. */}
      {geometry.arcs.map((arc) => (
        <span
          key={arc.id}
          style={{ left: arc.label.x, top: arc.label.y }}
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-pointer bg-pointer-soft px-2 py-1 font-mono text-[11px] text-pointer"
        >
          {arc.text}
        </span>
      ))}
    </div>
  );
}
