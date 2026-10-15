import { describe, expect, it } from 'vitest';
import { parseMarkdown, splitSlides, type Block, type Diagram } from '../../../engine/markdown.ts';
import { THEORY_DOCS } from '../../theory.ts';

/**
 * Phase 26 acceptance, pinned: the Static Libraries deck is ~18–22 slides, has no ASCII-art
 * diagrams, uses the new diagram kinds ≥ 6 times, and draws the undefined-reference and link-order
 * stories with an unresolved symbol and a failed resolve edge.
 */
const doc = THEORY_DOCS.find((d) => d.course === 'SE 200' && d.topic === 'Static Libraries');
const slides = doc ? splitSlides(doc.body) : [];
const blocks: Block[] = slides.flatMap((s) => parseMarkdown(s));
const diagrams: Diagram[] = blocks.flatMap((b) => (b.type === 'diagram' ? [b.diagram] : []));

describe('Static Libraries theory deck (Phase 26)', () => {
  it('exists', () => {
    expect(doc).toBeDefined();
  });

  // Phase 26 set ~18–22; adding the example program's code (shapes.h, the library sources, main.c,
  // a full build session) grew it deliberately. Keep it from sprawling further.
  it('has ~18–26 slides including the auto title slide', () => {
    const total = slides.length + 1;
    expect(total).toBeGreaterThanOrEqual(18);
    expect(total).toBeLessThanOrEqual(26);
  });

  it('shows the example program as real C code', () => {
    const c = blocks.flatMap((b) => (b.type === 'code' && b.lang === 'c' ? [b.code] : []));
    expect(c.some((s) => s.includes('double area_circle(double r);'))).toBe(true); // shapes.h
    expect(c.some((s) => s.includes('return 3.14159 * r * r;'))).toBe(true); // circle.c
    expect(c.some((s) => s.includes('int main(void)'))).toBe(true); // main.c
    expect(c.some((s) => s.includes('area_triangle(3.0, 4.0)'))).toBe(true); // the link error
  });

  it('contains no ASCII-art diagrams', () => {
    for (const b of blocks) {
      if (b.type !== 'code') continue;
      expect(b.code, 'box-drawing characters in a code block').not.toMatch(/[─-╿]/);
      expect(b.code, 'an arrow drawn in a code block').not.toMatch(/->|→/);
    }
  });

  it('uses the new pipeline / symbol-table kinds at least 6 times, and both of them', () => {
    const fresh = diagrams.filter((d) => d.kind === 'pipeline' || d.kind === 'symbol-table');
    expect(fresh.length).toBeGreaterThanOrEqual(6);
    expect(fresh.some((d) => d.kind === 'pipeline')).toBe(true);
    expect(fresh.some((d) => d.kind === 'symbol-table')).toBe(true);
  });

  it('draws an unresolved symbol (undefined reference) and a failed edge (link order)', () => {
    const tables = diagrams.flatMap((d) => (d.kind === 'symbol-table' ? [d] : []));
    expect(tables.some((t) => t.files.some((f) => f.needs.some((n) => n.unresolved)))).toBe(true);
    expect(tables.some((t) => t.edges.some((e) => e.failed))).toBe(true);
  });

  it('draws an incremental rebuild with a highlighted path', () => {
    const pipes = diagrams.flatMap((d) => (d.kind === 'pipeline' ? [d] : []));
    expect(pipes.some((p) => p.nodes.filter((n) => n.highlight).length > 1)).toBe(true);
  });

  it('keeps the example program consistent with the Phase 12 visualization', () => {
    const body = doc?.body ?? '';
    for (const name of ['main.c', 'circle.c', 'square.c', 'libshapes.a', 'app', 'area_circle']) {
      expect(body).toContain(name);
    }
    expect(body).toContain('ar rcs libshapes.a circle.o square.o');
    expect(body).toContain('cc main.o -L. -lshapes -o app');
  });
});
