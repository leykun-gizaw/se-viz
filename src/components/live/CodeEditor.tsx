/**
 * The Live Coding source editor — CodeMirror 6 with a language mode passed in by the caller (C/C++
 * for C live coding, Python for Phase 31's Python live coding, so neither mode's chunk carries the
 * other's grammar), line numbers, and a theme built entirely from the app's design tokens (`--se-*`
 * CSS variables), so it re-themes with the light/dark toggle for free. Ligatures are OFF (the locked-spec rule: learners must see
 * literal `->`, `!=`, `<=`), matching the `.se-code` treatment of the read-only code panel.
 *
 * Uncontrolled by design: the view owns the document (CodeMirror manages its own state); React gets
 * every change via `onChange` and never writes the doc back, so there is no caret-jumping sync.
 */
import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';

/** Syntax colors mapped onto the same `--se-syntax-*` tokens the read-only code panel uses. */
const seHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword], color: 'var(--se-syntax-keyword)' },
  { tag: [tags.typeName, tags.standard(tags.typeName), tags.atom], color: 'var(--se-syntax-type)' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName))],
    color: 'var(--se-syntax-fn)',
  },
  { tag: [tags.string, tags.character], color: 'var(--se-syntax-string)' },
  { tag: tags.number, color: 'var(--se-syntax-number)' },
  { tag: tags.comment, color: 'var(--se-syntax-comment)', fontStyle: 'italic' },
  // Preprocessor directives (#include, #define) — same hue as keywords, like highlightC's `preproc`.
  { tag: [tags.processingInstruction, tags.macroName, tags.meta], color: 'var(--se-syntax-keyword)' },
  { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], color: 'var(--se-syntax-punct)' },
]);

/** Chrome theme from the design tokens — flat, hairline borders, no new colors. */
const seEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: 'var(--se-text)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    fontVariantLigatures: 'none',
    lineHeight: '1.6',
  },
  '.cm-content': { caretColor: 'var(--se-text)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--se-text)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
    {
      backgroundColor: 'var(--se-pointer-soft)',
    },
  '.cm-activeLine': { backgroundColor: 'var(--se-surface-2)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--se-text-faint)',
    borderRight: '1px solid var(--se-border)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--se-text)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--se-pointer-soft)', outline: 'none' },
  // The line a syntax error points at (Phase 31): the danger hue, as the read-only panels use it.
  '.cm-se-error-line': {
    backgroundColor: 'var(--se-danger-soft)',
    boxShadow: 'inset 3px 0 0 var(--se-danger)',
  },
});

/** Set (or clear, with `null`) the highlighted error line. */
const setErrorLine = StateEffect.define<number | null>();

/** The error-line decoration; it follows the text as the student edits around it. */
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLine)) continue;
      const n = effect.value;
      next =
        n === null || n < 1 || n > tr.state.doc.lines
          ? Decoration.none
          : Decoration.set([
              Decoration.line({ class: 'cm-se-error-line' }).range(tr.state.doc.line(n).from),
            ]);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export interface CodeEditorProps {
  /** The document the editor opens with. Later changes flow out through `onChange` only. */
  initialDoc: string;
  /** The language mode, e.g. `cpp()` or `python()`. Read once, when the editor is created. */
  language: Extension;
  /** Language-specific extras (e.g. extra highlight styles). Read once, like `language`. */
  extensions?: Extension;
  /** Accessible name of the editor region. */
  ariaLabel?: string;
  /** 1-based line to mark as the error line, or null/absent for none. */
  errorLine?: number | null;
  /** Called with the full document text on every edit. */
  onChange: (doc: string) => void;
  /** Run shortcut (Mod-Enter), so the hands never leave the editor. */
  onRun?: () => void;
}

export function CodeEditor({
  initialDoc,
  language,
  extensions = [],
  ariaLabel = 'C source editor',
  errorLine = null,
  onChange,
  onRun,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageRef = useRef([language, extensions]);
  // Latest callbacks behind stable refs, so the editor is created exactly once.
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onChangeRef.current = onChange;
    onRunRef.current = onRun;
  });
  const initialDocRef = useRef(initialDoc);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: initialDocRef.current,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          indentUnit.of('    '),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onRunRef.current?.();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          languageRef.current,
          syntaxHighlighting(seHighlight),
          errorLineField,
          seEditorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
      parent: host,
    });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine]);

  return <div ref={hostRef} aria-label={ariaLabel} className="h-full min-h-0 overflow-hidden" />;
}
