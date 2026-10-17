/**
 * Every existing trace still renders in the Studio stage (Phase 28) — normal view (narration card +
 * timeline) and presentation view (narration bar, no timeline) — and still validates. A smoke test:
 * server-rendered with the real `useTrace`, at the first beat.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allCatalogModules } from '../../content/catalog.ts';
import type { Trace } from '../../engine/trace/types.ts';
import { useTrace } from '../../engine/trace/useTrace.ts';
import { validateTrace } from '../../engine/trace/validate.ts';
import { Stage } from '../Stage.tsx';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  });
});
afterEach(() => vi.unstubAllGlobals());

function Host({ trace, presenting }: { trace: Trace; presenting: boolean }) {
  const player = useTrace(trace);
  return <Stage player={player} presenting={presenting} />;
}

describe('every catalog trace renders in the Studio stage', () => {
  for (const { trace } of allCatalogModules()) {
    it(trace.id, () => {
      expect(validateTrace(trace)).toEqual([]);
      const normal = renderToStaticMarkup(<Host trace={trace} presenting={false} />);
      expect(normal).toContain('aria-label="Timeline: jump to a step"');
      expect(normal).toContain('aria-live="polite"');
      const presenting = renderToStaticMarkup(<Host trace={trace} presenting />);
      expect(presenting).not.toContain('Timeline: jump to a step');
    });
  }
});
