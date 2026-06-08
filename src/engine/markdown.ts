/**
 * A tiny, dependency-free Markdown engine for the theory reading view (Phase 19). It parses a
 * **deliberately small, documented subset** of Markdown into a typed AST that a React component
 * renders — never to an HTML string — so the output is **safe by construction** (no `dangerouslySet
 * InnerHTML`, raw HTML in the source is treated as literal text and escaped by React).
 *
 * Supported, and only this (see `docs/THEORY_AUTHORING.md`):
 * - YAML-ish frontmatter (`---` … `---`, flat `key: value`) via {@link parseFrontmatter}.
 * - Block: headings (`#`–`####`), paragraphs, unordered/ordered lists, blockquotes, **callouts**
 *   (`> [!idea]` …, mapped to the coach variants), fenced code blocks (```c … ```), GFM pipe
 *   tables, and horizontal rules.
 * - Inline: `**bold**`, `*italic*`, `` `code` ``, and `[text](href)` links.
 *
 * Underscores are intentionally NOT emphasis markers, so C identifiers like `node_t` read literally.
 *
 * @packageDocumentation
 */
import type { CoachVariant } from './trace/types.ts';

/** Inline (span-level) node. */
export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: InlineNode[] };

/** One list item: its own inline content plus any nested blocks (e.g. a sub-list). */
export interface ListItem {
  content: InlineNode[];
  children: Block[];
}

/** Block (paragraph-level) node. */
export type Block =
  | { type: 'heading'; level: number; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'callout'; variant: CoachVariant; title: string | null; children: Block[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; headers: InlineNode[][]; rows: InlineNode[][][] }
  | { type: 'hr' };

/** Frontmatter + body split. */
export interface Frontmatter {
  data: Record<string, string>;
  body: string;
}

/**
 * Split a `---`-delimited frontmatter block off the top of a document. Each frontmatter line is a
 * flat `key: value` (optionally quoted); nested YAML is not supported (and not needed). When there
 * is no frontmatter the whole input is returned as `body`.
 */
export function parseFrontmatter(raw: string): Frontmatter {
  const text = raw.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return { data: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: text };

  const data: Record<string, string> = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[m[1]] = value;
  }
  const body = text.slice(end + 4).replace(/^\n+/, '');
  return { data, body };
}

/**
 * Split a theory body into slides on a **top-level `---`** thematic break (Phase 20). The `---` is a
 * deck separator, never a rendered horizontal rule inside a slide. Separators inside fenced code
 * blocks are ignored, and empty slides (including trailing ones) are dropped — so a deck has ≥1
 * slide. A body with no `---` is a single slide.
 */
export function splitSlides(src: string): string[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const slides: string[] = [];
  let current: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^---\s*$/.test(line)) {
      slides.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(line);
  }
  slides.push(current.join('\n'));
  return slides.map((s) => s.trim()).filter((s) => s.length > 0);
}

const CALLOUT_VARIANTS: Record<string, CoachVariant> = {
  idea: 'idea',
  'watch-out': 'watch-out',
  predict: 'predict',
  recap: 'recap',
};

const LIST_ITEM = /^\s*([-*+]|\d+\.)\s+/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^```(\w*)\s*$/;
const HR = /^(-{3,}|\*{3,}|_{3,})\s*$/;

/** Does a line start a non-paragraph block? Used to stop greedy paragraph gathering. */
function startsBlock(line: string): boolean {
  return (
    HEADING.test(line) ||
    FENCE.test(line) ||
    HR.test(line) ||
    /^>\s?/.test(line) ||
    LIST_ITEM.test(line)
  );
}

/** Split a GFM table row into trimmed cell strings (surrounding pipes optional). */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

const TABLE_SEP = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

/** Parse inline markup within a single run of text. */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buf = '';
  let i = 0;
  const flush = () => {
    if (buf) {
      nodes.push({ type: 'text', value: buf });
      buf = '';
    }
  };

  while (i < text.length) {
    const c = text[i];

    if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        nodes.push({ type: 'code', value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (c === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        nodes.push({ type: 'strong', children: parseInline(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (c === '*') {
      const end = text.indexOf('*', i + 1);
      if (end > i + 1) {
        flush();
        nodes.push({ type: 'em', children: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (c === '[') {
      const close = text.indexOf(']', i + 1);
      if (close !== -1 && text[close + 1] === '(') {
        const paren = text.indexOf(')', close + 2);
        if (paren !== -1) {
          flush();
          nodes.push({
            type: 'link',
            href: text.slice(close + 2, paren),
            children: parseInline(text.slice(i + 1, close)),
          });
          i = paren + 1;
          continue;
        }
      }
    }

    buf += c;
    i++;
  }
  flush();
  return nodes;
}

/** Parse `>`-stripped lines into a callout (when the first line is `[!variant] …`) or a blockquote. */
function parseQuote(quoteLines: string[]): Block {
  const first = quoteLines[0] ?? '';
  const m = first.match(/^\[!([\w-]+)\]\s*(.*)$/);
  if (m && CALLOUT_VARIANTS[m[1].toLowerCase()]) {
    const title = m[2].trim();
    return {
      type: 'callout',
      variant: CALLOUT_VARIANTS[m[1].toLowerCase()],
      title: title.length > 0 ? title : null,
      children: parseMarkdown(quoteLines.slice(1).join('\n')),
    };
  }
  return { type: 'blockquote', children: parseMarkdown(quoteLines.join('\n')) };
}

/** Leading-whitespace width of a line (spaces; tabs count as one — author with spaces). */
function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Parse a list (and any **nested** lists) starting at `start`, by indentation. Items at the list's
 * base indent are siblings; a more-indented run of items becomes a nested list on the item above it;
 * a more-indented non-item line is a lazy continuation of the current item. Returns the list block
 * and the index of the first line after it.
 */
function parseListAt(lines: string[], start: number): { block: Block; next: number } {
  const baseIndent = indentOf(lines[start]);
  const ordered = /^\s*\d+\.\s+/.test(lines[start]);
  const items: ListItem[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') break;
    const ind = indentOf(line);
    if (ind !== baseIndent || !LIST_ITEM.test(line)) break;

    const m = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/);
    let content = parseInline(m ? m[1] : line);
    i++;
    const children: Block[] = [];

    // More-indented following lines belong to this item: nested lists or continuation text.
    while (i < lines.length && lines[i].trim() !== '' && indentOf(lines[i]) > baseIndent) {
      if (LIST_ITEM.test(lines[i])) {
        const sub = parseListAt(lines, i);
        children.push(sub.block);
        i = sub.next;
      } else {
        content = [...content, { type: 'text', value: ' ' }, ...parseInline(lines[i].trim())];
        i++;
      }
    }
    items.push({ content, children });
  }

  return { block: { type: 'list', ordered, items }, next: i };
}

/**
 * Parse the supported Markdown subset into a {@link Block} list. Pure and side-effect free.
 *
 * @param src - Markdown body (frontmatter already stripped).
 */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: 'code', lang: fence[1], code: code.join('\n') });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        children: parseInline(heading[2].trim()),
      });
      i++;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(parseQuote(quote));
      continue;
    }

    // GFM table: a header row followed by a separator row of dashes.
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const headers = splitRow(line).map(parseInline);
      i += 2;
      const rows: InlineNode[][][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]).map(parseInline));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const { block, next } = parseListAt(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }

    // Paragraph: gather consecutive lines until a blank line or a new block start.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) });
  }

  return blocks;
}
