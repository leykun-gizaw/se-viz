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

/** One frame in a `call-stack` diagram (rendered top→bottom in declared order; newest at bottom). */
export interface CallStackFrame {
  label: string;
  fields: string[];
  active: boolean;
}

/** One node in a `call-tree` diagram; `repeat` marks a recomputed subproblem (e.g. `fib(2)` twice). */
export interface CallTreeNode {
  label: string;
  repeat: boolean;
  children: CallTreeNode[];
}

/**
 * One node in a `pipeline` diagram (Phase 26). Echoes the Phase 11/12 Build-pipeline view: an
 * `artifact` is a file on disk (`main.c`, `libshapes.a`), a `process` is a tool run (`cc -c`, `ar`).
 * `stage` picks the column; `highlight` paints the node and its outgoing edges amber; `accent` is the
 * final-product teal the visualization gives `app`.
 */
export interface PipelineDiagramNode {
  id: string;
  kind: 'artifact' | 'process';
  label: string;
  sublabel: string | null;
  stage: number;
  highlight: boolean;
  accent: boolean;
}

/** A directed `pipeline` edge between two declared node ids. */
export interface PipelineDiagramEdge {
  from: string;
  to: string;
}

/** One symbol in a `symbol-table` section; `unresolved` (needs only) renders in the danger style. */
export interface SymbolEntry {
  name: string;
  unresolved: boolean;
}

/** One file box in a `symbol-table` diagram: its name, column, and two symbol sections. */
export interface SymbolFile {
  name: string;
  column: number;
  defines: SymbolEntry[];
  needs: SymbolEntry[];
}

/** A symbol reference `file:symbol`. */
export interface SymbolRef {
  file: string;
  symbol: string;
}

/** A resolve edge from a `needs` entry to a `defines` entry; `failed` draws it broken (danger, dashed). */
export interface SymbolEdge {
  from: SymbolRef;
  to: SymbolRef;
  failed: boolean;
}

/**
 * A declarative, in-house diagram (Phase 22) — parsed from a fenced block (` ```call-stack ` /
 * ` ```call-tree ` / ` ```pipeline ` / ` ```symbol-table `) to a typed spec, rendered to **SVG with
 * the design tokens** by the renderer (never raw HTML). Extend by adding a `kind` here + a case in
 * `parseDiagram` + the renderer.
 */
export type Diagram =
  | { kind: 'call-stack'; caption: string | null; frames: CallStackFrame[] }
  | { kind: 'call-tree'; caption: string | null; root: CallTreeNode | null }
  | {
      kind: 'pipeline';
      caption: string | null;
      nodes: PipelineDiagramNode[];
      edges: PipelineDiagramEdge[];
    }
  | { kind: 'symbol-table'; caption: string | null; files: SymbolFile[]; edges: SymbolEdge[] };

