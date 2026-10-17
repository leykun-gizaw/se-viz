/**
 * Renders a parsed Markdown {@link Block} AST (from `engine/markdown.ts`) as React, using the design
 * tokens. **Safe by construction**: every text node goes through React (no `dangerouslySetInnerHTML`),
 * so raw HTML in the source is shown literally, never executed.
 *
 * Two type scales (Phase 20): `reading` (compact) and `slide` (large, for the 16:9 theory deck). The
 * scale is provided via context so block components stay prop-light. Lists may nest; fenced code
 * blocks are highlighted with `highlightC` in `.se-code` (ligatures off); callouts reuse the coach
 * variant tokens + glyph.
 */
import { createContext, useContext } from 'react';
import { tokenizeLine, type TokenType } from '../engine/highlightC.ts';
import { parseInline, type Block, type InlineNode } from '../engine/markdown.ts';
import { coachVariantMeta } from '../engine/trace/coach.ts';
import { VariantIcon } from './CoachBubble.tsx';
import { DiagramView } from './Diagram.tsx';
import { MermaidDiagram } from './MermaidDiagram.tsx';

export type MarkdownScale = 'reading' | 'slide';

interface ScaleStyles {
  h1: string;
  h2: string;
  h3: string;
  p: string;
  list: string;
  code: string;
  inlineCode: string;
  calloutLabel: string;
  calloutBody: string;
  table: string;
}

const STYLES: Record<MarkdownScale, ScaleStyles> = {
  reading: {
    h1: 'mt-10 mb-4 text-2xl font-bold text-ink',
    h2: 'mt-9 mb-3 border-b border-hairline pb-1.5 text-xl font-semibold text-ink',
    h3: 'mt-6 mb-2 text-base font-semibold text-ink',
    p: 'my-4 text-[15px] leading-7 text-ink',
    list: 'my-4 space-y-1.5 pl-6 text-[15px] leading-7 text-ink marker:text-ink-faint',
    code: 'se-code my-5 overflow-x-auto rounded-lg border border-hairline bg-surface px-4 py-3 text-[13px] leading-6 text-ink',
    inlineCode: 'se-code rounded bg-surface-2 px-1.5 py-0.5 text-[0.85em] text-ink',
    calloutLabel: 'text-[11px]',
    calloutBody: 'text-[15px]',
    table: 'w-full border-collapse text-[14px]',
  },
  slide: {
    h1: 'mb-6 text-[44px] font-bold leading-tight tracking-tight text-ink',
    h2: 'mb-5 text-[34px] font-semibold leading-snug text-ink',
    h3: 'mt-5 mb-2 text-[26px] font-semibold text-ink',
    p: 'my-4 text-[25px] leading-[1.5] text-ink',
    list: 'my-4 space-y-2.5 pl-8 text-[25px] leading-[1.45] text-ink marker:text-ink-faint',
    code: 'se-code my-5 overflow-x-auto rounded-xl border border-hairline bg-bg px-6 py-4 text-[21px] leading-[1.55] text-ink',
    inlineCode: 'se-code rounded bg-surface-2 px-1.5 py-0.5 text-[0.92em] text-ink',
    calloutLabel: 'text-[15px]',
    calloutBody: 'text-[23px] leading-snug',
    table: 'w-full border-collapse text-[22px]',
  },
};

const ScaleContext = createContext<MarkdownScale>('reading');
const useStyles = () => STYLES[useContext(ScaleContext)];

/** Where the blocks live (e.g. `"Debugging" slide 4`) — names the slide in diagram warnings. */
const PlaceContext = createContext<string | undefined>(undefined);

const C_LANGS = new Set(['', 'c', 'h', 'cpp', 'cc']);

const TOKEN_CLASS: Record<TokenType, string> = {
  keyword: 'text-kw',
  type: 'text-ty',
  fn: 'text-fn',
  string: 'text-str',
  number: 'text-num',
  comment: 'text-comment italic',
  preproc: 'text-kw',
  punct: 'text-punct',
  plain: 'text-ink',
};

function safeHref(href: string): string | null {
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (href.startsWith('#') || href.startsWith('/')) return href;
  return null; // drop javascript:, data:, etc.
}

