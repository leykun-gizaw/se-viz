/**
 * The figure SVG sanitizer (Phase 36) against hostile input: scripts, event handlers, external
 * references (`href`, `xlink:href`, CSS `url()`), `foreignObject`, entity tricks and malformed
 * markup — and against the real matplotlib SVGs of the recorded samples, which must survive intact.
 */
import { describe, expect, it } from 'vitest';
import type { RunResult } from '../../../python/protocol.ts';
import {
  cleanAttribute,
  safePngDataUrl,
  sanitizeSvg,
  SVG_NS,
  verifySvgDom,
  type DomNodeLike,
} from './sanitizeSvg.ts';

const wrap = (body: string, rootAttrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 50"${rootAttrs}>${body}</svg>`;

const clean = (body: string, rootAttrs = '') => {
  const out = sanitizeSvg(wrap(body, rootAttrs), 'p-');
  if (!out) throw new Error('rejected');
  return out.svg;
};

/** Nothing executable or external may survive, whatever the spelling. */
function assertInert(svg: string) {
  expect(svg).not.toMatch(/<script/i);
  expect(svg).not.toMatch(/<foreignObject/i);
  expect(svg).not.toMatch(/<style/i);
  expect(svg).not.toMatch(/\son\w+\s*=/i);
  expect(svg).not.toMatch(/javascript:/i);
  expect(svg.replace(`xmlns="${SVG_NS}"`, '')).not.toMatch(/https?:/i);
  expect(svg).not.toMatch(/xlink:href/i);
  expect(svg).not.toMatch(/url\((?!#p-)/i);
  expect(svg).not.toMatch(/href="(?!#p-|data:image\/(png|jpeg);base64,)/);
}

describe('sanitizeSvg: hostile input', () => {
  it('drops script elements, with their content, in every spelling', () => {
    for (const s of [
      '<script>alert(1)</script>',
      '<script type="text/javascript"><![CDATA[alert(1)]]></script>',
      '<SCRIPT>alert(1)</SCRIPT>',
      '<g><script href="https://evil.example/x.js"/></g>',
      '<svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script>',
    ]) {
      const svg = clean(`<path d="M0 0"/>${s}`);
      assertInert(svg);
      expect(svg).not.toContain('alert');
      expect(svg).toContain('<path d="M0 0">');
    }
  });

  it('drops every event handler attribute', () => {
    const svg = clean(
      '<g onclick="alert(1)" ONLOAD="alert(2)" onmouseover=\'x()\'><rect width="5" height="5" onfocusin="y()"/></g>',
      ' onload="alert(3)"',
    );
    assertInert(svg);
    expect(svg).toContain('<rect width="5" height="5">');
  });

  it('drops foreignObject and everything inside it', () => {
    const svg = clean(
      '<foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml"><iframe src="https://evil.example"></iframe><img src="x" onerror="alert(1)"/></div></foreignObject><circle r="3"/>',
    );
    assertInert(svg);
    expect(svg).not.toMatch(/iframe|img|div/);
    expect(svg).toContain('<circle r="3">');
  });

  it('allows only local #id links, rewritten with the prefix', () => {
    const svg = clean(
      [
        '<defs><path id="m1" d="M0 0"/></defs>',
        '<use xlink:href="#m1" x="1"/>',
        '<use href="https://evil.example/sprite.svg#m1"/>',
        '<use xlink:href="data:image/svg+xml;base64,PHN2Zy8+#x"/>',
        '<use href="javascript:alert(1)"/>',
        '<use href=" #m1 "/>',
        '<image href="https://evil.example/track.png" width="1" height="1"/>',
        '<image xlink:href="file:///etc/passwd"/>',
      ].join(''),
    );
    assertInert(svg);
    expect(svg).toContain('<path id="p-m1" d="M0 0">');
    expect(svg.match(/<use /g)).toHaveLength(2); // the two local references only
    expect(svg).toContain('<use href="#p-m1" x="1">');
    expect(svg).not.toContain('<image');
  });

  it('drops links on elements that should not have one (a, text, g)', () => {
    const svg = clean(
      '<a href="https://evil.example"><text>click</text></a><g href="#x"/><text xlink:href="#x">t</text>',
    );
    assertInert(svg);
    expect(svg).not.toContain('click');
    expect(svg).toContain('<g></g><text>t</text>');
  });

  it('keeps an embedded raster image only as a base64 PNG or JPEG data URL', () => {
    const svg = clean(
      [
        '<image width="2" height="2" xlink:href="data:image/png;base64,iVBORw0KGgo="/>',
        '<image href="data:image/svg+xml;base64,PHNjcmlwdD4="/>',
        '<image href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;"/>',
        '<image href="data:image/png;base64,AAA=&quot; onload=&quot;x"/>',
      ].join(''),
    );
    assertInert(svg);
    expect(svg.match(/<image /g)).toHaveLength(1);
    expect(svg).toContain('href="data:image/png;base64,iVBORw0KGgo="');
  });

  it('keeps url(#id) in attributes and styles, and drops every other url()', () => {
    const svg = clean(
      [
        '<clipPath id="c1"><rect width="1" height="1"/></clipPath>',
        '<path clip-path="url(#c1)" d="M0 0"/>',
        '<path fill="url(https://evil.example/x.svg#g)" d="M1 1"/>',
        '<path fill="url(#c1) url(//evil.example/a)" d="M2 2"/>',
        '<path style="fill: url(&apos;https://evil.example/a.png&apos;); stroke: #000000" d="M3 3"/>',
        '<path style="clip-path: url(#c1); background: url(https://evil.example/b)" d="M4 4"/>',
        '<path style="fill: u\\72l(https://evil.example)" d="M5 5"/>',
        '<path style="fill:red;behavior:url(x.htc);-moz-binding:url(x.xml#y)" d="M6 6"/>',
        '<path style="fill: expression(alert(1))" d="M7 7"/>',
        '<path style="fill: red /* */; stroke: @import" d="M8 8"/>',
        '<path filter="url(https://evil.example/f)" mask="url(#c1)" d="M9 9"/>',
      ].join(''),
    );
    assertInert(svg);
    expect(svg).toContain('<path clip-path="url(#p-c1)" d="M0 0">');
    expect(svg).toContain('<path d="M1 1">');
    expect(svg).toContain('<path d="M2 2">');
    expect(svg).toContain('<path style="stroke: #000000" d="M3 3">');
    expect(svg).toContain('<path style="clip-path: url(#p-c1)" d="M4 4">');
    expect(svg).toContain('<path d="M5 5">');
    expect(svg).toContain('<path style="fill: red" d="M6 6">');
    expect(svg).toContain('<path d="M7 7">');
    expect(svg).toContain('<path d="M8 8">');
    expect(svg).toContain('<path mask="url(#p-c1)" d="M9 9">');
  });

  it('drops style, metadata, animation, filters, and unknown or namespaced elements', () => {
    const svg = clean(
      [
        '<style>@import url(https://evil.example/a.css); *{fill:red}</style>',
        '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></metadata>',
        '<set attributeName="href" to="javascript:alert(1)"/>',
        '<animate attributeName="href" values="javascript:alert(1)"/>',
        '<filter id="f"><feImage href="https://evil.example/i.png"/></filter>',
        '<iframe src="https://evil.example"/>',
        '<html:img xmlns:html="http://www.w3.org/1999/xhtml" src="x"/>',
        '<rect width="1" height="1"/>',
      ].join(''),
    );
    assertInert(svg);
    expect(svg).not.toMatch(/metadata|rdf|animate|<set|filter|feImage|iframe|img/);
    expect(svg).toContain('<rect width="1" height="1">');
  });

  it('drops class and namespace declarations, and writes its own SVG namespace', () => {
    const svg = clean('<g class="hidden" xmlns:x="urn:x" x:evil="1"><rect width="1"/></g>');
    expect(svg.startsWith(`<svg xmlns="${SVG_NS}" viewBox="0 0 100 50">`)).toBe(true);
    expect(svg).toContain('<g><rect width="1"></rect></g>');
  });

  it('escapes text and attribute values on output', () => {
    const svg = clean(
      '<text x="1&quot; onload=&quot;alert(1)">&lt;script&gt;alert(1)&lt;/script&gt; &amp; 5 &#x3C; 6</text>',
    );
    expect(svg).toContain('<text>&lt;script&gt;alert(1)&lt;/script&gt; &amp; 5 &lt; 6</text>');
    assertInert(svg);
  });

  it('drops text outside text elements', () => {
    expect(clean('<g>stray words<rect width="1"/></g>')).toContain(
      '<g><rect width="1"></rect></g>',
    );
  });

  it('prefixes ids and drops odd ones', () => {
    const svg = clean('<g id="axes_1"/><g id="a b"/><g id="1x"/><g id="javascript:x"/>');
    expect(svg).toContain('<g id="p-axes_1"></g><g></g><g></g><g></g>');
  });

  it('removes the root size (the container sizes the figure) and reports the aspect ratio', () => {
    const out = sanitizeSvg(wrap('<rect width="1"/>', ' width="460.8pt" height="345.6pt"'), 'p-');
    expect(out?.svg).not.toMatch(/<svg[^>]*\swidth=/);
    expect(out?.aspect).toBe(2);
  });

  it('rejects malformed or dangerous documents outright', () => {
    const rejected = [
      // entity definitions (billion laughs, external entities)
      '<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>',
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
      // undefined entity, bare ampersand, bad character references
      wrap('<text>&nbsp;</text>'),
      wrap('<text>a & b</text>'),
      wrap('<text>&#0;</text>'),
      wrap('<text>&#xD800;</text>'),
      // mismatched, unclosed, two roots, text outside the root
      wrap('<g></text>'),
      '<svg xmlns="http://www.w3.org/2000/svg"><g>',
      `${wrap('')}${wrap('')}`,
      `junk${wrap('')}`,
      // unquoted, duplicated, or < in an attribute
      wrap('<rect width=1/>'),
      wrap('<rect width="1" width="2"/>'),
      wrap('<rect width="<script>"/>'),
      // not an svg root
      '<html><script>alert(1)</script></html>',
      '<script>alert(1)</script>',
      '',
      // too deep
      wrap('<g>'.repeat(70) + '</g>'.repeat(70)),
    ];
    for (const input of rejected) expect(sanitizeSvg(input, 'p-'), input.slice(0, 60)).toBeNull();
  });

  it('rejects an oversized document and a bad prefix', () => {
    expect(sanitizeSvg(wrap(`<path d="${'M0 0 '.repeat(250_000)}"/>`), 'p-')).toBeNull();
    expect(sanitizeSvg(wrap(''), '"><script>')).toBeNull();
  });

  it('keeps the XML declaration and a public DOCTYPE out of the output', () => {
    const out = sanitizeSvg(
      `<?xml version="1.0" encoding="utf-8" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"\n  "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n${wrap('<!-- c --><rect width="1"/>')}`,
      'p-',
    );
    expect(out?.svg).toBe(
      `<svg xmlns="${SVG_NS}" viewBox="0 0 100 50"><rect width="1"></rect></svg>`,
    );
  });
});

describe('cleanAttribute', () => {
  it('is idempotent on its own output (what the DOM re-check relies on)', () => {
    const cases: [string, string, string][] = [
      [
        'path',
        'style',
        "fill: #ffffff; stroke: url('#c1'); font-family: 'DejaVu Sans', sans-serif",
      ],
      ['path', 'clip-path', 'url(#p1)'],
      ['use', 'xlink:href', '#m1'],
      ['g', 'id', 'axes_1'],
      ['text', 'transform', 'rotate(-90 10 20)'],
    ];
    for (const [el, name, value] of cases) {
      const once = cleanAttribute(el, name, value, '');
      expect(once).not.toBeNull();
      expect(cleanAttribute(el, name, once!, '')).toBe(once);
    }
  });
});

/* ── a fake DOM, to exercise the re-check without a browser ── */

interface FakeNode extends DomNodeLike {
  childNodes: FakeNode[];
  attributes?: { name: string; value: string }[];
}
function el(
  localName: string,
  attrs: Record<string, string> = {},
  children: FakeNode[] = [],
  ns: string = SVG_NS,
): FakeNode {
  const node: FakeNode = {
    nodeType: 1,
    localName,
    namespaceURI: ns,
    attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })),
    childNodes: children,
    removeAttribute(name) {
      node.attributes = node.attributes!.filter((a) => a.name !== name);
    },
    remove() {
      parentOf.get(node)?.childNodes.splice(parentOf.get(node)!.childNodes.indexOf(node), 1);
    },
  };
  for (const c of children) parentOf.set(c, node);
  return node;
}
const parentOf = new Map<FakeNode, FakeNode>();

describe('verifySvgDom', () => {
  it('removes what the sanitizer would never write, and leaves clean trees alone', () => {
    const tree = el('svg', { xmlns: SVG_NS, viewBox: '0 0 1 1' }, [
      el('g', { id: 'a', onclick: 'x()' }, [
        el('script', {}, []),
        el('div', {}, [], 'http://www.w3.org/1999/xhtml'),
        el('path', { d: 'M0 0', style: 'fill: url(https://evil.example)' }),
      ]),
      el('foreignObject', {}, []),
      el('use', { href: 'https://evil.example/#a' }),
      { nodeType: 8, childNodes: [], remove() {} } as FakeNode, // a comment: not in a clean tree
    ]);
    // the comment isn't registered with a parent in this fake; count the rest
    const removed = verifySvgDom(tree);
    expect(removed).toBeGreaterThanOrEqual(6);
    const g = tree.childNodes[0];
    expect(g.attributes).toEqual([{ name: 'id', value: 'a' }]);
    expect(g.childNodes.map((c) => c.localName)).toEqual(['path']);
    expect(g.childNodes[0].attributes).toEqual([{ name: 'd', value: 'M0 0' }]);
    expect(tree.childNodes[1].attributes).toEqual([]);

    const fine = el('svg', { xmlns: SVG_NS, viewBox: '0 0 1 1' }, [
      el('path', { d: 'M0 0', style: 'fill: #ffffff', 'clip-path': 'url(#c)' }),
    ]);
    expect(verifySvgDom(fine)).toBe(0);
  });

  it('refuses a root that is not SVG', () => {
    expect(() => verifySvgDom(el('div', {}, [], 'http://www.w3.org/1999/xhtml'))).toThrow();
  });
});

describe('safePngDataUrl', () => {
  it('accepts only a base64 PNG data URL', () => {
    expect(safePngDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
    for (const bad of [
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png,raw',
      'data:image/png;base64,iVBOR w0K',
      'data:image/png;base64,iVBOR"onerror="x',
      'https://evil.example/x.png',
      'javascript:alert(1)',
      ' data:image/png;base64,iVBORw0KGgo=',
      42,
      null,
    ]) {
      expect(safePngDataUrl(bad)).toBeNull();
    }
    expect(safePngDataUrl(`data:image/png;base64,${'A'.repeat(700_000)}`)).toBeNull();
  });
});

/* ── the real recorded figures survive ── */

const RAW = import.meta.glob<string>('../../../python/fixtures/matplotlib/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the recorded matplotlib SVGs', () => {
  const figures = Object.values(RAW).flatMap((text) =>
    (JSON.parse(text) as RunResult).steps.flatMap((s) => s.figures ?? []),
  );

  it('there are recorded SVG figures to check', () => {
    expect(figures.filter((f) => f.format === 'svg').length).toBeGreaterThanOrEqual(6);
  });

  it.each(figures.filter((f) => f.format === 'svg').map((f, i) => [i, f] as const))(
    'figure %i sanitizes, keeping its drawing and text',
    (_i, f) => {
      const out = sanitizeSvg(f.data!, 'fx-');
      expect(out).not.toBeNull();
      const svg = out!.svg;
      assertInert(svg.replaceAll('#fx-', '#p-'));
      expect(out!.aspect).toBeCloseTo(f.width / f.height, 3);
      // Every path and text element survives; only style / metadata-like parts go.
      const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
      expect(count(svg, /<path[\s>]/g)).toBe(count(f.data!, /<path[\s>]/g));
      expect(count(svg, /<text[\s>]/g)).toBe(count(f.data!, /<text[\s>]/g));
      expect(count(svg, /<use[\s>]/g)).toBe(count(f.data!, /<use[\s>]/g));
      for (const axes of f.axes) if (axes.title) expect(svg).toContain(`>${axes.title}</text>`);
      // Clip paths still resolve inside the prefixed copy.
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(svg).toContain(`id="${m[1]}"`);
      for (const m of svg.matchAll(/href="#([^"]+)"/g)) expect(svg).toContain(`id="${m[1]}"`);
      // Sanitizing the output again changes nothing but the prefix.
      expect(sanitizeSvg(svg, 'fx-')?.svg.replaceAll('fx-fx-', 'fx-')).toBe(svg);
    },
  );
});
