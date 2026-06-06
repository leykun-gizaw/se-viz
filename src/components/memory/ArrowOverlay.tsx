/**
 * The pointer-arrow overlay — an SVG layered over the memory DOM that draws every connector from a
 * pointer cell to whatever its `target` id resolves to, using the anchor rects published by the
 * registry. This is the engine's hardest part; later phases lean on it.
 *
 * Behaviour:
 * - Azure cubic arrows from pointer cells to their target cell/block (resolved by stable id).
 * - `NULL` targets render as a short stub to a `NULL` sink badge (no dangling arrow).
 * - Dangling/freed targets recolor the arrow to the danger hue, dashed (UB).
 * - {@link Annotation}s (pointer arithmetic) draw a labeled arc between two ids.
 * - Paths animate their `d` (~250ms) so a retarget glides the arrowhead old → new target. The
 *   anchor registry's resize/pulse re-measurement keeps arrows attached through window resizes and
 *   frame push/pop springs.
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAnchors, type Anchor } from '../../engine/anchorContext.ts';
import { resolvePointers } from '../../engine/pointers.ts';
import type { Step } from '../../engine/trace/types.ts';
import { useMemoryRender } from './renderContext.ts';

function center(a: Anchor) {
  return { cx: a.x + a.width / 2, cy: a.y + a.height / 2 };
}

/** True when the arrow travels rightward (target right of source), so it exits the source's right
 *  side and enters the target's LEFT edge; false means it exits left and enters the target's right. */
function exitsRight(from: Anchor, to: Anchor): boolean {
  return center(to).cx >= center(from).cx;
}

/**
 * Cubic path from a pointer's facing side to an explicit entry point (`entryY`) on the target's
 * facing edge. The entry y is supplied by the caller so several arrows reaching the same node can
 * be fanned out across its edge instead of stacking on the midpoint.
 */
function arrowPath(from: Anchor, to: Anchor, entryY: number): string {
  const f = center(from);
  const exitRight = exitsRight(from, to);
  const sx = exitRight ? from.x + from.width : from.x;
  const sy = f.cy;
  const ex = exitRight ? to.x : to.x + to.width;
  const ey = entryY;
  const dx = Math.max(28, Math.abs(ex - sx) * 0.45);
  const c1x = exitRight ? sx + dx : sx - dx;
  const c2x = exitRight ? ex - dx : ex + dx;
  return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ey}, ${ex} ${ey}`;
}

/** Short stub from a pointer toward a NULL sink badge placed just to its lower-right. */
function nullPath(from: Anchor): { d: string; badge: { x: number; y: number } } {
  const sx = from.x + from.width;
  const sy = from.y + from.height / 2;
  const ex = sx + 46;
  const ey = sy + 26;
  return {
    d: `M ${sx} ${sy} C ${sx + 28} ${sy}, ${ex} ${ey - 18}, ${ex} ${ey}`,
    badge: { x: ex, y: ey },
  };
}

/** Upward arc between two element anchors, with a label anchor at its apex (pointer arithmetic). */
function arcPath(from: Anchor, to: Anchor): { d: string; label: { x: number; y: number } } {
  const fx = from.x + from.width / 2;
  const fy = from.y;
  const tx = to.x + to.width / 2;
  const ty = to.y;
  const apexY = Math.min(fy, ty) - 54;
  const midX = (fx + tx) / 2;
  return {
    d: `M ${fx} ${fy} Q ${midX} ${apexY}, ${tx} ${ty}`,
    label: { x: midX, y: apexY },
  };
}

export function ArrowOverlay({ step }: { step: Step }) {
  const { getAnchor, version } = useAnchors();
  const { retargeted } = useMemoryRender();

  // Recompute geometry whenever the anchor version changes (mount, resize, step, spring pulse).
  const geometry = useMemo(() => {
    void version; // dependency: re-measure on every version bump
    const arrows: {
      id: string;
      d: string;
      danger: boolean;
      glide: boolean;
    }[] = [];
    const nulls: { id: string; d: string; badge: { x: number; y: number } }[] = [];
    const arcs: { id: string; d: string; label: { x: number; y: number }; text: string }[] = [];

    // Pass 1: resolve each pointer to its source/target anchors and which edge it enters.
    interface Resolved {
      id: string;
      from: Anchor;
      to: Anchor;
      target: string;
      enterRight: boolean; // enters the target's right edge (arrow travels leftward)
      danger: boolean;
      glide: boolean;
    }
    const resolved: Resolved[] = [];
    for (const p of resolvePointers(step)) {
      const from = getAnchor(p.id);
      if (!from) continue;
      if (p.targetKind === 'null') {
        nulls.push({ id: p.id, ...nullPath(from) });
        continue;
      }
      if (p.target === null) continue;
      const to = getAnchor(p.target);
      if (!to) continue;
      resolved.push({
        id: p.id,
        from,
        to,
        target: p.target,
        enterRight: !exitsRight(from, to),
        danger: p.danger,
        glide: retargeted.has(p.id),
      });
    }

    // Pass 2: fan out arrows that reach the same target edge. Group by (target, edge), order each
    // group by its source's vertical position (topmost source → topmost slot, which minimizes
    // crossings), then space the entry points evenly across that edge instead of all hitting the
    // midpoint. A lone arrow keeps the centered entry it had before.
    const groups = new Map<string, Resolved[]>();
    for (const r of resolved) {
      const key = `${r.target}|${r.enterRight ? 'R' : 'L'}`;
      const g = groups.get(key);
      if (g) g.push(r);
      else groups.set(key, [r]);
    }
    const entryY = new Map<string, number>();
    for (const group of groups.values()) {
      group.sort((a, b) => center(a.from).cy - center(b.from).cy);
      const n = group.length;
      group.forEach((r, i) => {
        const fraction = n === 1 ? 0.5 : (i + 1) / (n + 1);
        entryY.set(r.id, r.to.y + r.to.height * fraction);
      });
    }

    for (const r of resolved) {
      arrows.push({
        id: r.id,
        d: arrowPath(r.from, r.to, entryY.get(r.id) ?? center(r.to).cy),
        danger: r.danger,
        glide: r.glide,
      });
    }

    for (const ann of step.annotations ?? []) {
      const from = getAnchor(ann.fromId);
      const to = getAnchor(ann.toId);
      if (!from || !to) continue;
      arcs.push({ id: ann.id, ...arcPath(from, to), text: ann.label });
    }

    return { arrows, nulls, arcs };
  }, [getAnchor, version, step, retargeted]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
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
            stroke={a.danger ? 'var(--se-danger)' : 'var(--se-pointer)'}
            strokeDasharray={a.danger ? '5 4' : undefined}
            markerEnd={`url(#${a.danger ? 'se-arrow-danger' : 'se-arrow-azure'})`}
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
