import { describe, expect, it } from 'vitest';
import {
  parseFrontmatter,
  parseInline,
  parseMarkdown,
  splitSlides,
  type Block,
} from './markdown.ts';

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
      expect(ul.items[0].content).toEqual([{ type: 'text', value: 'one' }]);
      expect(ul.items[0].children).toEqual([]);
    }
    const ol = parseMarkdown('1. a\n2. b')[0];
    expect(ol.type === 'list' && ol.ordered).toBe(true);
  });

  it('parses a nested list as children of the item above it', () => {
    const [list] = parseMarkdown('- top\n  - nested a\n  - nested b\n- second');
    expect(list.type).toBe('list');
    if (list.type === 'list') {
      expect(list.items).toHaveLength(2); // top, second
      const sub = list.items[0].children[0];
      expect(sub.type).toBe('list');
      if (sub.type === 'list') {
        expect(sub.items.map((it) => it.content)).toEqual([
          [{ type: 'text', value: 'nested a' }],
          [{ type: 'text', value: 'nested b' }],
        ]);
      }
      expect(list.items[1].content).toEqual([{ type: 'text', value: 'second' }]);
    }
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

describe('diagram blocks', () => {
  it('parses a call-stack fence into frames (caption, fields, active), not a code block', () => {
    const [block] = parseMarkdown(
      [
        '```call-stack',
        'caption: deepest point',
        'main()',
        'factorial(2) | n = 2 | return = 2 * factorial(1)',
        'factorial(1) | n = 1 | active',
        '```',
      ].join('\n'),
    );
    expect(block.type).toBe('diagram');
    if (block.type === 'diagram' && block.diagram.kind === 'call-stack') {
      expect(block.diagram.caption).toBe('deepest point');
      expect(block.diagram.frames).toHaveLength(3);
      expect(block.diagram.frames[0]).toEqual({ label: 'main()', fields: [], active: false });
      expect(block.diagram.frames[1]).toEqual({
        label: 'factorial(2)',
        fields: ['n = 2', 'return = 2 * factorial(1)'],
        active: false,
      });
      expect(block.diagram.frames[2]).toEqual({
        label: 'factorial(1)',
        fields: ['n = 1'],
        active: true,
      });
    }
  });

  it('parses a call-tree fence by indentation, marking repeated subproblems', () => {
    const [block] = parseMarkdown('```call-tree\nfib(3)\n  fib(2) *\n    fib(1)\n  fib(1)\n```');
    expect(block.type).toBe('diagram');
    if (block.type === 'diagram' && block.diagram.kind === 'call-tree') {
      const root = block.diagram.root;
      expect(root?.label).toBe('fib(3)');
      expect(root?.children.map((c) => c.label)).toEqual(['fib(2)', 'fib(1)']);
      expect(root?.children[0].repeat).toBe(true); // "fib(2) *"
      expect(root?.children[0].children.map((c) => c.label)).toEqual(['fib(1)']);
      expect(root?.children[1].repeat).toBe(false);
    }
  });
});

describe('splitSlides', () => {
  it('splits on a top-level --- and drops empty/trailing slides', () => {
    expect(splitSlides('# One\n\n---\n\n# Two\n\n---\n')).toEqual(['# One', '# Two']);
  });

  it('treats a body with no --- as a single slide', () => {
    expect(splitSlides('# Only\n\nbody')).toEqual(['# Only\n\nbody']);
  });

  it('ignores --- inside a fenced code block', () => {
    const slides = splitSlides('# A\n\n```c\nint x;\n---\nint y;\n```\n\n---\n\n# B');
    expect(slides).toHaveLength(2);
    expect(slides[0]).toContain('---'); // the --- inside the fence stayed
    expect(slides[1]).toBe('# B');
  });
});
