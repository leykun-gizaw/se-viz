/**
 * The SVG sanitizer for matplotlib figures (Phase 36). Figure SVG comes from the student's program
 * (through matplotlib, but a program can write any text into a figure, and the recording is just
 * JSON), so it is treated as hostile markup:
 *
 * 1. {@link sanitizeSvg} parses the text with a small, strict XML parser of its own (no DOM, so it
 *    runs and is tested in Node). Anything malformed — an unknown entity, a DOCTYPE with an internal
 *    subset, a mismatched tag — rejects the whole figure. It then keeps only an allow-list of SVG
 *    drawing elements and attributes and writes fresh markup:
 *    - dropped with everything inside them: `script`, `style`, `foreignObject`, `a`, animation
 *      elements, `metadata`, filters, any namespaced element, any element not on the list;
 *    - dropped attributes: every event handler (`on…`), `xmlns…`, `class`, anything not on the list;
 *    - links: `href` / `xlink:href` only as a local `#id` (on `use`, gradients, patterns), or, on
 *      `image`, a `data:image/png|jpeg;base64,` URL; nothing external, no `javascript:`;
 *    - CSS (`style` attributes): only listed properties; `url()` only as a local `url(#id)`; no
 *      backslash escapes, comments, `@`, `expression`, or `<`;
 *    - ids are prefixed per mount (and every `#id` reference with them), so two copies of a figure
 *      on one page don't share clip paths and a figure can't clobber the app's own ids.
 * 2. {@link verifySvgDom} re-checks the parsed DOM with the same rules before it is inserted (a
 *    second line of defence against parser differences), and `mountSvg` (`svgDom.ts`) inserts it
 *    with `DOMParser` + `importNode` — never `innerHTML`.
 *
 * @packageDocumentation
 */

/** Longest SVG text accepted (the recorder caps figures at 300 KB). */
export const SVG_MAX_CHARS = 1_000_000;
const MAX_DEPTH = 64;
const MAX_NODES = 60_000;

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG drawing elements that are kept. Everything else is dropped with its content. */
const ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'clipPath',
  'use',
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
  'mask',
  'marker',
  'symbol',
  'image',
  'title',
  'desc',
]);

/** Elements whose text content is kept (text is dropped anywhere else). */
const TEXT_ELEMENTS = new Set(['text', 'tspan', 'title', 'desc']);

/** Plain attributes (numbers, paths, keywords): kept when their value is plain. */
const PLAIN_ATTRIBUTES = new Set([
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'fx',
  'fy',
  'dx',
  'dy',
  'width',
  'height',
  'd',
  'points',
  'viewBox',
  'preserveAspectRatio',
  'transform',
  'version',
  'offset',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'markerWidth',
  'markerHeight',
  'markerUnits',
  'refX',
  'refY',
  'orient',
  'textLength',
  'lengthAdjust',
  'rotate',
  'xml:space',
  // Presentation attributes.
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'opacity',
  'clip-path',
  'clip-rule',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
  'stop-color',
  'stop-opacity',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'baseline-shift',
  'letter-spacing',
  'word-spacing',
  'writing-mode',
  'visibility',
  'display',
  'overflow',
  'color',
  'image-rendering',
  'shape-rendering',
  'text-rendering',
  'vector-effect',
  'paint-order',
]);

/** Attributes (and CSS properties) that may hold a `url(#id)` reference. */
const URL_ATTRIBUTES = new Set([
  'fill',
  'stroke',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
]);

/** Elements that may carry a link (`href`): local references only, or an embedded raster image. */
const HREF_ELEMENTS = new Set(['use', 'image', 'linearGradient', 'radialGradient', 'pattern']);

/** CSS properties kept inside a `style` attribute (the presentation attributes, by CSS name). */
const CSS_PROPERTIES = new Set(
  [...PLAIN_ATTRIBUTES].filter(
    (a) => a.includes('-') || ['fill', 'stroke', 'opacity', 'mask', 'color'].includes(a),
  ),
);
for (const p of ['display', 'visibility', 'overflow', 'font', 'font-size', 'font-family'])
  CSS_PROPERTIES.add(p);

