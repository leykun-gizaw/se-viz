/** The Big O generator (Phase 37): exact counts, and text that quotes them. */
import { describe, expect, it } from 'vitest';
import { growthTrace } from '../../content/fixtures/conceptGrowth.ts';
import { validateTrace } from '../trace/validate.ts';
import { growthSteps } from './growth.ts';
import { count } from './stats.ts';

const EXPECTED: Record<string, (n: number) => number> = {
  '1': () => 1,
  log: (n) => Math.log2(n),
  n: (n) => n,
  nlog: (n) => n * Math.log2(n),
  n2: (n) => n * n,
};

describe('growth generator', () => {
  const steps = growthTrace.steps;

  it('validates, and each step doubles n', () => {
    expect(validateTrace(growthTrace)).toEqual([]);
    expect(steps.map((s) => s.growth!.n)).toEqual([1, 2, 4, 8, 16, 32, 64]);
  });

  it('every curve holds the exact count at every n', () => {
    const g = steps[0].growth!;
    for (const c of g.curves) {
      g.ns.forEach((n, k) => expect(c.counts[k]).toBeCloseTo(EXPECTED[c.id](n), 9));
    }
  });

  it('the text quotes the counts at the current n, and the caption compares the right curves', () => {
    steps.forEach((s, i) => {
      const g = s.growth!;
      const at = (id: string) => g.curves.find((c) => c.id === id)!.counts[g.n - 1];
      const label = (id: string) => g.curves.find((c) => c.id === id)!.label;
      const [a, b] = g.compare!;
      expect(g.caption).toContain(`At n = ${count(g.n)}, ${label(a)} does ${count(at(a))}`);
      expect(g.caption).toContain(`${label(b)} does ${count(at(b))}`);
      expect(s.explain!.did).toContain(g.caption);
      if (i > 0) {
        const was = steps[i - 1].growth!.n;
        expect(s.explain!.did![0]).toBe(`n doubled, from ${count(was)} to ${count(g.n)}.`);
        for (const c of g.curves) {
          const line = s.explain!.did!.find((d) => d.startsWith(`${c.label} `))!;
          expect(line).toContain(count(c.counts[g.n - 1]));
        }
        // n² always quadruples, n always doubles, log n always gains 1, O(1) stays.
        expect(s.explain!.did).toContain(
          `O(n²) goes up 4 times, from ${count(was * was)} to ${count(g.n * g.n)}.`,
        );
        expect(s.explain!.did).toContain(`O(n) doubles, from ${count(was)} to ${count(g.n)}.`);
        expect(s.explain!.did).toContain('O(1) stays at 1.');
      }
      const off = s.explain!.did!.find((d) => d.includes('off the top'));
      if (off) expect(at('n2')).toBeGreaterThan(g.yMax);
    });
  });

  it('is deterministic', () => {
    expect(
      growthSteps(
        [1, 2, 4],
        [
          ['n', '1'],
          ['n', 'log'],
          ['n2', 'n'],
        ],
        16,
      ),
    ).toEqual(
      growthSteps(
        [1, 2, 4],
        [
          ['n', '1'],
          ['n', 'log'],
          ['n2', 'n'],
        ],
        16,
      ),
    );
  });
});
