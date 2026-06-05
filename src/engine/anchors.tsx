/**
 * `AnchorProvider` — lets any memory entity (cell, heap block, frame) publish its on-screen
 * rectangle by **stable id**, measured relative to the memory canvas. The SVG arrow overlay reads
 * these rects to draw pointer arrows from a pointer cell to whatever its `target` id resolves to.
 * (Context, types, and hooks live in `anchorContext.ts`.)
 *
 * Robustness (a hard requirement of Phase 1): rects are re-measured on window resize and on canvas
 * resize (ResizeObserver), and a short requestAnimationFrame "pulse" re-measures during frame
 * push/pop springs so arrows track their moving targets and settle correctly.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnchorContext, type Anchor, type AnchorRegistry } from './anchorContext.ts';

/** Provides an {@link AnchorRegistry} to a memory-canvas subtree. */
export function AnchorProvider({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const anchorRefs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const [version, setVersion] = useState(0);
  const rafRef = useRef<number | null>(null);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const setCanvas = useCallback(
    (el: HTMLDivElement | null) => {
      canvasRef.current = el;
      bump();
    },
    [bump],
  );

  const anchorRef = useCallback(
    (id: string) => {
      let cb = anchorRefs.current.get(id);
      if (!cb) {
        cb = (el: HTMLElement | null) => {
          if (el) nodes.current.set(id, el);
          else nodes.current.delete(id);
          bump();
        };
        anchorRefs.current.set(id, cb);
      }
      return cb;
    },
    [bump],
  );

  const getAnchor = useCallback((id: string): Anchor | null => {
    const canvas = canvasRef.current;
    const el = nodes.current.get(id);
    if (!canvas || !el) return null;
    const c = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - c.left, y: r.top - c.top, width: r.width, height: r.height };
  }, []);

  const pulse = useCallback(
    (ms = 420) => {
      const start = performance.now();
      const tick = (now: number) => {
        bump();
        if (now - start < ms) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    },
    [bump],
  );

  useEffect(() => {
    const onResize = () => bump();
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(() => bump());
    const canvas = canvasRef.current;
    if (canvas) ro.observe(canvas);
    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [bump]);

  const value = useMemo<AnchorRegistry>(
    () => ({ setCanvas, anchorRef, getAnchor, version, pulse }),
    [setCanvas, anchorRef, getAnchor, version, pulse],
  );

  return <AnchorContext.Provider value={value}>{children}</AnchorContext.Provider>;
}
