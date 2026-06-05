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

/** Cubic path between two anchors, exiting/entering on whichever horizontal sides face each other. */
function arrowPath(from: Anchor, to: Anchor): { d: string; end: { x: number; y: number } } {
  const f = center(from);
  const t = center(to);
  const exitRight = t.cx >= f.cx;
  const sx = exitRight ? from.x + from.width : from.x;
  const sy = f.cy;
  const ex = t.cx >= f.cx ? to.x : to.x + to.width;
  const ey = t.cy;
  const dx = Math.max(28, Math.abs(ex - sx) * 0.45);
  const c1x = exitRight ? sx + dx : sx - dx;
  const c2x = t.cx >= f.cx ? ex - dx : ex + dx;
  return {
    d: `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ey}, ${ex} ${ey}`,
    end: { x: ex, y: ey },
  };
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
      arrows.push({
        id: p.id,
        d: arrowPath(from, to).d,
        danger: p.danger,
        glide: retargeted.has(p.id),
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