const ID = /^[A-Za-z_][\w.-]*$/;
const LOCAL_REF = /^#([A-Za-z_][\w.-]*)$/;
const URL_REF = /url\(\s*(['"]?)#([A-Za-z_][\w.-]*)\1\s*\)/g;
const DATA_IMAGE = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
/** Characters and words never allowed in a kept value. */
const UNSAFE_VALUE = /[<>"=\\]|\/\*|@|expression\s*\(|javascript:|vbscript:|data:/i;

/** Whether a value holds a control character other than tab, newline and carriage return. */
function hasControl(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if ((c < 0x20 && c !== 0x9 && c !== 0xa && c !== 0xd) || c === 0x7f) return true;
  }
  return false;
}
const unsafe = (value: string) => hasControl(value) || UNSAFE_VALUE.test(value);

/* ───────────────────────── attribute rules (shared with the DOM check) ───────────────────────── */

/** Rewrite every `url(#id)` in a value with the prefix; null if any other `url(` remains. */
function cleanUrls(value: string, prefix: string): string | null {
  const rewritten = value.replace(URL_REF, (_m, _q: string, id: string) => `url(#${prefix}${id})`);
  // Anything still spelled `url(` (an external URL, a quoted or escaped one) rejects the value.
  const withoutLocal = rewritten.replace(URL_REF, '');
  return /url\s*\(/i.test(withoutLocal) ? null : rewritten;
}

/** A `style` attribute with only listed properties and safe values, or null when nothing is left. */
function cleanStyle(value: string, prefix: string): string | null {
  const out: string[] = [];
  for (const part of value.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    let v = part.slice(colon + 1).trim();
    if (!CSS_PROPERTIES.has(prop) || v === '' || unsafe(v)) continue;
    if (/url\s*\(/i.test(v)) {
      if (!URL_ATTRIBUTES.has(prop)) continue;
      const cleaned = cleanUrls(v, prefix);
      if (cleaned === null) continue;
      v = cleaned;
    }
    out.push(`${prop}: ${v}`);
  }
  return out.length > 0 ? out.join('; ') : null;
}

/**
 * The value an attribute keeps on an element, or null to drop it. `prefix` is added to ids and to
 * `#id` references (`''` checks a value without changing it: the DOM re-check).
 */
export function cleanAttribute(
  element: string,
  name: string,
  value: string,
  prefix: string,
): string | null {
  if (hasControl(value)) return null;
  if (name === 'id') return ID.test(value) ? `${prefix}${value}` : null;
  if (name === 'href' || name === 'xlink:href') {
    if (!HREF_ELEMENTS.has(element)) return null;
    const v = value.trim();
    const local = LOCAL_REF.exec(v);
    if (local) return `#${prefix}${local[1]}`;
    if (element === 'image' && DATA_IMAGE.test(v)) return v;
    return null;
  }
  if (name === 'style') return cleanStyle(value, prefix);
  if (!PLAIN_ATTRIBUTES.has(name)) return null;
  if (/url\s*\(/i.test(value)) {
    return URL_ATTRIBUTES.has(name) && !unsafe(value) ? cleanUrls(value, prefix) : null;
  }
  return unsafe(value) ? null : value;
}

/** Whether an element (by its local name, no namespace prefix) is kept. */
export function allowedElement(name: string): boolean {
  return ELEMENTS.has(name);
}

/* ───────────────────────── a strict little XML parser ───────────────────────── */

interface XmlElement {
  name: string;
  attrs: [string, string][];
  children: XmlNode[];
}
type XmlNode = XmlElement | string;

class Reject extends Error {}

const NAME = /[A-Za-z_][\w.:-]*/y;
const SPACE = /\s*/y;

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Decode the five XML entities and numeric character references; anything else rejects. */
function decode(text: string): string {
  return text.replace(/&([^;&\s]{0,12});|&/g, (_m, body: string | undefined) => {
    if (body === undefined) throw new Reject('bare &');
    if (body in ENTITIES) return ENTITIES[body];
    const num = /^#(?:x([0-9a-fA-F]{1,6})|([0-9]{1,7}))$/.exec(body);
    if (!num) throw new Reject(`entity &${body};`);
    const code = num[1] !== undefined ? parseInt(num[1], 16) : parseInt(num[2] ?? '', 10);
    // Control characters (other than whitespace), surrogates and out-of-range values are refused.
    if (
      code > 0x10ffff ||
      (code >= 0xd800 && code <= 0xdfff) ||
      (code < 0x20 && code !== 0x9 && code !== 0xa && code !== 0xd)
    ) {
      throw new Reject('character reference');
    }
    return String.fromCodePoint(code);
  });
}

function parse(src: string): XmlElement {
  let i = 0;
  let nodes = 0;
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  let rootClosed = false;

  const expect = (s: string) => {
    if (!src.startsWith(s, i)) throw new Reject(`expected ${s}`);
    i += s.length;
  };
  const name = () => {
    NAME.lastIndex = i;
    const m = NAME.exec(src);
    if (!m) throw new Reject('name');
    i += m[0].length;
    return m[0];
  };
  const space = () => {
    SPACE.lastIndex = i;
    i += SPACE.exec(src)?.[0].length ?? 0;
  };
  const skipTo = (end: string) => {
    const at = src.indexOf(end, i);
    if (at < 0) throw new Reject(`unterminated, expected ${end}`);
    const body = src.slice(i, at);
    i = at + end.length;
    return body;
  };
  const addText = (text: string) => {
    const top = stack[stack.length - 1];
    if (!top) {
      if (text.trim() !== '') throw new Reject('text outside the root');
      return;
    }
    if (++nodes > MAX_NODES) throw new Reject('too many nodes');
    top.children.push(text);
  };

  while (i < src.length) {
    if (src.startsWith('<?', i)) {
      i += 2;
      skipTo('?>');
    } else if (src.startsWith('<!--', i)) {
      i += 4;
      skipTo('-->');
    } else if (src.startsWith('<![CDATA[', i)) {
      i += 9;
      addText(skipTo(']]>'));
    } else if (src.startsWith('<!', i)) {
      // A DOCTYPE, before the root only, and never with an internal subset (entity definitions).
      if (root !== null || !/^<!DOCTYPE\s/i.test(src.slice(i, i + 10))) throw new Reject('<!');
      const body = skipTo('>');
      if (body.includes('[')) throw new Reject('DOCTYPE internal subset');
    } else if (src.startsWith('</', i)) {
      i += 2;
      const n = name();
      space();
      expect('>');
      const open = stack.pop();
      if (!open || open.name !== n) throw new Reject(`mismatched </${n}>`);
      if (stack.length === 0) rootClosed = true;
    } else if (src[i] === '<') {
      i += 1;
      if (rootClosed) throw new Reject('a second root');
      const el: XmlElement = { name: name(), attrs: [], children: [] };
      if (++nodes > MAX_NODES) throw new Reject('too many nodes');
      const seen = new Set<string>();
      for (;;) {
        const before = i;
        space();
        if (src.startsWith('/>', i) || src[i] === '>') break;
        if (i === before) throw new Reject('attribute without space');
        const an = name();
        space();
        expect('=');
        space();
        const q = src[i];
        if (q !== '"' && q !== "'") throw new Reject('unquoted attribute');
        i += 1;
        const raw = skipTo(q);
        if (raw.includes('<')) throw new Reject('< in attribute');
        if (seen.has(an)) throw new Reject(`duplicate attribute ${an}`);
        seen.add(an);
        // XML normalizes whitespace characters in attribute values to spaces.
        el.attrs.push([an, decode(raw).replace(/[\t\n\r]/g, ' ')]);
      }
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(el);
      else if (root === null) root = el;
      else throw new Reject('a second root');
      if (src.startsWith('/>', i)) {
        i += 2;
        if (stack.length === 0) rootClosed = true;
      } else {
        i += 1;
        stack.push(el);
        if (stack.length > MAX_DEPTH) throw new Reject('too deep');
      }
    } else {
      const next = src.indexOf('<', i);
      const end = next < 0 ? src.length : next;
      addText(decode(src.slice(i, end)));
      i = end;
    }
  }
  if (root === null || stack.length > 0) throw new Reject('unclosed root');
  return root;
}

/* ───────────────────────── filter and write ───────────────────────── */

const escapeAttr = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeText = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function write(el: XmlElement, prefix: string, isRoot: boolean, out: string[]): void {
  out.push(`<${el.name}`);
  if (isRoot) out.push(` xmlns="${SVG_NS}"`);
  const kept = new Map<string, string>();
  for (const [name, value] of el.attrs) {
    // The root's size comes from its container (its viewBox keeps the aspect ratio).
    if (isRoot && (name === 'width' || name === 'height' || name === 'x' || name === 'y')) continue;
    const cleaned = cleanAttribute(el.name, name, value, prefix);
    if (cleaned === null) continue;
    // `xlink:href` is written as SVG 2's plain `href`, so no xlink namespace is needed.
    kept.set(name === 'xlink:href' ? 'href' : name, cleaned);
  }
  for (const [name, value] of kept) out.push(` ${name}="${escapeAttr(value)}"`);
  out.push('>');
  // Whitespace between elements is kept as one newline or space (and once, where a dropped
  // element left two runs side by side), so sanitizing twice changes nothing.
  let spaced = false;
  for (const child of el.children) {
    if (typeof child === 'string') {
      if (TEXT_ELEMENTS.has(el.name)) {
        out.push(escapeText(child));
        spaced = false;
      } else if (child.trim() === '' && !spaced) {
        out.push(child.includes('\n') ? '\n' : ' ');
        spaced = true;
      }
    } else if (keep(child)) {
      write(child, prefix, false, out);
      spaced = false;
    }
  }
  out.push(`</${el.name}>`);
}

/** Whether a parsed element survives: listed, not namespaced, and with a usable link if it needs one. */
function keep(el: XmlElement): boolean {
  if (!allowedElement(el.name) || el.name === 'svg') return false;
  if (el.name === 'use' || el.name === 'image') {
    const link = el.attrs.find(([n]) => n === 'href' || n === 'xlink:href');
    return link !== undefined && cleanAttribute(el.name, link[0], link[1], '') !== null;
  }
  return true;
}

/** A sanitized figure: the clean SVG text and its viewBox aspect ratio (width / height). */
export interface CleanSvg {
  svg: string;
  aspect: number | null;
}

/**
 * Sanitize figure SVG for display, or return null when it can't be shown safely (malformed, too
 * big, or not an `<svg>` root). `prefix` is added to every id and `#id` reference; it must be a
 * plain name (letters, digits, `-`, `_`).
 */
export function sanitizeSvg(input: string, prefix: string): CleanSvg | null {
  if (typeof input !== 'string' || input.length > SVG_MAX_CHARS) return null;
  if (!/^[A-Za-z][\w-]*$/.test(prefix)) return null;
  let root: XmlElement;
  try {
    root = parse(input.replace(/^\uFEFF/, ''));
  } catch (e) {
    if (e instanceof Reject) return null;
    throw e;
  }
  if (root.name !== 'svg') return null;
  const out: string[] = [];
  write(root, prefix, true, out);
  const vb = root.attrs
    .find(([n]) => n === 'viewBox')?.[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const aspect =
    vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0
      ? vb[2] / vb[3]
      : null;
  return { svg: out.join(''), aspect };
}

/* ───────────────────────── the DOM re-check ───────────────────────── */

/** The parts of a DOM node {@link verifySvgDom} uses (so it is testable without a DOM). */
export interface DomNodeLike {
  nodeType: number;
  localName?: string | null;
  namespaceURI?: string | null;
  attributes?: ArrayLike<{ name: string; value: string }>;
  childNodes: ArrayLike<DomNodeLike>;
  removeAttribute?(name: string): void;
  remove(): void;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * Re-check a parsed SVG tree in place with the sanitizer's rules (no prefixing): removes any element
 * that isn't allowed or isn't in the SVG namespace, any attribute whose value the rules would
 * change, and every non-element, non-text node. Returns how many things it removed (0 for the
 * output of {@link sanitizeSvg}).
 */
export function verifySvgDom(root: DomNodeLike): number {
  let removed = 0;
  const visit = (node: DomNodeLike, isRoot: boolean) => {
    if (node.nodeType !== ELEMENT_NODE) return;
    const name = node.localName ?? '';
    for (const attr of Array.from(node.attributes ?? [])) {
      // The sanitizer's output is already in normal form (a style attribute is written as
      // `prop: value; …`), so a value the rules would change is one it did not write.
      const ok =
        (isRoot && attr.name === 'xmlns' && attr.value === SVG_NS) ||
        (attr.name !== 'xmlns' && cleanAttribute(name, attr.name, attr.value, '') === attr.value);
      if (!ok) {
        node.removeAttribute?.(attr.name);
        removed++;
      }
    }
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === TEXT_NODE) continue;
      const ok =
        child.nodeType === ELEMENT_NODE &&
        child.namespaceURI === SVG_NS &&
        allowedElement(child.localName ?? '') &&
        child.localName !== 'svg';
      if (!ok) {
        child.remove();
        removed++;
        continue;
      }
      visit(child, false);
    }
  };
  if (root.nodeType !== ELEMENT_NODE || root.localName !== 'svg' || root.namespaceURI !== SVG_NS) {
    throw new Error('not an SVG root');
  }
  visit(root, true);
  return removed;
}

/** A PNG figure's `data:image/png;base64,` URL, or null when it is anything else. */
export function safePngDataUrl(data: unknown, maxChars = 600_000): string | null {
  if (typeof data !== 'string' || data.length > maxChars) return null;
  return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data) ? data : null;
}
