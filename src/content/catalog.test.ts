import { describe, expect, it } from 'vitest';
import { validateTrace } from '../engine/trace/validate.ts';
import { allCatalogModules, allCatalogTraces } from './catalog.ts';

describe('catalog', () => {
  const traces = allCatalogTraces();

  it('registers at least the Phase 2 modules plus the Phase 1 fixtures', () => {
    expect(traces.length).toBeGreaterThanOrEqual(9);
  });

  it('has unique trace ids', () => {
    const ids = traces.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Every authored trace must satisfy the structural invariants — any content slip fails here.
  for (const trace of traces) {
    it(`validateTrace passes for "${trace.id}"`, () => {
      expect(validateTrace(trace)).toEqual([]);
    });
  }

  it('every module carries curriculum-sourced breadcrumb metadata', () => {
    for (const m of allCatalogModules()) {
      // Either a full course/topic/file breadcrumb, or (n/a for none) — but our modules all set it.
      expect(m.trace.course).toBeTruthy();
      expect(m.trace.steps.length).toBeGreaterThan(0);
    }
  });
});