function Inline({ nodes }: { nodes: InlineNode[] }) {
  const s = useStyles();
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'text':
            return <span key={i}>{n.value}</span>;
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-ink">
                <Inline nodes={n.children} />
              </strong>
            );
          case 'em':
            return (
              <em key={i} className="italic">
                <Inline nodes={n.children} />
              </em>
            );
          case 'code':
            return (
              <code key={i} className={s.inlineCode}>
                {n.value}
              </code>
            );
          case 'link': {
            const href = safeHref(n.href);
            if (!href) return <Inline key={i} nodes={n.children} />;
            const external = /^https?:/i.test(href);
            return (
              <a
                key={i}
                href={href}
                className="text-pointer underline decoration-pointer/40 underline-offset-2 hover:decoration-pointer"
                {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
              >
                <Inline nodes={n.children} />
              </a>
            );
          }
        }
      })}
    </>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const s = useStyles();
  const highlight = C_LANGS.has(lang.toLowerCase());
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <pre className={s.code}>
      <code>
        {lines.map((line, i) => (
          <div key={i}>
            {line === '' ? (
              ' '
            ) : highlight ? (
              tokenizeLine(line).map((t, ti) => (
                <span key={ti} className={TOKEN_CLASS[t.type]}>
                  {t.text}
                </span>
              ))
            ) : (
              <span>{line}</span>
            )}
          </div>
        ))}
      </code>
    </pre>
  );
}

function Callout({ block }: { block: Extract<Block, { type: 'callout' }> }) {
  const s = useStyles();
  const meta = coachVariantMeta(block.variant);
  return (
    <div className={`my-5 rounded-lg border ${meta.accentBorder} ${meta.accentBg} px-4 py-3`}>
      <div
        className={`mb-1.5 flex items-center gap-2 font-semibold uppercase tracking-wide ${s.calloutLabel} ${meta.accentText}`}
      >
        <span className="flex items-center justify-center">
          <VariantIcon variant={block.variant} />
        </span>
        {block.title ?? meta.label}
      </div>
      <div className={`text-ink ${s.calloutBody} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}>
        <Blocks blocks={block.children} />
      </div>
    </div>
  );
}

function ListView({ block }: { block: Extract<Block, { type: 'list' }> }) {
  const s = useStyles();
  const items = block.items.map((item, i) => (
    <li key={i}>
      <Inline nodes={item.content} />
      {item.children.length > 0 ? <Blocks blocks={item.children} /> : null}
    </li>
  ));
  return block.ordered ? (
    <ol className={`list-decimal ${s.list}`}>{items}</ol>
  ) : (
    <ul className={`list-disc ${s.list}`}>{items}</ul>
  );
}

function BlockView({ block }: { block: Block }) {
  const s = useStyles();
  const place = useContext(PlaceContext);
  switch (block.type) {
    case 'heading': {
      const inner = <Inline nodes={block.children} />;
      if (block.level <= 1) return <h1 className={s.h1}>{inner}</h1>;
      if (block.level === 2) return <h2 className={s.h2}>{inner}</h2>;
      return <h3 className={s.h3}>{inner}</h3>;
    }
    case 'paragraph':
      return (
        <p className={s.p}>
          <Inline nodes={block.children} />
        </p>
      );
    case 'list':
      return <ListView block={block} />;
    case 'blockquote':
      return (
        <blockquote className="my-4 border-l-2 border-hairline-strong pl-4 text-ink-muted italic">
          <Blocks blocks={block.children} />
        </blockquote>
      );
    case 'callout':
      return <Callout block={block} />;
    case 'code':
      return <CodeBlock lang={block.lang} code={block.code} />;
    case 'diagram':
      // Mermaid falls back to the scale-styled code block; the in-house kinds never fail here.
      return block.diagram.kind === 'mermaid' ? (
        <MermaidDiagram
          diagram={block.diagram}
          {...(place !== undefined ? { context: place } : {})}
          fallback={<CodeBlock lang="mermaid" code={block.diagram.source} />}
        />
      ) : (
        <DiagramView diagram={block.diagram} />
      );
    case 'table':
      return (
        <div className="my-5 overflow-x-auto">
          <table className={s.table}>
            <thead>
              <tr>
                {block.headers.map((cell, i) => (
                  <th
                    key={i}
                    className="border border-hairline bg-surface-2 px-3 py-1.5 text-left font-semibold text-ink"
                  >
                    <Inline nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-hairline px-3 py-1.5 text-ink">
                      <Inline nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'hr':
      return <hr className="my-8 border-hairline" />;
  }
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  );
}

/**
 * Render a parsed Markdown block list at the given type scale (`reading` or `slide`). `place`
 * optionally names where it is shown (e.g. `"Debugging" slide 4`) for render-failure warnings.
 */
export function Markdown({
  blocks,
  scale = 'reading',
  place,
}: {
  blocks: Block[];
  scale?: MarkdownScale;
  place?: string;
}) {
  return (
    <ScaleContext.Provider value={scale}>
      <PlaceContext.Provider value={place}>
        <Blocks blocks={blocks} />
      </PlaceContext.Provider>
    </ScaleContext.Provider>
  );
}

/**
 * Render one run of **inline** Markdown (code, bold, italic, links) at the reading scale — for short
 * authored strings outside a document, e.g. the step explanation panel (Phase 28).
 */
export function InlineMarkdown({ text }: { text: string }) {
  return <Inline nodes={parseInline(text)} />;
}
