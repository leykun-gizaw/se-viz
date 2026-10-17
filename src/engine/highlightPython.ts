/**
 * A tiny, dependency-free Python tokenizer for the code panel (Phase 30), the sibling of
 * `highlightC.ts`. It produces the **same token classes**, so the panel's colours mean the same in
 * both languages: keywords, types (builtin types, exceptions, class names), functions (calls,
 * builtins, `def` names), strings (every prefix, triple quotes, f-strings with their `{fields}`
 * tokenized as code), numbers (and `True` / `False` / `None`, like C's `NULL`), comments, and
 * decorators (shown like C's preprocessor lines).
 *
 * Presentation only, never parsed for meaning, so being approximate is fine.
 *
 * @packageDocumentation
 */
import type { Token, TokenType } from './highlightC.ts';

const words = (s: string) => new Set(s.split(' '));

const KEYWORDS = words(
  'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield',
);
const CONSTANTS = words('True False None');
const TYPES = words(
  'int float str bool list dict set tuple frozenset bytes bytearray complex object type range slice Exception BaseException ValueError TypeError KeyError IndexError NameError ZeroDivisionError AttributeError RuntimeError StopIteration RecursionError',
);
const BUILTINS = words(
  'print len input abs all any enumerate filter format getattr hasattr id isinstance iter map max min next open ord chr pow repr reversed round setattr sorted sum super zip',
);

const IDENT = /^[A-Za-z_]\w*/;
const NUMBER =
  /^(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?[jJ]?)/;
const STRING_START = /^([rRbBuUfFtT]{0,2})("""|'''|"|')/;
const DECORATOR = /^(\s*)(@[\w.]+)/;

/** An unterminated triple-quoted string carried onto the next line. */
export interface PyLineState {
  quote: '"""' | "'''";
}

/**
 * The end of a string body starting at `from`: the index just past the closing quote, or `-1` if
 * the line ends first. Backslash escapes are skipped (raw strings too, which is close enough).
 */
function stringEnd(line: string, from: number, quote: string): number {
  for (let j = from; j < line.length; j++) {
    if (line[j] === '\\') j++;
    else if (line.startsWith(quote, j)) return j + quote.length;
  }
  return -1;
}

/** The index of the `}` closing the replacement field opened just before `from`, or `-1`. */
function fieldEnd(text: string, from: number): number {
  let depth = 0;
  for (let j = from; j < text.length; j++) {
    const ch = text[j];
    if (ch === "'" || ch === '"') {
      const end = stringEnd(text, j + 1, ch);
      if (end === -1) return -1;
      j = end - 1;
    } else if ('([{'.includes(ch)) depth++;
    else if (')]'.includes(ch)) depth--;
    else if (ch === '}') {
      if (depth === 0) return j;
      depth--;
    }
  }
  return -1;
}

/** Where a replacement field's `!conversion` / `:format spec` starts (top level only), else its length. */
function specStart(field: string): number {
  let depth = 0;
  for (let j = 0; j < field.length; j++) {
    const ch = field[j];
    if (ch === "'" || ch === '"') {
      const end = stringEnd(field, j + 1, ch);
      if (end === -1) break;
      j = end - 1;
    } else if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (depth === 0 && (ch === '!' || ch === ':') && field[j + 1] !== '=') return j;
  }
  return field.length;
}

/** An f-string's text split into literal runs (`string`) and `{field}`s tokenized as code. */
function fString(text: string, out: Token[]): void {
  let lit = '';
  const flush = () => {
    if (lit) out.push({ text: lit, type: 'string' });
    lit = '';
  };
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{' || two === '}}') {
      lit += two;
      i++;
      continue;
    }
    const end = text[i] === '{' ? fieldEnd(text, i + 1) : -1;
    if (end === -1) {
      lit += text[i];
      continue;
    }
    flush();
    out.push({ text: '{', type: 'punct' });
    // `{value!r:>8}`: the conversion and format spec read as string, the expression as code.
    const field = text.slice(i + 1, end);
    const expr = field.slice(0, specStart(field));
    out.push(...tokenizeCode(expr).tokens);
    if (expr.length < field.length) out.push({ text: field.slice(expr.length), type: 'string' });
    out.push({ text: '}', type: 'punct' });
    i = end;
  }
  flush();
}