/** Block (paragraph-level) node. */
export type Block =
  | { type: 'heading'; level: number; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'callout'; variant: CoachVariant; title: string | null; children: Block[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'diagram'; diagram: Diagram }
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
const FENCE = /^```([\w-]*)\s*$/;
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

/** Fenced info-strings handled as in-house diagrams rather than code (Phase 22). Extend here. */
export const DIAGRAM_LANGS = new Set(['call-stack', 'call-tree', 'pipeline', 'symbol-table']);

const CAPTION = /^caption:\s*(.*)$/i;

/** Parse a `call-stack` body: an optional `caption:` line, then one `frame` per line. */
function parseCallStack(body: string): Diagram {
  let caption: string | null = null;
  const frames: CallStackFrame[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const cap = line.match(/^caption:\s*(.*)$/i);
    if (cap) {
      caption = cap[1].trim();
      continue;
    }
    const parts = line.split('|').map((p) => p.trim());
    const label = parts[0];
    if (!label) continue;
    const fields: string[] = [];
    let active = false;
    for (const p of parts.slice(1)) {
      if (p.toLowerCase() === 'active') active = true;
      else if (p) fields.push(p);
    }
    frames.push({ label, fields, active });
  }
  return { kind: 'call-stack', caption, frames };
}

/** Parse a `call-tree` body: indentation (2 spaces/level) is parent→child; a trailing `*` = repeat. */
function parseCallTree(body: string): Diagram {
  let caption: string | null = null;
  let root: CallTreeNode | null = null;
  const stack: { node: CallTreeNode; indent: number }[] = [];
  for (const raw of body.replace(/\t/g, '  ').split('\n')) {
    if (raw.trim() === '') continue;
    const cap = raw.trim().match(/^caption:\s*(.*)$/i);
    if (cap) {
      caption = cap[1].trim();
      continue;
    }
    const indent = indentOf(raw);
    let label = raw.trim();
    const repeat = /\s\*$/.test(label);
    if (repeat) label = label.replace(/\s*\*$/, '').trim();
    const node: CallTreeNode = { label, repeat, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length === 0) {
      if (root === null) root = node; // first top-level node is the root
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ node, indent });
  }
  return { kind: 'call-tree', caption, root };
}

/**
 * Parse a `pipeline` body (Phase 26). Line types, in any order:
 * - `caption: …`
 * - a **node** (has a `|`): `ID[: LABEL] | part | part …`, where each part is a keyword — `artifact`
 *   (default) / `process`, `@N` (the stage/column, required), `highlight`, `accent` — or at most one
 *   free-text sublabel. `LABEL` defaults to `ID`.
 * - an **edge** chain: `a -> b` (or `a -> b -> c`), between declared ids.
 *
 * Strict: any unrecognized line, a missing stage, a duplicate id, or an edge to an unknown id makes
 * the whole block malformed (`null`), so it falls back to a visible code block for the author to fix.
 */
function parsePipeline(body: string): Diagram | null {
  let caption: string | null = null;
  const nodes: PipelineDiagramNode[] = [];
  const edges: PipelineDiagramEdge[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const cap = line.match(CAPTION);
    if (cap) {
      caption = cap[1].trim();
      continue;
    }
    if (line.includes('|')) {
      const [head, ...parts] = line.split('|').map((p) => p.trim());
      const named = head.match(/^(\S+?):\s+(.+)$/);
      const id = named ? named[1] : head;
      if (!id || /\s/.test(id)) return null;
      const node: PipelineDiagramNode = {
        id,
        kind: 'artifact',
        label: named ? named[2].trim() : id,
        sublabel: null,
        stage: -1,
        highlight: false,
        accent: false,
      };
      for (const part of parts) {
        const key = part.toLowerCase();
        const stage = part.match(/^@(\d+)$/);
        if (key === 'artifact' || key === 'process') node.kind = key;
        else if (stage) node.stage = Number(stage[1]);
        else if (key === 'highlight') node.highlight = true;
        else if (key === 'accent') node.accent = true;
        else if (part === '') continue;
        else if (node.sublabel === null) node.sublabel = part;
        else return null; // two free-text parts: ambiguous
      }
      if (node.stage < 0) return null;
      nodes.push(node);
      continue;
    }
    if (line.includes('->')) {
      const ids = line.split('->').map((p) => p.trim());
      if (ids.some((p) => p === '')) return null;
      for (let k = 0; k + 1 < ids.length; k++) edges.push({ from: ids[k], to: ids[k + 1] });
      continue;
    }
    return null;
  }
  const ids = new Set(nodes.map((n) => n.id));
  if (nodes.length === 0 || ids.size !== nodes.length) return null;
  if (edges.some((e) => !ids.has(e.from) || !ids.has(e.to))) return null;
  return { kind: 'pipeline', caption, nodes, edges };
}

/** Split `file:symbol` at the **last** colon (file names like `libshapes.a(circle.o)` have none). */
function parseSymbolRef(text: string): SymbolRef | null {
  const at = text.lastIndexOf(':');
  if (at <= 0 || at === text.length - 1) return null;
  return { file: text.slice(0, at).trim(), symbol: text.slice(at + 1).trim() };
}

/**
 * Parse a `symbol-table` body (Phase 26). Line types:
 * - `caption: …`
 * - `file NAME [@N]` — starts a file box; `@N` is its column (default: its declaration index), and
 *   boxes sharing a column stack vertically.
 * - `defines: a, b` / `needs: a, b!` — that box's symbols; a trailing `!` marks an **unresolved**
 *   need (danger style). Only `needs` entries may be unresolved.
 * - `FILE:SYM -> FILE:SYM` — a resolve edge, from a `needs` entry to another box's `defines` entry;
 *   `-x` instead of `->` draws it **failed** (dashed danger, crossed out).
 *
 * Strict like {@link parsePipeline}: anything unrecognized or dangling makes the block `null`.
 */
function parseSymbolTable(body: string): Diagram | null {
  let caption: string | null = null;
  const files: SymbolFile[] = [];
  const edges: SymbolEdge[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const cap = line.match(CAPTION);
    if (cap) {
      caption = cap[1].trim();
      continue;
    }
    const file = line.match(/^file\s+(\S+)(?:\s+@(\d+))?$/);
    if (file) {
      files.push({
        name: file[1],
        column: file[2] !== undefined ? Number(file[2]) : files.length,
        defines: [],
        needs: [],
      });
      continue;
    }
    const section = line.match(/^(defines|needs):\s*(.*)$/i);
    if (section) {
      const current = files[files.length - 1];
      if (!current) return null;
      const isNeeds = section[1].toLowerCase() === 'needs';
      for (const item of section[2].split(',').map((s) => s.trim())) {
        if (item === '') continue;
        const unresolved = item.endsWith('!');
        const name = unresolved ? item.slice(0, -1).trim() : item;
        if (!name || /\s/.test(name) || (unresolved && !isNeeds)) return null;
        (isNeeds ? current.needs : current.defines).push({ name, unresolved });
      }
      continue;
    }
    const edge = line.match(/^(\S+)\s+-(>|x)\s+(\S+)$/);
    if (edge) {
      const from = parseSymbolRef(edge[1]);
      const to = parseSymbolRef(edge[3]);
      if (!from || !to) return null;
      edges.push({ from, to, failed: edge[2] === 'x' });
      continue;
    }
    return null;
  }
  const byName = new Map(files.map((f) => [f.name, f]));
  if (files.length === 0 || byName.size !== files.length) return null;
  for (const e of edges) {
    const src = byName.get(e.from.file);
    const dst = byName.get(e.to.file);
    if (!src || !dst || src === dst) return null;
    if (!src.needs.some((s) => s.name === e.from.symbol)) return null;
    if (!dst.defines.some((s) => s.name === e.to.symbol)) return null;
  }
  return { kind: 'symbol-table', caption, files, edges };
}

/**
 * Parse a fenced diagram block by its info-string into a typed {@link Diagram}. Returns `null` when a
 * strict (Phase 26) kind is malformed — the caller then keeps the fence as a plain code block. The
 * Phase 22 kinds are lenient and never return `null`.
 */
export function parseDiagram(lang: string, body: string): Diagram | null {
  switch (lang) {
    case 'pipeline':
      return parsePipeline(body);
    case 'symbol-table':
      return parseSymbolTable(body);
    case 'call-tree':
      return parseCallTree(body);
    case 'call-stack':
    default:
      return parseCallStack(body);
  }
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
      const body = code.join('\n');
      const diagram = DIAGRAM_LANGS.has(fence[1]) ? parseDiagram(fence[1], body) : null;
      if (diagram) {
        blocks.push({ type: 'diagram', diagram });
      } else {
        blocks.push({ type: 'code', lang: fence[1], code: body });
      }
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
