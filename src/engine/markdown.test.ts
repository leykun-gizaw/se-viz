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

/** Parse one fenced block and return it (diagram or fallback code block). */
function fence(lang: string, ...lines: string[]): Block {
  return parseMarkdown(['```' + lang, ...lines, '```'].join('\n'))[0];
}

describe('pipeline diagrams (Phase 26)', () => {
  it('parses nodes (id, label override, kind, stage, sublabel, markers) and chained edges', () => {
    const block = fence(
      'pipeline',
      'caption: one file',
      'main.c | source | @0 | highlight',
      'cc1: cc -c | process | compile | @1',
      'app | @2 | accent',
      'main.c -> cc1 -> app',
    );
    expect(block.type).toBe('diagram');
    if (block.type !== 'diagram' || block.diagram.kind !== 'pipeline') return;
    expect(block.diagram.caption).toBe('one file');
    expect(block.diagram.nodes).toEqual([
      {
        id: 'main.c',
        kind: 'artifact',
        label: 'main.c',
        sublabel: 'source',
        stage: 0,
        highlight: true,
        accent: false,
      },
      {
        id: 'cc1',
        kind: 'process',
        label: 'cc -c',
        sublabel: 'compile',
        stage: 1,
        highlight: false,
        accent: false,
      },
      {
        id: 'app',
        kind: 'artifact',
        label: 'app',
        sublabel: null,
        stage: 2,
        highlight: false,
        accent: true,
      },
    ]);
    expect(block.diagram.edges).toEqual([
      { from: 'main.c', to: 'cc1' },
      { from: 'cc1', to: 'app' },
    ]);
  });

  it.each([
    ['an unrecognized line', ['a.c | @0', 'this is not a node or edge']],
    ['a node without a stage', ['a.c | source']],
    ['an edge to an undeclared id', ['a.c | @0', 'a.c -> b.o']],
    ['a duplicate id', ['a.c | @0', 'a.c | @1']],
    ['two free-text sublabels', ['a.c | source | extra | @0']],
    ['an empty edge endpoint', ['a.c | @0', 'a.c ->']],
    ['no nodes at all', ['caption: nothing here']],
  ])('falls back to a plain code block on %s', (_why, lines) => {
    const block = fence('pipeline', ...lines);
    expect(block).toEqual({ type: 'code', lang: 'pipeline', code: lines.join('\n') });
  });
});

describe('symbol-table diagrams (Phase 26)', () => {
  it('parses files (default + explicit columns), sections, unresolved needs, and edges', () => {
    const block = fence(
      'symbol-table',
      'caption: linking',
      'file main.o',
      '  defines: main',
      '  needs: area_circle, area_triangle!',
      'file libshapes.a(circle.o) @3',
      '  defines: area_circle',
      'main.o:area_circle -> libshapes.a(circle.o):area_circle',
      'main.o:area_triangle -x libshapes.a(circle.o):area_circle',
    );
    expect(block.type).toBe('diagram');
    if (block.type !== 'diagram' || block.diagram.kind !== 'symbol-table') return;
    expect(block.diagram.caption).toBe('linking');
    expect(block.diagram.files).toEqual([
      {
        name: 'main.o',
        column: 0,
        defines: [{ name: 'main', unresolved: false }],
        needs: [
          { name: 'area_circle', unresolved: false },
          { name: 'area_triangle', unresolved: true },
        ],
      },
      {
        name: 'libshapes.a(circle.o)',
        column: 3,
        defines: [{ name: 'area_circle', unresolved: false }],
        needs: [],
      },
    ]);
    expect(block.diagram.edges).toEqual([
      {
        from: { file: 'main.o', symbol: 'area_circle' },
        to: { file: 'libshapes.a(circle.o)', symbol: 'area_circle' },
        failed: false,
      },
      {
        from: { file: 'main.o', symbol: 'area_triangle' },
        to: { file: 'libshapes.a(circle.o)', symbol: 'area_circle' },
        failed: true,
      },
    ]);
  });

  const base = ['file main.o', 'needs: f', 'file lib.o', 'defines: f'];
  it.each([
    ['a section before any file', ['defines: f', 'file main.o']],
    ['an unrecognized line', [...base, 'main.o needs f']],
    ['an edge from a defines entry', [...base, 'lib.o:f -> main.o:f']],
    ['an edge to a symbol the target does not define', [...base, 'main.o:f -> lib.o:g']],
    ['an edge to an unknown file', [...base, 'main.o:f -> other.o:f']],
    ['an edge within one file', ['file a.o', 'defines: f', 'needs: f', 'a.o:f -> a.o:f']],
    ['an unresolved marker on a definition', ['file a.o', 'defines: f!']],
    ['a duplicate file', ['file a.o', 'file a.o']],
    ['an edge endpoint without a symbol', [...base, 'main.o -> lib.o:f']],
  ])('falls back to a plain code block on %s', (_why, lines) => {
    const block = fence('symbol-table', ...lines);
    expect(block).toEqual({ type: 'code', lang: 'symbol-table', code: lines.join('\n') });
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
