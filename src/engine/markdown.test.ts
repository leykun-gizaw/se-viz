import { describe, expect, it } from 'vitest';
import { parseFrontmatter, parseInline, parseMarkdown, type Block } from './markdown.ts';

describe('parseFrontmatter', () => {
  it('splits flat key: value frontmatter from the body', () => {
    const { data, body } = parseFrontmatter(
      `---\ncourse: SE 200\ntopic: Recursion\ntitle: "Recursion"\norder: 50\n---\n# Hi\n\nBody.`,
    );
    expect(data).toEqual({ course: 'SE 200', topic: 'Recursion', title: 'Recursion', order: '50' });
    expect(body).toBe('# Hi\n\nBody.');
  });

  it('returns the whole input as body when there is no frontmatter', () => {
    const { data, body } = parseFrontmatter('# No frontmatter');
    expect(data).toEqual({});
    expect(body).toBe('# No frontmatter');
  });
});

describe('parseInline', () => {
  it('parses bold, italic, code and links; leaves underscores literal', () => {
    expect(parseInline('a **b** c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'strong', children: [{ type: 'text', value: 'b' }] },
      { type: 'text', value: ' c' },
    ]);
    expect(parseInline('`node_t` stays literal')).toEqual([
      { type: 'code', value: 'node_t' },
      { type: 'text', value: ' stays literal' },
    ]);
    // A lone underscore is NOT emphasis (so C identifiers read literally).
    expect(parseInline('insert_head')).toEqual([{ type: 'text', value: 'insert_head' }]);
    expect(parseInline('[x](https://y.z)')).toEqual([
      { type: 'link', href: 'https://y.z', children: [{ type: 'text', value: 'x' }] },
    ]);
  });
});

describe('parseMarkdown', () => {
  it('parses headings, paragraphs, and a fenced C code block', () => {
    const blocks = parseMarkdown('## Heading\n\nA paragraph.\n\n```c\nint x = 1;\n```');
    expect(blocks[0]).toEqual({
      type: 'heading',
      level: 2,
      children: [{ type: 'text', value: 'Heading' }],
    });
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[2]).toEqual({ type: 'code', lang: 'c', code: 'int x = 1;' });
  });

  it('parses an ordered and unordered list', () => {
    const ul = parseMarkdown('- one\n- two')[0];
    expect(ul.type).toBe('list');
    if (ul.type === 'list') {
      expect(ul.ordered).toBe(false);
      expect(ul.items).toHaveLength(2);
    }
    const ol = parseMarkdown('1. a\n2. b')[0];
    expect(ol.type === 'list' && ol.ordered).toBe(true);
  });

  it('maps "> [!variant]" blockquotes to coach-variant callouts', () => {
    const [callout] = parseMarkdown('> [!watch-out] Careful\n> Do not free twice.') as Block[];
    expect(callout.type).toBe('callout');
    if (callout.type === 'callout') {
      expect(callout.variant).toBe('watch-out');
      expect(callout.title).toBe('Careful');
      expect(callout.children[0].type).toBe('paragraph');
    }
  });

  it('falls back to a plain blockquote for an unknown admonition', () => {
    const [bq] = parseMarkdown('> just a quote');
    expect(bq.type).toBe('blockquote');
  });

  it('parses a GFM pipe table', () => {
    const [table] = parseMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');
    expect(table.type).toBe('table');
    if (table.type === 'table') {
      expect(table.headers).toHaveLength(2);
      expect(table.rows).toEqual([
        [[{ type: 'text', value: '1' }], [{ type: 'text', value: '2' }]],
      ]);
    }
  });

  it('does not emit raw HTML — angle brackets are literal text', () => {
    const [p] = parseMarkdown('<script>alert(1)</script>');
    expect(p.type).toBe('paragraph');
    if (p.type === 'paragraph') {
      expect(p.children).toEqual([{ type: 'text', value: '<script>alert(1)</script>' }]);
    }
  });
});
