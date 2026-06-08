/**
 * Renders a parsed Markdown {@link Block} AST (from `engine/markdown.ts`) as React, using the design
 * tokens for comfortable reading. **Safe by construction**: every text node goes through React (no
 * `dangerouslySetInnerHTML`), so raw HTML in the source is shown literally, never executed.
 *
 * - Headings map to the h1–h3 scale; prose sits at a comfortable measure/line-height (set by the
 *   reading view's column width).
 * - Fenced code blocks are highlighted with `highlightC` and rendered in `.se-code` (ligatures off).
 * - Callouts reuse the coach variant tokens + glyph, so theory and in-viz coaching look alike.
 * - Links are sanitised to http(s)/mailto/in-page targets; anything else renders as plain text.
 */
import { tokenizeLine, type TokenType } from '../engine/highlightC.ts';
import type { Block, InlineNode } from '../engine/markdown.ts';
import { coachVariantMeta } from '../engine/trace/coach.ts';
import { VariantIcon } from './CoachBubble.tsx';

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

/** Languages we syntax-highlight with the C tokenizer; others render as plain monospace. */
const C_LANGS = new Set(['', 'c', 'h', 'cpp', 'cc']);

function safeHref(href: string): string | null {
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (href.startsWith('#') || href.startsWith('/')) return href;
  return null; // drop javascript:, data:, etc.
}

function Inline({ nodes }: { nodes: InlineNode[] }) {
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
              <code
                key={i}
                className="se-code rounded bg-surface-2 px-1.5 py-0.5 text-[0.85em] text-ink"
              >
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
  const highlight = C_LANGS.has(lang.toLowerCase());
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <pre className="se-code my-5 overflow-x-auto rounded-lg border border-hairline bg-surface px-4 py-3 text-[13px] leading-6 text-ink">
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
  const meta = coachVariantMeta(block.variant);
  return (
    <div className={`my-5 rounded-lg border ${meta.accentBorder} ${meta.accentBg} px-4 py-3`}>
      <div
        className={`mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide ${meta.accentText}`}
      >
        <span className="flex h-5 w-5 items-center justify-center">
          <VariantIcon variant={block.variant} />
        </span>
        {block.title ?? meta.label}
      </div>
      <div className="text-ink [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <Blocks blocks={block.children} />
      </div>
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const inner = <Inline nodes={block.children} />;
      if (block.level <= 1)
        return <h1 className="mt-10 mb-4 text-2xl font-bold text-ink">{inner}</h1>;
      if (block.level === 2)
        return (
          <h2 className="mt-9 mb-3 border-b border-hairline pb-1.5 text-xl font-semibold text-ink">
            {inner}
          </h2>
        );
      return <h3 className="mt-6 mb-2 text-base font-semibold text-ink">{inner}</h3>;
    }
    case 'paragraph':
      return (
        <p className="my-4 text-[15px] leading-7 text-ink">
          <Inline nodes={block.children} />
        </p>
      );
    case 'list': {
      const cls = 'my-4 space-y-1.5 pl-6 text-[15px] leading-7 text-ink marker:text-ink-faint';
      const items = block.items.map((item, i) => (
        <li key={i}>
          <Inline nodes={item} />
        </li>
      ));
      return block.ordered ? (
        <ol className={`list-decimal ${cls}`}>{items}</ol>
      ) : (
        <ul className={`list-disc ${cls}`}>{items}</ul>
      );
    }
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
    case 'table':
      return (
        <div className="my-5 overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
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

/** Render a parsed Markdown block list. */
export function Markdown({ blocks }: { blocks: Block[] }) {
  return <Blocks blocks={blocks} />;
}