/**
 * Tokenize code that starts outside any string. `open` is the quote of a triple-quoted string left
 * open at the end of the line.
 */
function tokenizeCode(line: string): { tokens: Token[]; open: PyLineState | null } {
  const tokens: Token[] = [];
  let open: PyLineState | null = null;
  let prevWord = '';
  let i = 0;
  const deco = DECORATOR.exec(line);
  if (deco) {
    if (deco[1]) tokens.push({ text: deco[1], type: 'plain' });
    tokens.push({ text: deco[2], type: 'preproc' });
    i = deco[0].length;
  }
  while (i < line.length) {
    const rest = line.slice(i);
    if (rest[0] === '#') {
      tokens.push({ text: rest, type: 'comment' });
      break;
    }
    const ws = /^\s+/.exec(rest);
    if (ws) {
      tokens.push({ text: ws[0], type: 'plain' });
      i += ws[0].length;
      continue;
    }
    const str = STRING_START.exec(rest);
    if (str) {
      const [start, prefix, quote] = str;
      const end = stringEnd(rest, start.length, quote);
      const text = end === -1 ? rest : rest.slice(0, end);
      if (end === -1 && quote.length === 3) open = { quote: quote as PyLineState['quote'] };
      if (/[fFtT]/.test(prefix)) {
        tokens.push({ text: start, type: 'string' });
        const closed = end === -1 ? '' : quote;
        fString(text.slice(start.length, text.length - closed.length), tokens);
        if (closed) tokens.push({ text: closed, type: 'string' });
      } else {
        tokens.push({ text, type: 'string' });
      }
      i += text.length;
      prevWord = '';
      continue;
    }
    const num = NUMBER.exec(rest);
    if (num && num[0] !== '.') {
      tokens.push({ text: num[0], type: 'number' });
      i += num[0].length;
      continue;
    }
    const id = IDENT.exec(rest);
    if (id) {
      const word = id[0];
      let type: TokenType;
      if (KEYWORDS.has(word)) type = 'keyword';
      else if (CONSTANTS.has(word)) type = 'number';
      else if (prevWord === 'def') type = 'fn';
      else if (prevWord === 'class' || TYPES.has(word)) type = 'type';
      else if (BUILTINS.has(word) || /^\s*\(/.test(rest.slice(word.length))) type = 'fn';
      else type = 'plain';
      tokens.push({ text: word, type });
      prevWord = word;
      i += word.length;
      continue;
    }
    tokens.push({ text: rest[0], type: 'punct' });
    prevWord = '';
    i += 1;
  }
  return { tokens, open };
}

/**
 * Tokenize one line of Python. Pass the state returned for the previous line to continue a
 * triple-quoted string that spans lines; the returned state is `null` once the string is closed.
 *
 * @param line - One line of source (no trailing newline).
 * @param state - The previous line's carried state, if any.
 */
export function tokenizePythonLine(
  line: string,
  state: PyLineState | null = null,
): { tokens: Token[]; state: PyLineState | null } {
  const tokens: Token[] = [];
  let rest = line;
  if (state) {
    const end = stringEnd(line, 0, state.quote);
    if (end === -1) return { tokens: line ? [{ text: line, type: 'string' }] : [], state };
    tokens.push({ text: line.slice(0, end), type: 'string' });
    rest = line.slice(end);
  }
  const code = tokenizeCode(rest);
  tokens.push(...code.tokens);
  return { tokens, state: code.open };
}

/** Tokenize a whole Python source, one token list per line (multi-line strings carried). */
export function tokenizePython(source: string): Token[][] {
  let state: PyLineState | null = null;
  return source.split('\n').map((line) => {
    const r = tokenizePythonLine(line, state);
    state = r.state;
    return r.tokens;
  });
}
