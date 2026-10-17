/**
 * Putting a sanitized figure SVG into the page (Phase 36): parsed with `DOMParser` as
 * `image/svg+xml` (an XML parse: no HTML parsing quirks, scripts never run), re-checked with the
 * sanitizer's rules ({@link verifySvgDom}), then imported into the container with `importNode` /
 * `replaceChildren`. Never `innerHTML`, never `dangerouslySetInnerHTML`.
 *
 * @packageDocumentation
 */
import { sanitizeSvg, SVG_NS, verifySvgDom, type DomNodeLike } from './sanitizeSvg.ts';

let mounts = 0;

/** A fresh id prefix per mounted copy, so copies never share (or clobber) ids. */
export function nextFigurePrefix(figureId: string): string {
  mounts += 1;
  return `sv${mounts}-${figureId.replace(/[^\w-]/g, '')}-`;
}

/**
 * Sanitize `svgText` and mount it as the only child of `container`. Returns false (and empties the
 * container) when the figure can't be shown safely.
 */
export function mountSvg(container: Element, svgText: string, prefix: string): boolean {
  const clean = sanitizeSvg(svgText, prefix);
  if (!clean) {
    container.replaceChildren();
    return false;
  }
  const doc = new DOMParser().parseFromString(clean.svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (
    doc.getElementsByTagName('parsererror').length > 0 ||
    root.namespaceURI !== SVG_NS ||
    root.localName !== 'svg'
  ) {
    container.replaceChildren();
    return false;
  }
  verifySvgDom(root as unknown as DomNodeLike);
  root.setAttribute('role', 'img');
  container.replaceChildren(container.ownerDocument.importNode(root, true));
  return true;
}
