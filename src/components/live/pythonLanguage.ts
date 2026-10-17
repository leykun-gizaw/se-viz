/**
 * The Python editor's language mode (Phase 31): `@codemirror/lang-python`, plus the few Python
 * highlight tags the shared editor style doesn't color, mapped onto the same `--se-syntax-*` tokens
 * the read-only Python code panel (`highlightPython.ts`) uses: `True` / `False` / `None` as numbers,
 * class names as types, method calls as functions. Only the Python view imports this, so the
 * grammar never lands in the main chunk or the C editor's chunk.
 */
import { python } from '@codemirror/lang-python';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const PYTHON_LANGUAGE = python();

export const PYTHON_EXTRAS = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [tags.bool, tags.null], color: 'var(--se-syntax-number)' },
    { tag: [tags.className, tags.definition(tags.className)], color: 'var(--se-syntax-type)' },
    { tag: tags.function(tags.propertyName), color: 'var(--se-syntax-fn)' },
  ]),
);
