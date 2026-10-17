/**
 * Small text helpers for derived explanations (Phase 32). Derived sentences are inline Markdown, and
 * every value, name and piece of code from the program goes inside a `code` span, so nothing a
 * program prints or names can turn into emphasis or a link.
 *
 * @packageDocumentation
 */

/**
 * Marks a sentence that can't be shown faithfully (a value holding a backtick can't sit in a code
 * span); {@link sentences} drops it. Leaving a fact out is always allowed; showing it wrong is not.
 */
const UNSHOWABLE = '\u0000';

/** `text` as an inline code span. */
export function code(text: string): string {
  if (text.includes('`') || text.includes(UNSHOWABLE)) return UNSHOWABLE;
  return `\`${text}\``;
}

/** Keep the real sentences: drop empty ones and any that hold an unshowable value. */
export function sentences(items: readonly (string | null | undefined | false)[]): string[] {
  const out: string[] = [];
  for (const s of items) {
    if (typeof s === 'string' && s !== '' && !s.includes(UNSHOWABLE) && !out.includes(s)) {
      out.push(s);
    }
  }
  return out;
}

/** "line 5" or "lines 6–7". */
export function lineRange(first: number, last: number): string {
  return first === last ? `line ${first}` : `lines ${first}–${last}`;
}

/** "is" for one line, "are" for several. */
export function isAre(first: number, last: number): string {
  return first === last ? 'is' : 'are';
}

/** "1 iteration", "3 iterations". */
export function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Upper-case the first letter (a sentence that starts with a code span is left alone). */
export function capitalize(s: string): string {
  return s.length > 0 && s[0] !== '`' ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Inline Markdown → plain text, for the one-line narration (code spans lose their backticks). */
export function plain(markdown: string): string {
  return markdown.replace(/`([^`]*)`/g, '$1');
}
