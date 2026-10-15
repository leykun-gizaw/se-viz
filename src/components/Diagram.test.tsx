import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, type Diagram } from '../engine/markdown.ts';
import { DiagramView } from './Diagram.tsx';

/** Parse a single fenced diagram block and render it to static SVG markup. */
function render(src: string): string {
  const [block] = parseMarkdown(src);
  if (block?.type !== 'diagram') throw new Error(`expected a diagram block, got ${block?.type}`);
  return renderToStaticMarkup(<DiagramView diagram={block.diagram} />);
}

function diagramOf(src: string): Diagram {
  const [block] = parseMarkdown(src);
  if (block?.type !== 'diagram') throw new Error(`expected a diagram block, got ${block?.type}`);
  return block.diagram;
}

describe('existing diagram kinds render byte-identically (Phase 22 baseline)', () => {
  it('call-stack', () => {
    expect(
      render(
        [
          '```call-stack',
          'caption: factorial(3) at its deepest',
          'main()',
          'factorial(3) | n = 3 | return = 3 * factorial(2)',
          'factorial(2) | n = 2 | return = 2 * factorial(1)',
          'factorial(1) | n = 1 | base case | active',
          '```',
        ].join('\n'),
      ),
    ).toMatchSnapshot();
  });

  it('call-tree', () => {
    expect(
      render(
        [
          '```call-tree',
          'caption: fib(2) is computed twice — naive fib is exponential',
          'fib(4)',
          '  fib(3)',
          '    fib(2) *',
          '    fib(1)',
          '  fib(2) *',
          '```',
        ].join('\n'),
      ),
    ).toMatchSnapshot();
  });
});

describe('pipeline renderer (Phase 26)', () => {
  const src = [
    '```pipeline',
    'circle.c | source | @0 | highlight',
    'square.c | source | @0',
    'cc: cc -c | process | compile | @1 | highlight',
    'app | executable | @2 | accent',
    'circle.c -> cc',
    'square.c -> cc',
    'cc -> app',
    '```',
  ].join('\n');

  it('renders token-styled SVG: dashed pill processes, amber highlight, teal accent', () => {
    const html = render(src);
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toContain('stroke-dasharray="5 4"'); // the process pill
    expect(html).toContain('var(--se-active)'); // highlighted node + its outgoing edges
    expect(html).toContain('var(--se-heap)'); // the accent artifact
    expect(html).not.toMatch(/#[0-9a-f]{6}/i); // tokens only — no hard-coded colors
    expect(html).toContain('COMPILE'); // sublabels render uppercase
  });

  it('dims everything off the highlighted path', () => {
    const html = render(src);
    // square.c (not highlighted) and its edge are dimmed; the highlighted nodes are not.
    expect(html.match(/opacity="0.45"/g)?.length).toBe(3); // square.c, square.c→cc, app
  });

  it('parses the same spec it renders', () => {
    const d = diagramOf(src);
    expect(d.kind).toBe('pipeline');
  });
});

describe('symbol-table renderer (Phase 26)', () => {
  it('renders unresolved needs and failed edges in the danger token', () => {
    const html = render(
      [
        '```symbol-table',
        'file libshapes.a',
        'defines: area_circle',
        'file main.o',
        'needs: area_circle!',
        'main.o:area_circle -x libshapes.a:area_circle',
        '```',
      ].join('\n'),
    );
    expect(html).toContain('UNRESOLVED');
    expect(html).toContain('var(--se-danger-soft)');
    expect(html).toContain('stroke-dasharray="6 5"'); // the failed edge
    expect(html).not.toContain('<polygon'); // a failed edge has no arrowhead
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it('draws a resolved edge as an azure arrow', () => {
    const html = render(
      [
        '```symbol-table',
        'file main.o',
        'needs: area_circle',
        'file circle.o',
        'defines: area_circle',
        'main.o:area_circle -> circle.o:area_circle',
        '```',
      ].join('\n'),
    );
    expect(html).toContain('<polygon');
    expect(html).toContain('var(--se-pointer)');
    expect(html).not.toContain('UNRESOLVED');
  });
});
