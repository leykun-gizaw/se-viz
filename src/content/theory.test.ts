import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog.ts';
import { THEORY_DOCS } from './theory.ts';

describe('theory docs', () => {
  it('discovers the exemplar theory docs', () => {
    expect(THEORY_DOCS.length).toBeGreaterThanOrEqual(2);
  });

  it('has unique theory ids', () => {
    const ids = THEORY_DOCS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const doc of THEORY_DOCS) {
    describe(`"${doc.path}"`, () => {
      it('has the required frontmatter (course, topic, title, finite order)', () => {
        expect(doc.course.trim()).not.toBe('');
        expect(doc.topic.trim()).not.toBe('');
        expect(doc.title.trim()).not.toBe('');
        expect(Number.isFinite(doc.order)).toBe(true);
        expect(doc.body.trim().length).toBeGreaterThan(0);
      });

      it('resolves to a real catalog course/topic and is pinned into it', () => {
        const course = CATALOG.find((c) => c.course === doc.course);
        expect(course, `course "${doc.course}" not in catalog`).toBeDefined();
        const topic = course?.topics.find((t) => t.topic === doc.topic);
        expect(topic, `topic "${doc.topic}" not in course "${doc.course}"`).toBeDefined();
        // The merge step must have attached this exact doc as the topic's pinned theory.
        expect(topic?.theory?.id).toBe(doc.id);
      });
    });
  }
});
