/**
 * A tiny, dependency-free C tokenizer for the code panel. It produces just enough token classes to
 * match the design's syntax coloring (keywords, types, function names, strings, numbers, comments).
 * It is presentation-only — never parsed for meaning — so being approximate is fine.
 *
 * Ligatures are disabled in the panel via CSS (`.se-code`), so multi-character operators render
 * literally; this tokenizer keeps punctuation as-is and never substitutes glyphs.
 *
 * @packageDocumentation
 */

/** Token class → maps to a `--color-*` token in the stylesheet. */
export type TokenType =
  | 'keyword'
  | 'type'
  | 'fn'
  | 'string'
  | 'number'
  | 'comment'
  | 'preproc'
  | 'punct'
  | 'plain';

/** A contiguous run of source with one {@link TokenType}. */
export interface Token {
  text: string;
  type: TokenType;
}

const TYPE_WORDS = new Set([
  'int',
  'char',
  'void',
  'unsigned',
  'signed',
  'short',
  'long',
  'float',
  'double',
  'struct',
  'enum',
  'union',
  'size_t',
]);

const KEYWORDS = new Set([
  'return',
  'while',
  'for',
  'if',
  'else',
  'do',
  'switch',
  'case',
  'default',
  'break',
  'continue',
  'typedef',
  'sizeof',
  'const',
  'static',
  'goto',
]);

const CONSTANTS = new Set(['NULL', 'true', 'false']);

const IDENT = /[A-Za-z_]\w*/y;
const NUMBER = /0[xX][0-9a-fA-F]+|\d+\.?\d*/y;
const WS = /\s+/y;

/**
 * Tokenize a single line of C source. Handles line comments, single-line block comments, string
 * and char literals, `#` preprocessor lines, numbers, identifiers (with function-name detection),
 * and punctuation. Multi-line block comments are not tracked across lines (fixtures don't use them).
 *
 * @param line - One line of source (no trailing newline).
 * @returns The ordered tokens covering the whole line.
 */
export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  // Whole-line preprocessor directive.
  if (/^\s*#/.test(line)) {
    return [{ text: line, type: 'preproc' }];
  }

  while (i < line.length) {
    const rest = line.slice(i);

    // Line comment to end of line.
    if (rest.startsWith('//')) {
      tokens.push({ text: rest, type: 'comment' });
      break;
    }
    // Single-line block comment.
    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/');
      const text = end === -1 ? rest : rest.slice(0, end + 2);
      tokens.push({ text, type: 'comment' });
      i += text.length;
      continue;
    }
    // String / char literal.
    if (rest[0] === '"' || rest[0] === "'") {
      const quote = rest[0];
      let j = 1;
      while (j < rest.length && rest[j] !== quote) {
        if (rest[j] === '\\') j++;
        j++;
      }
      const text = rest.slice(0, Math.min(j + 1, rest.length));
      tokens.push({ text, type: 'string' });
      i += text.length;
      continue;
    }
    // Whitespace.
    WS.lastIndex = 0;
    const ws = WS.exec(rest);
    if (ws) {
      tokens.push({ text: ws[0], type: 'plain' });
      i += ws[0].length;
      continue;
    }
    // Number.
    NUMBER.lastIndex = 0;
    const num = NUMBER.exec(rest);
    if (num && num.index === 0) {
      tokens.push({ text: num[0], type: 'number' });
      i += num[0].length;
      continue;
    }
    // Identifier / keyword / type / function.
    IDENT.lastIndex = 0;
    const id = IDENT.exec(rest);
    if (id && id.index === 0) {
      const word = id[0];
      const after = rest.slice(word.length).match(/^\s*\(/);
      let type: TokenType;
      if (TYPE_WORDS.has(word)) type = 'type';
      else if (KEYWORDS.has(word)) type = 'keyword';
      else if (CONSTANTS.has(word)) type = 'number';
      else if (after) type = 'fn';
      else type = 'plain';
      tokens.push({ text: word, type });
      i += word.length;
      continue;
    }
    // Single punctuation char.
    tokens.push({ text: rest[0], type: 'punct' });
    i += 1;
  }

  return tokens;
}
